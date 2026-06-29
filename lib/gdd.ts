export type GddResult = {
  accumulated: number
  target: number | null
  avgDailyRate: number
  daysRemaining: number | null
  estimatedHarvestDate: Date | null
}

export function calculateGdd(
  baseTemp: number,
  target: number | null,
  dailyAvgTemps: number[]
): GddResult {
  let accumulated = 0
  for (const avg of dailyAvgTemps) {
    accumulated += Math.max(0, avg - baseTemp)
  }

  const avgDailyRate = dailyAvgTemps.length > 0 ? accumulated / dailyAvgTemps.length : 0

  let daysRemaining: number | null = null
  let estimatedHarvestDate: Date | null = null

  if (target != null && avgDailyRate > 0) {
    const remaining = target - accumulated
    daysRemaining = remaining > 0 ? Math.ceil(remaining / avgDailyRate) : 0
    estimatedHarvestDate = new Date(Date.now() + daysRemaining * 86400000)
  }

  return { accumulated, target, avgDailyRate, daysRemaining, estimatedHarvestDate }
}

export async function getDailyAvgTemps(stationId: string, since: Date, prisma: any): Promise<number[]> {
  const readings = await prisma.weather_readings.findMany({
    where: { station_id: stationId, created_at: { gte: since }, temperature_c: { not: null } },
    select: { created_at: true, temperature_c: true },
    orderBy: { created_at: 'asc' },
  })

  const byDay = new Map<string, { sum: number; count: number }>()
  for (const r of readings) {
    if (!r.created_at || r.temperature_c == null) continue
    const dateKey = new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
    const entry = byDay.get(dateKey) ?? { sum: 0, count: 0 }
    entry.sum += r.temperature_c
    entry.count += 1
    byDay.set(dateKey, entry)
  }

  return Array.from(byDay.values()).map(({ sum, count }) => sum / count)
}
