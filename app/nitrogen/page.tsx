import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import NitrogenGauge from '@/components/NitrogenGauge'
import NitrogenChart from '@/components/NitrogenChart'
import { calcNBudget, buildNChart } from '@/lib/nBudget'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'

export const dynamic = 'force-dynamic'

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
        const soilType = s.soil_type ?? null
        const losses = estimateNLosses(
          a.n_kg_ha, a.incorporated ?? false,
          weather.avgTempC, weather.avgHumidity,
          weather.daysToRain, weather.totalRainMm,
          soilType, a.product
        )
        return { ...a, ...weather, losses }
      })
    )

    const nReq = (s.crop_types as any)?.n_req_kg_per_tonne ?? 40

    const paddockBudget = calcNBudget(
      soilTests.filter(t => !t.zone_id),
      appsWithWeather.filter(a => !(a as any).zone_id),
      s.soil_type ?? null,
      s.target_yield_t_ha ?? null,
      nReq
    )

    const daysToHarvest = s.planted_date && paddockBudget.targetN
      ? Math.max(1, Math.round(((s as any).estimated_harvest ? new Date((s as any).estimated_harvest).getTime() : Date.now() + 120 * 86400000) - Date.now()) / 86400000)
      : 180

    const chartPoints = buildNChart(
      appsWithWeather.filter(a => !(a as any).zone_id),
      s.planted_date ? new Date(s.planted_date) : null,
      s.target_yield_t_ha ?? null,
      nReq,
      daysToHarvest
    )

    const zoneBudgets = zones.map(z => {
      const zSoilTests = soilTests.filter(t => t.zone_id === z.id)
      const zApps = appsWithWeather.filter(a => (a as any).zone_id === z.id)
      return {
        zone: z,
        budget: calcNBudget(
          zSoilTests, zApps,
          z.soil_type ?? s.soil_type ?? null,
          (z as any).target_yield_t_ha ?? null,
          (z.crop_types as any)?.n_req_kg_per_tonne ?? 40
        ),
      }
    })

    return { station: s, paddockBudget, zoneBudgets, chartPoints }
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

      {stationData.map(({ station, paddockBudget, zoneBudgets, chartPoints }) => (
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
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

          {chartPoints.length > 1 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px' }}>
                N Loss Timeline — since planting
              </h3>
              <NitrogenChart points={chartPoints} />
            </div>
          )}

          {chartPoints.length <= 1 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>
              Set a planted date and yield target on this paddock to see the N loss timeline.
            </div>
          )}
        </div>
      ))}

      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        N budget = latest soil test N + retained applied N (after estimated volatilization and leaching losses).
        Crop usage estimated from yield target ÷ days to harvest. Losses are estimates — not a substitute for professional advice.
      </p>
    </div>
  )
}
