import { estimateNLosses } from './volatilization'

export type NBudget = {
  soilN: number
  appliedNRetained: number
  totalAvailable: number
  targetN: number | null
  yieldTarget: number | null
  pctOfTarget: number | null
  gapKgNHa: number | null
}

export function calcNBudget(
  soilTests: { no3_n_kg_ha: number; nh4_n_kg_ha: number | null }[],
  applications: {
    n_kg_ha: number
    incorporated: boolean | null
    product: string
    avgTempC?: number | null
    avgHumidity?: number | null
    daysToRain?: number | null
    totalRainMm?: number | null
  }[],
  soilType: string | null,
  targetYieldTHa: number | null,
  nReqKgPerTonne: number | null | any,
  organicCarbonPct: number | null = null
): NBudget {
  // Convert Decimal to number if needed
  const nReq = nReqKgPerTonne != null ? parseFloat(String(nReqKgPerTonne)) : null

  const latestTest = soilTests[0]
  const soilTestN = latestTest
    ? (latestTest.no3_n_kg_ha ?? 0) + (latestTest.nh4_n_kg_ha ?? 0)
    : 0

  // N mineralisation from organic carbon (GRDC rule of thumb: OC% × 20 kg N/ha)
  const ocN = organicCarbonPct != null ? organicCarbonPct * 20 : 0

  const soilN = soilTestN + ocN

  const appliedNRetained = applications.reduce((sum, a) => {
    const losses = estimateNLosses(
      a.n_kg_ha,
      a.incorporated ?? false,
      a.avgTempC ?? null,
      a.avgHumidity ?? null,
      a.daysToRain ?? null,
      a.totalRainMm ?? null,
      soilType,
      a.product
    )
    return sum + losses.retainedKgNHa
  }, 0)

  const totalAvailable = soilN + appliedNRetained

  const targetN = targetYieldTHa != null && nReq != null
    ? targetYieldTHa * nReq
    : null

  const pctOfTarget = targetN ? Math.min(100, Math.round((totalAvailable / targetN) * 100)) : null
  const gapKgNHa = targetN ? Math.max(0, targetN - totalAvailable) : null

  return { soilN, soilTestN, ocN, appliedNRetained, totalAvailable, targetN, yieldTarget: targetYieldTHa, pctOfTarget, gapKgNHa }
}

export type NChartPoint = {
  date: string
  leaching: number
  volatilization: number
  cropUsage: number
  total: number
}

export function buildNChart(
  applications: {
    applied_at: Date
    n_kg_ha: number
    incorporated: boolean | null
    product: string
    losses?: { volatilizationKgNHa: number; leachingKgNHa: number }
  }[],
  plantedDate: Date | null,
  targetYieldTHa: number | null,
  nReqKgPerTonne: number | null | any,
  daysToHarvest: number | null
): NChartPoint[] {
  if (!plantedDate) return []

  const nReq = nReqKgPerTonne != null ? parseFloat(String(nReqKgPerTonne)) : 40
  const totalNTarget = targetYieldTHa != null ? targetYieldTHa * nReq : null
  const totalDays = daysToHarvest ?? 180
  const dailyCropUsage = totalNTarget != null ? totalNTarget / totalDays : 0

  const today = new Date()
  const daysSincePlanting = Math.max(1, Math.round((today.getTime() - plantedDate.getTime()) / 86400000))
  const numDays = Math.min(daysSincePlanting, totalDays)

  const points: NChartPoint[] = []
  let cumulLeach = 0
  let cumulVolat = 0

  for (let d = 0; d <= numDays; d++) {
    const date = new Date(plantedDate.getTime() + d * 86400000)
    const dateStr = date.toISOString().slice(0, 10)

    for (const app of applications) {
      const appDate = new Date(app.applied_at).toISOString().slice(0, 10)
      if (appDate === dateStr && app.losses) {
        cumulVolat += app.losses.volatilizationKgNHa
        cumulLeach += app.losses.leachingKgNHa
      }
    }

    const cropUsage = dailyCropUsage * d

    points.push({
      date: dateStr,
      leaching: Math.round(cumulLeach * 10) / 10,
      volatilization: Math.round(cumulVolat * 10) / 10,
      cropUsage: Math.round(cropUsage * 10) / 10,
      total: Math.round((cumulLeach + cumulVolat + cropUsage) * 10) / 10,
    })
  }

  return points
}
