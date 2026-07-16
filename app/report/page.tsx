import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fetchBOMHistorical } from '@/lib/bom'
import { findNearestStation } from '@/lib/bomStations'
import { getDailyAvgTemps } from '@/lib/gdd'
import { calcNBudget } from '@/lib/nBudget'
import { calcYieldPotential } from '@/lib/yieldPotential'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'
import { interpretPhosphorus } from '@/lib/phosphorus'
import PrintButton from './PrintButton'
import NitrogenChart from '@/components/NitrogenChart'
import { buildNChart } from '@/lib/nBudget'

export const dynamic = 'force-dynamic'

const toNum = (v: any): number | null => v == null ? null : parseFloat(String(v))

function monthName(m: number) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][m]
}

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const sp = await searchParams
  const now = new Date()
  const reportDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const year = sp.year ? parseInt(sp.year) : reportDate.getFullYear()
  const month = sp.month ? parseInt(sp.month) : reportDate.getMonth() // 0-indexed
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const startStr = monthStart.toLocaleDateString('en-CA')
  const endStr = monthEnd.toLocaleDateString('en-CA')

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: {
      crop_types: true,
      zones: { include: { crop_types: true } },
      farms: true,
      weather_readings: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  })

  if (stations.length === 0) {
    return <div style={{ padding: 40, color: '#666' }}>No paddocks found.</div>
  }

  const farmName = stations[0]?.farms?.name ?? 'My Farm'
  const farmerName = ''

  // Fetch data for all stations in parallel
  const stationData = await Promise.all(stations.map(async s => {
    const [soilTests, phosphorusTests, applications, zones, readings] = await Promise.all([
      prisma.nitrogen_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
      prisma.phosphorus_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
      prisma.nitrogen_applications.findMany({ where: { station_id: s.id }, orderBy: { applied_at: 'desc' } }),
      prisma.zones.findMany({ where: { station_id: s.id }, include: { crop_types: true } }),
      prisma.weather_readings.findMany({
        where: { station_id: s.id, created_at: { gte: monthStart, lte: monthEnd }, temperature_c: { not: null } },
        orderBy: { created_at: 'asc' },
        select: { created_at: true, temperature_c: true, humidity: true, rain_mm: true, wind_avg_ms: true },
      }),
    ])

    // Monthly weather stats
    const temps = readings.map(r => r.temperature_c as number)
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null
    const maxTemp = temps.length > 0 ? Math.max(...temps) : null
    const minTemp = temps.length > 0 ? Math.min(...temps) : null

    // Monthly rainfall (cumulative delta)
    let monthlyRain = 0
    if (readings.length >= 2) {
      const firstRain = readings[0].rain_mm as number
      const lastRain = readings[readings.length - 1].rain_mm as number
      monthlyRain = Math.max(0, lastRain - firstRain)
    }

    // Frost days
    const frostDays = readings.filter(r => (r.temperature_c as number) <= 0).length
    const frostRiskDays = readings.filter(r => (r.temperature_c as number) <= 2 && (r.temperature_c as number) > 0).length

    // Data gaps
    const expectedReadings = Math.round((monthEnd.getTime() - monthStart.getTime()) / (15 * 60 * 1000))
    const dataCompleteness = Math.round((readings.length / expectedReadings) * 100)

    // BOM comparison
    let bomData = null
    if (s.latitude && s.longitude) {
      try { bomData = await fetchBOMHistorical(s.latitude, s.longitude, startStr, endStr) } catch {}
    }
    const bomRain = bomData?.reduce((sum, d) => sum + (d.precipitation ?? 0), 0) ?? null
    const bomMaxTemp = bomData ? Math.max(...bomData.filter(d => d.tempMax != null).map(d => d.tempMax as number)) : null
    const bomMinTemp = bomData ? Math.min(...bomData.filter(d => d.tempMin != null).map(d => d.tempMin as number)) : null
    const nearestStation = s.latitude && s.longitude ? findNearestStation(s.latitude, s.longitude) : null

    // N budget
    const nReq = toNum(s.crop_types?.n_req_kg_per_tonne) ?? 40
    const wue = toNum(s.crop_types?.wue_kg_per_mm) ?? 17
    const appsWithWeather = await Promise.all(
      applications.map(async a => {
        const weather = await getPostApplicationWeather(s.id, new Date(a.applied_at), prisma)
        const losses = estimateNLosses(a.n_kg_ha, a.incorporated ?? false, weather.avgTempC, weather.avgHumidity, weather.daysToRain, weather.totalRainMm, s.soil_type ?? null, a.product)
        return { ...a, ...weather, losses }
      })
    )
    const organicCarbonPct = (s as any).organic_carbon_pct ? parseFloat(String((s as any).organic_carbon_pct)) : null
    const nBudget = calcNBudget(soilTests, appsWithWeather, s.soil_type ?? null, s.target_yield_t_ha ?? null, nReq, organicCarbonPct)

    // This month's N applications
    const monthApps = applications.filter(a => {
      const d = new Date(a.applied_at)
      return d >= monthStart && d <= monthEnd
    })

    // GDD this month
    const dailyTemps = await getDailyAvgTemps(s.id, monthStart, prisma)
    const baseTemp = toNum(s.crop_types?.base_temp_gdd) ?? 4
    const monthGDD = dailyTemps.reduce((sum, t) => sum + Math.max(0, t - baseTemp), 0)

    // Cumulative GDD since planting
    const allTemps = s.planted_date ? await getDailyAvgTemps(s.id, new Date(s.planted_date), prisma) : []
    const cumulGDD = allTemps.reduce((sum, t) => sum + Math.max(0, t - baseTemp), 0)
    const targetGDD = toNum(s.crop_types?.target_gdd_harvest)
    const pctGDD = targetGDD ? Math.min(100, Math.round(cumulGDD / targetGDD * 100)) : null

    // P interpretation
    const latestP = phosphorusTests[0]
    const pResult = latestP ? interpretPhosphorus(latestP.p_colwell_mg_kg, latestP.pbi, s.target_yield_t_ha ?? null, toNum(s.hectares), s.crop_types?.crop_name ?? null) : null

    // Latest battery
    const r = s.weather_readings[0]
    const wsBatV = r?.battery_mv ? (r.battery_mv as number) / 1000 : null
    const nodeBatV = r?.esp_battery_v as number | null

    const nChartPoints = buildNChart(
      appsWithWeather.filter(a => !(a as any).zone_id),
      s.planted_date ? new Date(s.planted_date) : null,
      s.target_yield_t_ha ?? null,
      nReq,
      180
    )

    return {
      station: s, zones, readings, avgTemp, maxTemp, minTemp, monthlyRain,
      frostDays, frostRiskDays, dataCompleteness, bomRain, bomMaxTemp, bomMinTemp,
      nearestStation, nBudget, monthApps, appsWithWeather, monthGDD, cumulGDD, pctGDD,
      targetGDD, pResult, latestP, soilTests, wsBatV, nodeBatV, nChartPoints,
    }
  }))

  const totalRain = stationData.reduce((sum, s) => sum + s.monthlyRain, 0) / stationData.length

  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: 900, margin: '0 auto', padding: '0 24px', color: '#1a1a1a', background: '#fff' }}>

      {/* Print/nav controls — hidden when printing */}
      <div className="no-print" style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', marginBottom: 32 }}>
        <Link href="/" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>← My Paddocks</Link>
        <div style={{ display: 'flex', gap: 10 }}>
          <MonthSelector year={year} month={month} />
<PrintButton />
        </div>
      </div>

      {/* Cover */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Monthly Agronomy Report</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>{farmName}</h1>
        <h2 style={{ fontSize: 20, fontWeight: 400, margin: '0 0 16px', color: '#444' }}>{monthName(month)} {year}</h2>
        <div style={{ display: 'flex', gap: 32, fontSize: 13, color: '#666', borderTop: '2px solid #1a1a1a', borderBottom: '1px solid #ddd', padding: '12px 0' }}>
          <span>{stations.length} paddock{stations.length !== 1 ? 's' : ''}</span>
          <span>Generated: {now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Each paddock */}
      {stationData.map(({ station: s, avgTemp, maxTemp, minTemp, monthlyRain, frostDays, frostRiskDays,
        dataCompleteness, bomRain, bomMaxTemp, bomMinTemp, nearestStation, nBudget, monthApps,
        appsWithWeather, monthGDD, cumulGDD, pctGDD, targetGDD, pResult, latestP, soilTests,
        wsBatV, nodeBatV, nChartPoints }) => (
        <div key={s.id} style={{ pageBreakBefore: 'always', marginBottom: 64 }}>

          {/* Paddock header */}
          <div style={{ borderLeft: '4px solid #1a1a1a', paddingLeft: 16, marginBottom: 24 }}>
            <h2 style={{ fontSize: 22, margin: '0 0 4px' }}>{s.paddock_name ?? s.id}</h2>
            <div style={{ fontSize: 13, color: '#666' }}>
              {s.crop_types ? `${s.crop_types.crop_name} (${s.crop_types.variety})` : 'No crop set'}
              {s.hectares ? ` · ${s.hectares} ha` : ''}
              {s.soil_type ? ` · ${s.soil_type}` : ''}
              {s.planted_date ? ` · Planted ${new Date(s.planted_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
            </div>
          </div>

          {/* Weather summary */}
          <Section title="Weather Summary">
            <Grid cols={4}>
              <Metric label="Total rainfall" value={`${monthlyRain.toFixed(1)} mm`} />
              <Metric label="Avg temperature" value={avgTemp != null ? `${avgTemp.toFixed(1)}°C` : '—'} />
              <Metric label="Max temperature" value={maxTemp != null ? `${maxTemp.toFixed(1)}°C` : '—'} />
              <Metric label="Min temperature" value={minTemp != null ? `${minTemp.toFixed(1)}°C` : '—'} />
              <Metric label="Frost events" value={frostDays > 0 ? `${frostDays} readings ≤0°C` : 'None'} alert={frostDays > 0} />
              <Metric label="Frost risk days" value={frostRiskDays > 0 ? `${frostRiskDays} readings 0–2°C` : 'None'} />
              <Metric label="Data completeness" value={`${dataCompleteness}%`} alert={dataCompleteness < 80} />
            </Grid>

            {/* BOM comparison */}
            {bomRain != null && (
              <div style={{ marginTop: 16, padding: '12px 16px', background: '#f8f8f8', borderRadius: 6, fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>
                  BOM Comparison — {nearestStation?.name ?? 'nearest station'} {nearestStation ? `(${nearestStation.distanceKm} km)` : ''}
                </div>
                <div style={{ display: 'flex', gap: 32, color: '#444' }}>
                  <span>Rainfall: <strong>{bomRain.toFixed(1)} mm</strong> (station: {monthlyRain.toFixed(1)} mm, diff: {(monthlyRain - bomRain).toFixed(1)} mm)</span>
                  {bomMaxTemp != null && <span>Max temp: <strong>{bomMaxTemp.toFixed(1)}°C</strong> (station: {maxTemp?.toFixed(1) ?? '—'}°C)</span>}
                  {bomMinTemp != null && <span>Min temp: <strong>{bomMinTemp.toFixed(1)}°C</strong> (station: {minTemp?.toFixed(1) ?? '—'}°C)</span>}
                </div>
              </div>
            )}
          </Section>

          {/* Crop status */}
          {s.crop_types && (
            <Section title="Crop Status">
              <Grid cols={4}>
                <Metric label={`GDD this month`} value={`${Math.round(monthGDD)} GDD`} />
                <Metric label="Cumulative GDD" value={`${Math.round(cumulGDD)} / ${targetGDD ?? '—'}`} />
                <Metric label="Progress to harvest" value={pctGDD != null ? `${pctGDD}%` : '—'} />
                {s.target_yield_t_ha && <Metric label="Target yield" value={`${s.target_yield_t_ha} t/ha`} />}
                {toNum((s as any).actual_yield_t_ha) != null && <Metric label="Actual yield" value={`${toNum((s as any).actual_yield_t_ha)} t/ha`} />}
              </Grid>
            </Section>
          )}

          {/* Nitrogen */}
          <Section title="Nitrogen">
            {monthApps.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Applications this month</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      {['Date','Product','Rate (kg/ha)','N (kg/ha)','Method','Retained'].map(h => (
                        <th key={h} style={{ padding: '4px 8px', textAlign: 'left', fontSize: 11, color: '#888', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {monthApps.map(a => {
                      const enriched = appsWithWeather.find(e => e.id === a.id)
                      return (
                        <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px 8px' }}>{new Date(a.applied_at).toLocaleDateString('en-AU')}</td>
                          <td style={{ padding: '6px 8px' }}>{a.product}</td>
                          <td style={{ padding: '6px 8px' }}>{a.rate_kg_ha}</td>
                          <td style={{ padding: '6px 8px' }}>{a.n_kg_ha.toFixed(1)}</td>
                          <td style={{ padding: '6px 8px' }}>{a.method ?? '—'}</td>
                          <td style={{ padding: '6px 8px' }}>{enriched?.losses?.retainedKgNHa.toFixed(1) ?? '—'} kg/ha</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: '#888', marginBottom: 12 }}>No nitrogen applications recorded this month.</p>
            )}
            <Grid cols={3}>
              <Metric label="Soil N" value={`${nBudget.soilN.toFixed(0)} kg/ha`} />
              <Metric label="Applied N (retained)" value={`${nBudget.appliedNRetained.toFixed(0)} kg/ha`} />
              <Metric label="Total available N" value={`${nBudget.totalAvailable.toFixed(0)} kg/ha`} />
              {nBudget.targetN != null && <Metric label="Target N" value={`${nBudget.targetN.toFixed(0)} kg/ha`} />}
              {nBudget.gapKgNHa != null && nBudget.gapKgNHa > 0 && (
                <Metric label="N gap" value={`${nBudget.gapKgNHa.toFixed(0)} kg/ha`} alert={true} />
              )}
            </Grid>
            {soilTests.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#444' }}>
                Latest soil N test ({new Date(soilTests[0].tested_at).toLocaleDateString('en-AU')}):
                NO₃ {soilTests[0].no3_n_kg_ha} kg/ha
                {soilTests[0].nh4_n_kg_ha != null ? ` · NH₄ ${soilTests[0].nh4_n_kg_ha} kg/ha` : ''}
                {soilTests[0].sulphur_mg_kg != null ? ` · S ${soilTests[0].sulphur_mg_kg} mg/kg` : ''}
              </div>
            )}
            {nChartPoints.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>N loss timeline — since planting</div>
                <NitrogenChart points={nChartPoints} />
              </div>
            )}
          </Section>

          {/* Phosphorus */}
          {latestP && pResult && (
            <Section title="Phosphorus">
              <Grid cols={4}>
                {latestP.p_colwell_mg_kg != null && <Metric label="Colwell P" value={`${latestP.p_colwell_mg_kg} mg/kg`} />}
                {pResult.criticalColwellP != null && <Metric label="Critical P" value={`${pResult.criticalColwellP} mg/kg`} />}
                {latestP.pbi != null && <Metric label="PBI" value={`${latestP.pbi} (${pResult.pbiClass})`} />}
                {latestP.ph_cacl2 != null && <Metric label="pH (CaCl₂)" value={`${latestP.ph_cacl2}`} />}
                {pResult.colwellStatus && <Metric label="P status" value={pResult.colwellStatus.charAt(0).toUpperCase() + pResult.colwellStatus.slice(1)} alert={pResult.colwellStatus === 'deficient' || pResult.colwellStatus === 'marginal'} />}
                {pResult.capitalPRequired != null && <Metric label={pResult.colwellStatus === 'adequate' ? 'Maintenance P' : 'Capital P needed'} value={`${pResult.capitalPRequired} kg P/ha`} alert={pResult.colwellStatus === 'deficient'} />}
                {pResult.capitalPFertiliser != null && <Metric label="DAP equivalent" value={`${pResult.capitalPFertiliser} kg/ha`} />}
              </Grid>
            </Section>
          )}

          {/* Station health */}
          <Section title="Station Health">
            <Grid cols={3}>
              <Metric label="WS battery" value={wsBatV != null ? `${wsBatV.toFixed(2)}V` : '—'} alert={wsBatV != null && wsBatV < 2.4} />
              <Metric label="Node battery" value={nodeBatV != null ? `${nodeBatV.toFixed(2)}V` : '—'} alert={nodeBatV != null && nodeBatV < 3.7} />
              <Metric label="Data completeness" value={`${dataCompleteness}%`} alert={dataCompleteness < 80} />
            </Grid>
          </Section>

          <div style={{ borderTop: '1px solid #ddd', marginTop: 32, paddingTop: 12, fontSize: 11, color: '#aaa' }}>
            Report generated by Weather Wrangler · {now.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })} ·
            Data from on-farm weather station{nearestStation ? ` · BOM comparison: ${nearestStation.name}` : ''}
          </div>
        </div>
      ))}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          div[style*="pageBreakBefore"] { page-break-before: always; }
        }
        @page { margin: 20mm; }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#888', margin: '0 0 12px', paddingBottom: 6, borderBottom: '1px solid #eee' }}>{title}</h3>
      {children}
    </div>
  )
}

function Grid({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
      {children}
    </div>
  )
}

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: alert ? '#c0392b' : '#1a1a1a' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function MonthSelector({ year, month }: { year: number; month: number }) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i - 1)
    return { y: d.getFullYear(), m: d.getMonth(), label: `${monthName(d.getMonth())} ${d.getFullYear()}` }
  })
  return (
    <form method="get" style={{ display: 'flex', gap: 8 }}>
      <select name="month" defaultValue={month} style={{ border: '1px solid #ddd', borderRadius: 6, padding: '6px 10px', fontSize: 13 }}>
        {months.map(({ y, m, label }) => (
          <option key={`${y}-${m}`} value={m}>{label}</option>
        ))}
      </select>
      <input type="hidden" name="year" value={year} />
      <button type="submit" style={{ background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>View</button>
    </form>
  )
}
