import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import PrintButton from './PrintButton'
import Link from 'next/link'
import { fetchBOMHistorical, fetchBOMForecast, fetchClimateNormals } from '@/lib/bom'
import { findNearestStation } from '@/lib/bomStations'
import { calcNBudget, buildNChart } from '@/lib/nBudget'
import NBalanceChart from '@/components/NBalanceChart'
import type { NBalancePoint } from '@/components/NBalanceChart'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'
import { getDailyRainWithRate } from '@/lib/gdd'
import { getDailyAvgTempsWithGapFill } from '@/lib/gdd'

export const dynamic = 'force-dynamic'

const monthName = (m: number) => ['January','February','March','April','May','June','July','August','September','October','November','December'][m]

function toN(v: any) { return v == null ? null : parseFloat(String(v)) }

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const sp = await searchParams
  const now = new Date()
  const reportMonth = sp.month != null ? parseInt(sp.month) : now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const reportYear = sp.year != null ? parseInt(sp.year) : now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()

  const monthStart = new Date(reportYear, reportMonth, 1)
  const monthEnd = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59)

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: { crop_types: true },
  })

  if (stations.length === 0) return <div style={{ padding: 40, color: '#666' }}>No paddocks found.</div>

  const settings = await prisma.settings.findUnique({ where: { id: 1 } })

  const stationData = await Promise.all(stations.map(async s => {
    const [soilTests, phosphorusTests, nitrogenApplications, readings] = await Promise.all([
      prisma.nitrogen_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
      prisma.phosphorus_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
      prisma.nitrogen_applications.findMany({ where: { station_id: s.id }, orderBy: { applied_at: 'desc' } }),
      prisma.weather_readings.findMany({
        where: { station_id: s.id, created_at: { gte: monthStart, lte: monthEnd } },
        orderBy: { created_at: 'asc' },
        select: { created_at: true, temperature_c: true, humidity: true, wind_avg_ms: true, rain_mm: true, battery_mv: true, esp_battery_v: true, solar_v: true },
      }),
    ])

    const appsWithWeather = await Promise.all(nitrogenApplications.map(async a => {
      const weather = await getPostApplicationWeather(s.id, new Date(a.applied_at), prisma)
      const losses = estimateNLosses(a.n_kg_ha, a.incorporated ?? false, weather.avgTempC, weather.avgHumidity, weather.daysToRain, weather.totalRainMm, s.soil_type ?? null, a.product)
      return { ...a, losses }
    }))

    const nReq = toN(s.crop_types?.n_req_kg_per_tonne) ?? 40
    const organicCarbonPct = toN((s as any).organic_carbon_pct)
    const nBudget = calcNBudget(soilTests, appsWithWeather, s.soil_type ?? null, s.target_yield_t_ha ?? null, nReq, organicCarbonPct)

    // N split by planted date
    const plantedDate = s.planted_date ? new Date(s.planted_date) : null
    const paddockApps = appsWithWeather.filter(a => !(a as any).zone_id)
    const preSowingN = paddockApps.filter(a => !plantedDate || new Date(a.applied_at) <= plantedDate).reduce((sum, a) => sum + (a.losses?.retainedKgNHa ?? a.n_kg_ha), 0)
    const postSowingN = paddockApps.filter(a => plantedDate && new Date(a.applied_at) > plantedDate).reduce((sum, a) => sum + (a.losses?.retainedKgNHa ?? a.n_kg_ha), 0)

    // Monthly weather stats
    const temps = readings.flatMap(r => r.temperature_c != null ? [parseFloat(String(r.temperature_c))] : [])
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : null
    const maxTemp = temps.length > 0 ? Math.max(...temps) : null
    const minTemp = temps.length > 0 ? Math.min(...temps) : null

    // Monthly rain
    let monthRain = 0
    for (let i = 1; i < readings.length; i++) {
      const prev = toN(readings[i-1].rain_mm)
      const curr = toN(readings[i].rain_mm)
      if (prev != null && curr != null) {
        const inc = curr - prev
        if (inc > 0 && inc < 50) monthRain += inc
      }
    }

    // BOM comparison
    const nearest = s.latitude && s.longitude ? findNearestStation(s.latitude, s.longitude) : null
    let bomRain: number | null = null
    let bomMaxTemp: number | null = null
    if (s.latitude && s.longitude) {
      const bomData = await fetchBOMHistorical(s.latitude, s.longitude, monthStart.toLocaleDateString('en-CA'), monthEnd.toLocaleDateString('en-CA'))
      bomRain = bomData.reduce((sum, d) => sum + (d.precipitation ?? 0), 0)
      bomMaxTemp = bomData.length > 0 ? Math.max(...bomData.map((d: any) => d.tempMax ?? 0)) : null
    }

    // GDD
    let totalGdd = 0
    let gddPct = 0
    let harvestDate: Date | null = null
    if (plantedDate && s.latitude && s.longitude) {
      const dailyTemps = await getDailyAvgTempsWithGapFill(s.id, plantedDate, s.latitude, s.longitude, prisma)
      const baseTemp = toN(s.crop_types?.base_temp_gdd) ?? 4
      const targetGdd = toN(s.crop_types?.target_gdd_harvest) ?? 0
      totalGdd = dailyTemps.reduce((sum, t) => sum + Math.max(0, t - baseTemp), 0)
      gddPct = targetGdd > 0 ? Math.round((totalGdd / targetGdd) * 100) : 0
      if (targetGdd > 0 && dailyTemps.length > 0) {
        const avgDailyGdd = totalGdd / dailyTemps.length
        const remainingGdd = targetGdd - totalGdd
        if (remainingGdd > 0 && avgDailyGdd > 0) {
          harvestDate = new Date(Date.now() + (remainingGdd / avgDailyGdd) * 86400000)
        }
      }
    }

    // Water budget
    let totalFallowMm = 0
    let totalGrowingMm = 0
    let totalRemainingMm = 0
    if (s.latitude && s.longitude && plantedDate) {
      const prevHarvestDate = new Date(plantedDate.getFullYear() - 1, 10, 1)
      const fallowEnd = new Date(plantedDate); fallowEnd.setDate(fallowEnd.getDate() - 1)
      const today = new Date()
      const [fallowData, growingData, forecastData, climateNormals] = await Promise.all([
        fetchBOMHistorical(s.latitude, s.longitude, prevHarvestDate.toLocaleDateString('en-CA'), fallowEnd.toLocaleDateString('en-CA')),
        fetchBOMHistorical(s.latitude, s.longitude, plantedDate.toLocaleDateString('en-CA'), today.toLocaleDateString('en-CA')),
        fetchBOMForecast(s.latitude, s.longitude),
        fetchClimateNormals(s.latitude, s.longitude),
      ])
      totalFallowMm = fallowData.reduce((sum: number, d: any) => sum + (d.precipitation ?? 0), 0)
      totalGrowingMm = growingData.reduce((sum: number, d: any) => sum + (d.precipitation ?? 0), 0)
      const next7Rain = forecastData.slice(0, 7).reduce((sum: number, d: any) => sum + (d.precipitation ?? 0), 0)
      totalRemainingMm = next7Rain
      if (harvestDate && today < harvestDate) {
        const nextMonth = new Date(today); nextMonth.setDate(1); nextMonth.setMonth(nextMonth.getMonth() + 1)
        while (nextMonth < harvestDate) {
          const normal = climateNormals.find((n: any) => n.month === nextMonth.getMonth() + 1)
          if (normal) totalRemainingMm += normal.avgRainfallMm
          nextMonth.setMonth(nextMonth.getMonth() + 1)
        }
      }
    }
    const storedWater = Math.round(totalFallowMm * 0.25)
    const growingWater = Math.round(totalGrowingMm * 0.8)
    const remainingWater = Math.round(totalRemainingMm * 0.8)
    const totalAvailableWater = Math.max(0, storedWater + growingWater + remainingWater - 60)

    // Station health
    const lastReading = readings[readings.length - 1]
    const totalReadings = readings.length
    const expectedReadings = Math.round((monthEnd.getTime() - monthStart.getTime()) / (15 * 60 * 1000))
    const dataCompleteness = expectedReadings > 0 ? Math.round((totalReadings / expectedReadings) * 100) : 0
    const wsBatV = lastReading?.battery_mv ? (lastReading.battery_mv as number) / 1000 : null
    const nodeBatV = toN(lastReading?.esp_battery_v)

    // Build N chart
    const nChartPoints = buildNChart(
      appsWithWeather.filter(a => !(a as any).zone_id),
      s.planted_date ? new Date(s.planted_date) : null,
      toN(s.target_yield_t_ha),
      toN(s.crop_types?.n_req_kg_per_tonne) ?? 40,
      harvestDate ? Math.ceil((harvestDate.getTime() - Date.now()) / 86400000) : 180
    )

    // Build N balance timeline
    const soilTestN = (nBudget as any).soilTestN ?? 0
    const ocN = (nBudget as any).ocN ?? 0
    const startN = soilTestN + ocN
    const plantedDateObj = s.planted_date ? new Date(s.planted_date) : null
    const endDateObj = harvestDate ?? new Date(Date.now() + 60 * 86400000)

    let nBalance: NBalancePoint[] = []
    if (plantedDateObj) {
      // Start with soil test N + OC
      nBalance.push({ date: plantedDateObj, balance: startN, event: `Soil N ${startN.toFixed(0)} kg` })

      // Add each application
      const sortedApps = [...appsWithWeather.filter(a => !(a as any).zone_id)].sort((a, b) => new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime())
      let runningBalance = startN
      let prevDate = plantedDateObj

      for (const app of sortedApps) {
        const appDate = new Date(app.applied_at)
        // Apply daily losses between prev date and this app
        const days = Math.max(0, Math.floor((appDate.getTime() - prevDate.getTime()) / 86400000))
        const dailyLoss = (app.losses?.volatilizationKgNHa ?? 0 + (app.losses?.leachingKgNHa ?? 0)) / 365
        runningBalance = Math.max(0, runningBalance - days * dailyLoss)
        // Add this application
        const retained = app.losses?.retainedKgNHa ?? app.n_kg_ha
        runningBalance += retained
        nBalance.push({ date: appDate, balance: runningBalance, event: `+${retained.toFixed(0)} kg` })
        prevDate = appDate
      }

      // Project to harvest with gradual loss
      const totalDays = Math.ceil((endDateObj.getTime() - plantedDateObj.getTime()) / 86400000)
      const cropNeed = (toN(s.target_yield_t_ha) ?? 3) * (toN(s.crop_types?.n_req_kg_per_tonne) ?? 40)
      const dailyCropUptake = cropNeed / totalDays
      let lastBalance = nBalance[nBalance.length - 1]?.balance ?? startN
      const today = new Date()
      const stepDays = 7
      let stepDate = new Date(prevDate)
      stepDate.setDate(stepDate.getDate() + stepDays)
      while (stepDate <= (today < endDateObj ? today : endDateObj)) {
        lastBalance = Math.max(0, lastBalance - dailyCropUptake * stepDays)
        nBalance.push({ date: new Date(stepDate), balance: lastBalance })
        stepDate.setDate(stepDate.getDate() + stepDays)
      }
    }

    return { s, nBudget, preSowingN, postSowingN, nChartPoints, nBalance, avgTemp, maxTemp, minTemp, monthRain, bomRain, bomMaxTemp, nearest, totalGdd, gddPct, harvestDate, storedWater, growingWater, remainingWater, totalAvailableWater, dataCompleteness, wsBatV, nodeBatV, soilTests, phosphorusTests, organicCarbonPct }
  }))

  const months = Array.from({ length: 12 }, (_, i) => ({ m: i, y: i <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1 }))

  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: 900, margin: '0 auto', padding: '0 24px', color: '#1a1a1a', background: '#fff', minHeight: '100vh' }}>

      <div className="no-print" style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', marginBottom: 32 }}>
        <Link href="/" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>← My Paddocks</Link>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {months.map(({ m, y }) => (
              <a key={`${m}-${y}`} href={`/report?month=${m}&year=${y}`} style={{ fontSize: 12, padding: '4px 10px', border: `1px solid ${m === reportMonth && y === reportYear ? '#7c5cbf' : '#ddd'}`, borderRadius: 6, textDecoration: 'none', color: m === reportMonth && y === reportYear ? '#7c5cbf' : '#666', fontFamily: 'sans-serif' }}>{monthName(m).slice(0, 3)}</a>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {/* Report header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, paddingBottom: 24, borderBottom: '2px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/Logo.png" alt="Weather Wrangler" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 2, fontFamily: 'sans-serif' }}>Weather Wrangler</div>
            <div style={{ fontSize: 22, fontWeight: 500 }}>Monthly Agronomy Report</div>
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{monthName(reportMonth)} {reportYear}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Generated {now.toLocaleDateString('en-AU')}</div>
        </div>
      </div>

      {stationData.map(({ s, nBudget, preSowingN, postSowingN, nChartPoints, nBalance, avgTemp, maxTemp, minTemp, monthRain, bomRain, bomMaxTemp, nearest, totalGdd, gddPct, harvestDate, storedWater, growingWater, remainingWater, totalAvailableWater, dataCompleteness, wsBatV, nodeBatV, soilTests, phosphorusTests, organicCarbonPct }) => (
        <div key={s.id} style={{ pageBreakBefore: 'always', marginBottom: 64 }}>

          {/* Paddock header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 4, height: 40, background: '#7c5cbf', borderRadius: 0 }}></div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 500 }}>{s.paddock_name ?? s.id}</div>
              <div style={{ fontSize: 13, color: '#666', fontFamily: 'sans-serif', marginTop: 2 }}>
                {s.crop_types ? `${s.crop_types.crop_name} (${s.crop_types.variety})` : 'No crop set'}
                {s.hectares ? ` · ${s.hectares} ha` : ''}
                {s.soil_type ? ` · ${s.soil_type}` : ''}
                {s.planted_date ? ` · Planted ${new Date(s.planted_date).toLocaleDateString('en-AU')}` : ''}
              </div>
            </div>
          </div>

          {/* Weather */}
          <RSection title="Weather summary">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
              <Metric label="Total rainfall" value={`${monthRain.toFixed(1)} mm`} color="#7c5cbf" />
              <Metric label="Avg temperature" value={avgTemp != null ? `${avgTemp.toFixed(1)}°C` : '—'} />
              <Metric label="Max temperature" value={maxTemp != null ? `${maxTemp.toFixed(1)}°C` : '—'} />
              <Metric label="Min temperature" value={minTemp != null ? `${minTemp.toFixed(1)}°C` : '—'} />
            </div>
            {nearest && (
              <div style={{ background: '#f8f8f8', borderRadius: 6, padding: '10px 14px', fontFamily: 'sans-serif', fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>BOM comparison — {nearest.name}</div>
                <div style={{ display: 'flex', gap: 24, color: '#444', flexWrap: 'wrap' }}>
                  {bomRain != null && <span>BOM rainfall: <strong>{bomRain.toFixed(1)} mm</strong> (station: {monthRain.toFixed(1)} mm, diff: {(monthRain - bomRain).toFixed(1)} mm)</span>}
                  {bomMaxTemp != null && <span>BOM max temp: <strong>{bomMaxTemp.toFixed(1)}°C</strong> (station: {maxTemp?.toFixed(1) ?? '—'}°C)</span>}
                </div>
              </div>
            )}
          </RSection>

          {/* Crop progress */}
          {s.planted_date && (
            <RSection title="Crop progress">
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'sans-serif', fontSize: 13, marginBottom: 6 }}>
                <span style={{ fontWeight: 500 }}>{s.crop_types ? `${s.crop_types.crop_name} (${s.crop_types.variety})` : 'No crop'}</span>
                <span style={{ color: '#666' }}>{totalGdd.toFixed(0)} / {s.crop_types?.target_gdd_harvest ?? '—'} GDD · {gddPct}%</span>
              </div>
              <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${Math.min(gddPct, 100)}%`, background: '#7c5cbf', borderRadius: 4 }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'sans-serif', fontSize: 12, color: '#666' }}>
                <span>Planted {new Date(s.planted_date).toLocaleDateString('en-AU')}</span>
                {harvestDate && <span>Est. harvest {harvestDate.toLocaleDateString('en-AU')} · {Math.max(0, Math.ceil((harvestDate.getTime() - Date.now()) / 86400000))} days to go</span>}
              </div>
            </RSection>
          )}

          {/* Water budget */}
          {totalAvailableWater > 0 && (
            <RSection title="Seasonal water budget">
              <div style={{ fontFamily: 'sans-serif', fontSize: 13 }}>
                <WaterRow label="Stored soil water (fallow × 25%)" value={`${storedWater} mm`} color="#7c5cbf" />
                <WaterRow label="Growing season to date (× 80%)" value={`${growingWater} mm`} color="#7c5cbf" />
                <WaterRow label="Remaining forecast (× 80%)" value={`${remainingWater} mm`} color="#999" />
                <WaterRow label="Less evaporation" value="−60 mm" color="#999" />
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontWeight: 500, fontSize: 14 }}>
                  <span>Total available water</span>
                  <span style={{ color: '#7c5cbf' }}>{totalAvailableWater} mm</span>
                </div>
              </div>
            </RSection>
          )}

          {/* Nitrogen */}
          <RSection title="Nitrogen budget">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <Metric label="Soil test N" value={`${(nBudget as any).soilTestN?.toFixed(0) ?? nBudget.soilN.toFixed(0)} kg N/ha`} />
              {organicCarbonPct != null && <Metric label="OC mineralisation" value={`${(nBudget as any).ocN?.toFixed(0) ?? 0} kg N/ha`} />}
              <Metric label="N at sowing" value={`${preSowingN.toFixed(0)} kg N/ha`} color="#7c5cbf" />
              <Metric label="N after sowing" value={`${postSowingN.toFixed(0)} kg N/ha`} color="#7c5cbf" />
              <Metric label="Total available N" value={`${nBudget.totalAvailable.toFixed(0)} kg N/ha`} color="#7c5cbf" bold />
              {nBudget.gapKgNHa != null && nBudget.gapKgNHa > 0 && (
                <Metric label="N gap to target" value={`${nBudget.gapKgNHa.toFixed(0)} kg N/ha`} color="#e67e22" />
              )}
            </div>
          </RSection>

          {/* N balance chart */}
          {nBalance.length > 1 && (
            <RSection title="Nitrogen balance timeline">
              <NBalanceChart points={nBalance} />
            </RSection>
          )}

          {/* Soil tests */}
          {(soilTests.length > 0 || phosphorusTests.length > 0) && (
            <RSection title="Latest soil tests">
              <div style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#444' }}>
                {soilTests[0] && (
                  <div style={{ marginBottom: 6 }}>
                    <strong>Nitrogen test</strong> ({new Date(soilTests[0].tested_at).toLocaleDateString('en-AU')}):
                    NO₃ {soilTests[0].no3_n_kg_ha} kg/ha · NH₄ {soilTests[0].nh4_n_kg_ha ?? '—'} kg/ha
                    {soilTests[0].sulphur_mg_kg != null ? ` · S ${soilTests[0].sulphur_mg_kg} mg/kg` : ''}
                    {soilTests[0].chloride_mg_kg != null ? ` · Cl ${soilTests[0].chloride_mg_kg} mg/kg` : ''}
                  </div>
                )}
                {phosphorusTests[0] && (
                  <div>
                    <strong>Phosphorus test</strong> ({new Date(phosphorusTests[0].tested_at).toLocaleDateString('en-AU')}):
                    Colwell P {phosphorusTests[0].p_colwell_mg_kg ?? '—'} mg/kg · PBI {phosphorusTests[0].pbi ?? '—'} · pH {phosphorusTests[0].ph_cacl2 ?? '—'} CaCl₂
                  </div>
                )}
              </div>
            </RSection>
          )}

          {/* Station health */}
          <RSection title="Station health">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <Metric label="WS battery" value={wsBatV != null ? `${wsBatV.toFixed(2)}V` : '—'} color={wsBatV != null && wsBatV < 2.4 ? '#e74c3c' : '#7c5cbf'} />
              <Metric label="Node battery" value={nodeBatV != null ? `${nodeBatV.toFixed(2)}V` : '—'} color={nodeBatV != null && nodeBatV < 3.6 ? '#e67e22' : '#7c5cbf'} />
              <Metric label="Data completeness" value={`${dataCompleteness}%`} color={dataCompleteness < 80 ? '#e67e22' : '#7c5cbf'} />
            </div>
          </RSection>

        </div>
      ))}

      {/* Footer */}
      <div style={{ borderTop: '1px solid #ddd', marginTop: 40, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontFamily: 'sans-serif', fontSize: 11, color: '#aaa' }}>
        <span>Weather Wrangler · weather-wrangler.vercel.app</span>
        <span>{(settings as any)?.contact_name ?? 'Michael Pankhurst'} · {(settings as any)?.contact_email ?? 'info@weatherwrangler.net'} · {(settings as any)?.contact_phone ?? '+61 422 490 254'}</span>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
        @page { margin: 15mm; }
      `}</style>
    </div>
  )
}

function RSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: 'sans-serif', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid #ddd' }}>{title}</div>
      {children}
    </div>
  )
}

function Metric({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ background: '#f8f8f8', borderRadius: 6, padding: 12 }}>
      <div style={{ fontSize: 18, fontWeight: bold ? 600 : 500, color: color ?? '#1a1a1a', fontFamily: 'sans-serif' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3, fontFamily: 'sans-serif' }}>{label}</div>
    </div>
  )
}

function WaterRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #eee' }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ color, fontWeight: 500 }}>{value}</span>
    </div>
  )
}
