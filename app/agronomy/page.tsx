import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import MitscherlichChart from '@/components/MitscherlichChart'
import { calcMitscherlich } from '@/lib/mitscherlich'
import { calcNBudget } from '@/lib/nBudget'
import { calcYieldPotential } from '@/lib/yieldPotential'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'

export const dynamic = 'force-dynamic'

const toNum = (v: any): number => v == null ? 0 : parseFloat(String(v))
const toNumNull = (v: any): number | null => v == null ? null : parseFloat(String(v))



export default async function AgronomyPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  const nCostPerKg = settings ? parseFloat(String(settings.n_cost_per_kg_n)) : 1.20

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

    const nReq = toNum((s.crop_types as any)?.n_req_kg_per_tonne) || 40
    const wue = toNum((s.crop_types as any)?.wue_kg_per_mm) || 17
    const cFactor = toNum((s.crop_types as any)?.mitscherlich_c) || 0.03
    const grainPrice = toNum((s.crop_types as any)?.grain_price_per_tonne) || 280
    const storedSoilWater = toNumNull((s as any).stored_soil_water_mm)
    const organicCarbon = toNumNull((s as any).organic_carbon_pct)

    const nBudget = calcNBudget(
      soilTests.filter(t => !t.zone_id),
      appsWithWeather.filter(a => !(a as any).zone_id),
      s.soil_type ?? null,
      s.target_yield_t_ha ?? null,
      nReq
    )

    const yieldResult = calcYieldPotential(
      storedSoilWater, 0, organicCarbon,
      nBudget.totalAvailable, nReq, wue,
      s.target_yield_t_ha ?? null,
      toNumNull((s as any).actual_yield_t_ha)
    )

    const maxYield = yieldResult.waterLimitedTHa ?? s.target_yield_t_ha ?? 4
    const currentAppliedN = appsWithWeather
      .filter(a => !(a as any).zone_id)
      .reduce((sum, a) => sum + (a.losses?.retainedKgNHa ?? a.n_kg_ha), 0)

    const curve = calcMitscherlich(
      maxYield,
      nBudget.soilN,
      cFactor,
      currentAppliedN,
      grainPrice,
      nCostPerKg
    )

    const safeCropType = s.crop_types ? {
      crop_name: s.crop_types.crop_name,
      variety: s.crop_types.variety,
    } : null

    return { station: s, safeCropType, nBudget, yieldResult, curve, currentAppliedN, zones, grainPrice }
  }))

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            <span style={{ color: 'var(--orange)' }}>Agronomy</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            Yield response to nitrogen — Mitscherlich curve
          </p>
        </div>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← My Paddocks</Link>
      </div>

      {stationData.map(({ station, safeCropType, nBudget, yieldResult, curve, currentAppliedN, grainPrice }) => (
        <div key={station.id} className="card" style={{ padding: 24, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 4px' }}>
                <Link href={`/station/${station.id}`} style={{ color: 'var(--text)', textDecoration: 'none' }}>
                  {station.paddock_name ?? station.id}
                </Link>
              </h2>
              {safeCropType && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {safeCropType.crop_name} ({safeCropType.variety})
                  {station.hectares ? ` · ${station.hectares} ha` : ''}
                </div>
              )}
            </div>
            {!yieldResult.waterLimitedTHa && (
              <div style={{ fontSize: 12, color: 'var(--amber)', fontStyle: 'italic' }}>
                Set stored soil water for water-limited yield ceiling
              </div>
            )}
          </div>

          {/* Key numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
            <Metric label="Soil N" value={`${nBudget.soilN.toFixed(0)} kg/ha`} color="var(--text-muted)" />
            <Metric label="Applied N (retained)" value={`${currentAppliedN.toFixed(0)} kg/ha`} color="var(--orange)" />
            <Metric label="Total available N" value={`${nBudget.totalAvailable.toFixed(0)} kg/ha`} color="var(--purple)" />
            <Metric label="Max yield (water)" value={yieldResult.waterLimitedTHa ? `${yieldResult.waterLimitedTHa.toFixed(1)} t/ha` : '—'} color="#60a5fa" />
            <Metric label="Current predicted" value={curve.currentYield ? `${curve.currentYield.toFixed(2)} t/ha` : '—'} color="#4ade80" />
            {curve.optimalN != null && <Metric label="95% optimal N" value={`${curve.optimalN} kg/ha`} color="var(--purple)" />}
            {curve.economicOptimalN != null && <Metric label="Economic optimum" value={`${curve.economicOptimalN} kg/ha`} color="var(--amber)" />}
          </div>

          {/* Yield curve chart */}
          <MitscherlichChart
            points={curve.points}
            currentAppliedN={currentAppliedN}
            currentYield={curve.currentYield}
            optimalN={curve.optimalN}
            maxYield={curve.maxYield}
            economicOptimalN={curve.economicOptimalN}
            targetYield={station.target_yield_t_ha ?? null}
            soilN={curve.soilN}
            cFactor={curve.cFactor}
          />

          {/* Gap analysis */}
          {curve.optimalN != null && currentAppliedN < curve.optimalN && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(250,204,21,0.08)', borderRadius: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                ⚠️ N gap to 95% yield: {(curve.optimalN - currentAppliedN).toFixed(0)} kg N/ha
              </span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                ≈ {((curve.optimalN - currentAppliedN) / 0.46).toFixed(0)} kg Urea/ha
                {station.hectares ? ` · ${((curve.optimalN - currentAppliedN) / 0.46 * station.hectares).toFixed(0)} kg total` : ''}
              </span>
            </div>
          )}

          {curve.economicOptimalN != null && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Economic optimum based on grain ${grainPrice}/t, N cost ${nCostPerKg}/kg.
              Efficiency constant c = {curve.cFactor} — contact your agronomist to calibrate per variety.
            </div>
          )}
        </div>
      ))}

      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Yield curve uses the Mitscherlich equation Y = A(1 - e^(-c(x+b))).
        Maximum yield (A) from French-Schultz water-use efficiency framework.
        Efficiency constant (c) is a default — calibrate with local trial data for best accuracy.
      </p>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  )
}
