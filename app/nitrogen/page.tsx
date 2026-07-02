import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import NitrogenGauge from '@/components/NitrogenGauge'
import NitrogenChart from '@/components/NitrogenChart'
import YieldPotentialChart from '@/components/YieldPotentialChart'
import { calcNBudget, buildNChart } from '@/lib/nBudget'
import { calcYieldPotential, buildYieldChart } from '@/lib/yieldPotential'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'

export const dynamic = 'force-dynamic'

function toNum(val: any): number | null {
  if (val == null) return null
  return parseFloat(String(val))
}

export default async function NitrogenPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: { crop_types: true, zones: { include: { crop_types: true } } },
  })

  const stationData = await Promise.all(stations.map(async s => {
    const [soilTests, applications, zones] = await Promise.all([
      prisma.nitrogen_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
      prisma.nitrogen_applications.findMany({ where: { station_id: s.id }, orderBy: { applied_at: 'asc' } }),
      prisma.zones.findMany({ where: { station_id: s.id }, include: { crop_types: true }, orderBy: { created_at: 'asc' } }),
    ])

    const appsWithWeather = await Promise.all(
      applications.map(async a => {
        const weather = await getPostApplicationWeather(s.id, new Date(a.applied_at), prisma)
        const losses = estimateNLosses(
          a.n_kg_ha, a.incorporated ?? false,
          weather.avgTempC, weather.avgHumidity,
          weather.daysToRain, weather.totalRainMm,
          s.soil_type ?? null, a.product
        )
        return { ...a, ...weather, losses }
      })
    )

    // Convert all Decimal fields to plain numbers upfront
    const nReq = toNum((s.crop_types as any)?.n_req_kg_per_tonne) ?? 40
    const wue = toNum((s.crop_types as any)?.wue_kg_per_mm) ?? 17
    const storedSoilWater = toNum((s as any).stored_soil_water_mm)
    const organicCarbon = toNum((s as any).organic_carbon_pct)
    const actualYield = toNum((s as any).actual_yield_t_ha)

    const paddockBudget = calcNBudget(
      soilTests.filter(t => !t.zone_id),
      appsWithWeather.filter(a => !(a as any).zone_id),
      s.soil_type ?? null,
      s.target_yield_t_ha ?? null,
      nReq
    )

    const yieldResult = calcYieldPotential(
      storedSoilWater,
      0,
      organicCarbon,
      paddockBudget.totalAvailable,
      nReq,
      wue,
      s.target_yield_t_ha ?? null,
      actualYield
    )

    let yieldChartPoints: any[] = []
    if (s.planted_date) {
      const plantedDate = new Date(s.planted_date)
      const rainReadings = await prisma.weather_readings.findMany({
        where: { station_id: s.id, created_at: { gte: plantedDate }, rain_mm: { not: null } },
        select: { created_at: true, rain_mm: true },
        orderBy: { created_at: 'asc' },
      })
      const byDay = new Map<string, number>()
      let prevRain = toNum(rainReadings[0]?.rain_mm) ?? 0
      for (const r of rainReadings) {
        if (!r.created_at) continue
        const dateKey = new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
        const inc = Math.max(0, (toNum(r.rain_mm) ?? 0) - prevRain)
        byDay.set(dateKey, (byDay.get(dateKey) ?? 0) + inc)
        prevRain = toNum(r.rain_mm) ?? prevRain
      }
      yieldChartPoints = buildYieldChart(
        Array.from(byDay.entries()).map(([date, rainMm]) => ({ date, rainMm })),
        storedSoilWater, organicCarbon,
        paddockBudget.totalAvailable, nReq, wue
      )
    }

    const chartPoints = buildNChart(
      appsWithWeather.filter(a => !(a as any).zone_id),
      s.planted_date ? new Date(s.planted_date) : null,
      s.target_yield_t_ha ?? null,
      nReq, 180
    )

    const zoneBudgets = zones.map(z => ({
      zone: z,
      budget: calcNBudget(
        soilTests.filter(t => t.zone_id === z.id),
        appsWithWeather.filter(a => (a as any).zone_id === z.id),
        z.soil_type ?? s.soil_type ?? null,
        toNum((z as any).target_yield_t_ha),
        toNum((z.crop_types as any)?.n_req_kg_per_tonne) ?? 40
      ),
    }))

    return {
      station: s,
      paddockBudget, zoneBudgets, chartPoints,
      yieldResult, yieldChartPoints,
      actualYield, nReq, wue
    }
  }))

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            <span style={{ color: 'var(--orange)' }}>Nitrogen</span> Budget
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            Soil N + retained applied N vs crop requirement
          </p>
        </div>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← My Paddocks</Link>
      </div>

      {stationData.map(({ station, paddockBudget, zoneBudgets, chartPoints, yieldResult, yieldChartPoints, actualYield }) => (
        <div key={station.id} className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              <Link href={`/station/${station.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                {station.paddock_name ?? station.id}
              </Link>
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Soil N: {paddockBudget.soilN.toFixed(0)} kg/ha
              {paddockBudget.appliedNRetained > 0 && ` · Applied (retained): ${paddockBudget.appliedNRetained.toFixed(0)} kg/ha`}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 20 }}>
            <NitrogenGauge data={{
              label: station.paddock_name ?? station.id,
              soilN: paddockBudget.soilN,
              appliedNRetained: paddockBudget.appliedNRetained,
              targetN: paddockBudget.targetN,
              yieldTarget: paddockBudget.yieldTarget,
            }} />
            {zoneBudgets.map(({ zone, budget }) => (
              <NitrogenGauge key={zone.id} data={{
                label: zone.name,
                soilN: budget.soilN,
                appliedNRetained: budget.appliedNRetained,
                targetN: budget.targetN,
                yieldTarget: budget.yieldTarget,
              }} />
            ))}
          </div>

          {paddockBudget.gapKgNHa != null && paddockBudget.gapKgNHa > 0 && (
            <div style={{ marginBottom: 20, padding: 12, background: 'rgba(250,204,21,0.08)', borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>⚠️ N gap: {paddockBudget.gapKgNHa.toFixed(0)} kg N/ha</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                to reach {paddockBudget.yieldTarget} t/ha target — approx {(paddockBudget.gapKgNHa / 0.46).toFixed(0)} kg Urea/ha needed
              </span>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>
              Yield Potential
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
              {yieldResult.waterLimitedTHa != null && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#60a5fa' }}>{yieldResult.waterLimitedTHa.toFixed(1)} t/ha</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Water limited</div>
                </div>
              )}
              {yieldResult.nLimitedTHa != null && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--orange)' }}>{yieldResult.nLimitedTHa.toFixed(1)} t/ha</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>N limited</div>
                </div>
              )}
              {yieldResult.targetTHa != null && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--purple)' }}>{yieldResult.targetTHa.toFixed(1)} t/ha</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target</div>
                </div>
              )}
              {actualYield != null && (
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#4ade80' }}>{actualYield.toFixed(1)} t/ha</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actual</div>
                </div>
              )}
              {yieldResult.waterLimitedTHa == null && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Set stored soil water on the <Link href={`/station/${station.id}`} style={{ color: 'var(--orange)' }}>paddock page</Link> to see water-limited yield.
                </div>
              )}
            </div>
            {yieldChartPoints.length > 1 && (
              <YieldPotentialChart
                points={yieldChartPoints}
                actualTHa={actualYield}
                targetTHa={station.target_yield_t_ha ?? null}
              />
            )}
            {yieldResult.notes.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {yieldResult.notes.join(' · ')}
              </div>
            )}
          </div>

          {chartPoints.length > 1 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>
                N Loss Timeline — since planting
              </h3>
              <NitrogenChart points={chartPoints} />
            </div>
          )}
        </div>
      ))}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        N budget = latest soil test N + retained applied N (after estimated volatilization and leaching losses).
        Yield potential uses Sadras & Angus (2006) / French-Schultz framework. Losses are estimates — not a substitute for professional advice.
      </p>
    </div>
  )
}
