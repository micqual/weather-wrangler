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
import { fetchBOMHistorical, fetchBOMForecast, fetchClimateNormals, fetchRainfallDeciles } from '@/lib/bom'
import RainfallBudget from '@/components/RainfallBudget'
import DecileYieldChart from '@/components/DecileYieldChart'
import type { RainfallMonth } from '@/components/RainfallBudget'
import type { DecileBar } from '@/components/DecileYieldChart'

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
      nReq,
      organicCarbon
    )

    const yieldResult = calcYieldPotential(
      storedSoilWater, 0, organicCarbon,
      nBudget.totalAvailable, nReq, wue,
      s.target_yield_t_ha ?? null,
      toNumNull((s as any).actual_yield_t_ha)
    )

    const maxYield = yieldResult.waterLimitedTHa ?? s.target_yield_t_ha ?? 4
    const paddockApps = appsWithWeather.filter(a => !(a as any).zone_id)
    const plantedDate = s.planted_date ? new Date(s.planted_date) : null

    const preSowingN = paddockApps
      .filter(a => plantedDate == null || new Date(a.applied_at) <= plantedDate)
      .reduce((sum, a) => sum + (a.losses?.retainedKgNHa ?? a.n_kg_ha), 0)

    const postSowingN = paddockApps
      .filter(a => plantedDate != null && new Date(a.applied_at) > plantedDate)
      .reduce((sum, a) => sum + (a.losses?.retainedKgNHa ?? a.n_kg_ha), 0)

    const currentAppliedN = preSowingN + postSowingN

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

    // ── Rainfall budget ──
    let rainfallMonths: any[] = []
    let totalFallowMm = 0
    let totalGrowingMm = 0
    let totalRemainingMm = 0
    let decileBars: any[] = []

    if (s.latitude && s.longitude && s.planted_date) {
      const plantedDate = new Date(s.planted_date)
      const plantedYear = plantedDate.getFullYear()
      const today = new Date()

      // Previous harvest date = Nov 1 of previous year
      const prevHarvestDate = new Date(plantedYear - 1, 10, 1)
      const fallowEnd = new Date(plantedDate)
      fallowEnd.setDate(fallowEnd.getDate() - 1)

      // Estimated harvest date from GDD
      const targetGDDVal = toNum(s.crop_types?.target_gdd_harvest)
      const baseTemp = toNum(s.crop_types?.base_temp_gdd) || 4
      const daysToHarvest = targetGDDVal > 0 ? Math.round(targetGDDVal / 9) : 200
      const harvestDate = new Date(plantedDate.getTime() + daysToHarvest * 24 * 60 * 60 * 1000)

      const [fallowData, growingData, forecastData, climateNormals, decileData] = await Promise.all([
        fetchBOMHistorical(s.latitude, s.longitude,
          prevHarvestDate.toLocaleDateString('en-CA'),
          fallowEnd.toLocaleDateString('en-CA')
        ),
        fetchBOMHistorical(s.latitude, s.longitude,
          plantedDate.toLocaleDateString('en-CA'),
          (today < harvestDate ? today : harvestDate).toLocaleDateString('en-CA')
        ),
        today < harvestDate ? fetchBOMForecast(s.latitude, s.longitude) : Promise.resolve([]),
        fetchClimateNormals(s.latitude, s.longitude),
        fetchRainfallDeciles(s.latitude, s.longitude, plantedDate.getMonth() + 1, 10),
      ])

      // Fallow months
      const fallowByMonth = new Map<string, number>()
      for (const d of fallowData) {
        const key = d.date.substring(0, 7)
        fallowByMonth.set(key, (fallowByMonth.get(key) ?? 0) + (d.precipitation ?? 0))
      }
      for (const [key, rain] of Array.from(fallowByMonth.entries()).sort()) {
        const [y, m] = key.split('-').map(Number)
        const label = new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
        rainfallMonths.push({ month: m, year: y, label, rainfallMm: Math.round(rain * 10) / 10, source: 'bom-historical', efficiency: 25, period: 'fallow' })
        totalFallowMm += rain
      }

      // Growing season months — use WS90 where available, BOM otherwise
      // Get WS90 monthly rain from station readings
      const ws90Readings = await prisma.weather_readings.findMany({
        where: { station_id: s.id, created_at: { gte: plantedDate }, rain_mm: { not: null } },
        orderBy: { created_at: 'asc' },
        select: { created_at: true, rain_mm: true },
      })

      // Calculate monthly rain totals from WS90
      const ws90ByMonth = new Map<string, number>()
      for (let i = 1; i < ws90Readings.length; i++) {
        const prev = ws90Readings[i - 1].rain_mm as number
        const curr = ws90Readings[i].rain_mm as number
        const inc = Math.max(0, curr - prev)
        const key = new Date(ws90Readings[i].created_at!).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' }).substring(0, 7)
        ws90ByMonth.set(key, (ws90ByMonth.get(key) ?? 0) + inc)
      }

      // BOM growing season by month
      const growingByMonth = new Map<string, number>()
      for (const d of growingData) {
        const key = d.date.substring(0, 7)
        growingByMonth.set(key, (growingByMonth.get(key) ?? 0) + (d.precipitation ?? 0))
      }

      // Merge — prefer WS90 where available
      const allGrowingMonths = new Set([...Array.from(growingByMonth.keys()), ...Array.from(ws90ByMonth.keys())])
      for (const key of Array.from(allGrowingMonths).sort()) {
        const [y, m] = key.split('-').map(Number)
        const label = new Date(y, m - 1, 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
        const hasWS90 = ws90ByMonth.has(key)
        const rain = hasWS90 ? ws90ByMonth.get(key)! : (growingByMonth.get(key) ?? 0)
        const source = hasWS90 ? 'station' : 'bom-historical'
        rainfallMonths.push({ month: m, year: y, label, rainfallMm: Math.round(rain * 10) / 10, source, efficiency: 80, period: 'growing' })
        totalGrowingMm += rain
      }

      // Remaining season
      if (today < harvestDate) {
        const next7Rain = forecastData.slice(0, 7).reduce((sum: number, d: any) => sum + (d.precipitation ?? 0), 0)
        if (next7Rain > 0) {
          rainfallMonths.push({ month: today.getMonth() + 1, year: today.getFullYear(), label: 'Next 7d', rainfallMm: Math.round(next7Rain * 10) / 10, source: 'bom-forecast', efficiency: 80, period: 'remaining' })
          totalRemainingMm += next7Rain
        }
        const nextMonth = new Date(today)
        nextMonth.setDate(1)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        while (nextMonth < harvestDate) {
          const m = nextMonth.getMonth() + 1
          const normal = climateNormals.find((n: any) => n.month === m)
          if (normal) {
            const label = nextMonth.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })
            rainfallMonths.push({ month: m, year: nextMonth.getFullYear(), label, rainfallMm: normal.avgRainfallMm, source: 'bom-climate', efficiency: 80, period: 'remaining' })
            totalRemainingMm += normal.avgRainfallMm
          }
          nextMonth.setMonth(nextMonth.getMonth() + 1)
        }
      }

      // Decile bars
      const wueVal = toNum(s.crop_types?.wue_kg_per_mm) || 20
      const nReqVal = toNum(s.crop_types?.n_req_kg_per_tonne) || 40
      const totalAvailableN = nBudget.totalAvailable

      decileBars = decileData.map((d: any) => {
        const storedWater = totalFallowMm * 0.25
        const totalWater = Math.max(0, storedWater + d.rainfallMm * 0.8 - 60)
        const waterLimited = Math.round(totalWater * wueVal) / 1000
        const nLimited = Math.min(waterLimited, Math.round(totalAvailableN / nReqVal * 10) / 10)
        const nGap = Math.max(0, waterLimited * nReqVal - totalAvailableN)
        return { label: d.label, rainfallMm: d.rainfallMm, waterLimitedTHa: waterLimited, nLimitedTHa: nLimited, recommendedNKgHa: Math.round(nGap / 0.46) }
      })
    }

    return { station: s, safeCropType, nBudget, yieldResult, curve, currentAppliedN, preSowingN, postSowingN, zones, grainPrice, rainfallMonths, totalFallowMm, totalGrowingMm, totalRemainingMm, decileBars }
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

      {stationData.map(({ station, safeCropType, nBudget, yieldResult, curve, currentAppliedN, preSowingN, postSowingN, grainPrice, rainfallMonths, totalFallowMm, totalGrowingMm, totalRemainingMm, decileBars }) => (
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
            <Metric label="Soil test N" value={`${(nBudget as any).soilTestN?.toFixed(0) ?? nBudget.soilN.toFixed(0)} kg N/ha`} color="var(--text-muted)" />
            {(nBudget as any).ocN > 0 && <Metric label="OC mineralisation" value={`${(nBudget as any).ocN.toFixed(0)} kg N/ha`} color="var(--text-muted)" />}
            <Metric label="N applied at sowing" value={`${preSowingN.toFixed(0)} kg N/ha`} color="var(--orange)" />
            <Metric label="N applied after sowing" value={`${postSowingN.toFixed(0)} kg N/ha`} color="var(--orange)" />
            <Metric label="Total available N" value={`${nBudget.totalAvailable.toFixed(0)} kg N/ha`} color="var(--purple)" />
            <Metric label="Water-limited yield" value={yieldResult.waterLimitedTHa ? `${yieldResult.waterLimitedTHa.toFixed(1)} t/ha` : '—'} color="#60a5fa" />
            <Metric label="N-limited yield" value={curve.currentYield ? `${curve.currentYield.toFixed(2)} t/ha` : '—'} color="#4ade80" />
            {curve.optimalN != null && <Metric label="95% optimal N" value={`${curve.optimalN} kg N/ha`} color="var(--purple)" />}
            {curve.economicOptimalN != null && <Metric label="Economic optimum" value={`${curve.economicOptimalN} kg N/ha`} color="var(--amber)" />}
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

          {rainfallMonths.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>
                Seasonal Water Budget
              </h3>
              <RainfallBudget
                months={rainfallMonths}
                totalFallowMm={totalFallowMm}
                totalGrowingMm={totalGrowingMm}
                totalRemainingMm={totalRemainingMm}
                storedSoilWaterMm={toNumNull((station as any).stored_soil_water_mm)}
                evapCoeff={60}
                totalAvailableMm={Math.max(0, totalFallowMm * 0.25 + (totalGrowingMm + totalRemainingMm) * 0.8 - 60)}
                waterLimitedYield={yieldResult.waterLimitedTHa}
              />
            </div>
          )}

          {decileBars.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 16px' }}>
                Yield Potential by Rainfall Scenario
              </h3>
              <DecileYieldChart bars={decileBars} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>
                Based on 30-year growing season rainfall distribution for this location. Dark = water-limited yield (unlimited N). Light = yield with current N. Recommended N shown to reach water-limited potential.
              </p>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Methodology</div>
        Water-limited yield uses the Sadras & Angus (2006) update of the French-Schultz formula: Y = (Stored soil water + Growing season rainfall − 60mm evaporation) × WUE. Yield response to nitrogen uses the Mitscherlich equation Y = A(1 − e^(−c(x+b))). N mineralisation estimated as OC% × 20 kg N/ha.
        These calculations are equivalent to the Yield Prophet® Lite methodology (Birchip Cropping Group / CSIRO). For probabilistic yield forecasts using full APSIM simulation, visit <a href="https://www.yieldprophet.com.au" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--orange)' }}>yieldprophet.com.au</a>.
        Results are indicative only — not a substitute for professional agronomic advice.
      </div>
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
