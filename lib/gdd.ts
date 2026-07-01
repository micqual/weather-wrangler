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

function getMelbourneMidnightUTC(): Date {
  // Get today's date in Melbourne time as a string e.g. "2026-07-01"
  const melbDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  
  // Parse midnight Melbourne by creating a date at noon UTC on that date,
  // then finding what UTC time corresponds to midnight Melbourne
  // We do this by formatting a known UTC time in Melbourne TZ and working backwards
  const [year, month, day] = melbDateStr.split('-').map(Number)
  
  // Try each possible UTC hour for midnight Melbourne (will be either 13 or 14 depending on DST)
  for (const utcHour of [13, 14]) {
    const candidate = new Date(Date.UTC(year, month - 1, day - 1, utcHour, 0, 0, 0))
    const melbHour = parseInt(
      candidate.toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', hour12: false })
    )
    if (melbHour === 0) return candidate
  }
  
  // Fallback to UTC+10 (AEST)
  return new Date(Date.UTC(year, month - 1, day - 1, 14, 0, 0, 0))
}

export async function getDailyRain(stationId: string, prisma: any): Promise<number | null> {
  const midnightUTC = getMelbourneMidnightUTC()

  // Add a debug log so we can verify the midnight calculation
  console.log('Rain midnight UTC:', midnightUTC.toISOString())

  const [firstToday, latest] = await Promise.all([
    prisma.weather_readings.findFirst({
      where: { station_id: stationId, created_at: { gte: midnightUTC }, rain_mm: { not: null } },
      orderBy: { created_at: 'asc' },
      select: { rain_mm: true, created_at: true },
    }),
    prisma.weather_readings.findFirst({
      where: { station_id: stationId, rain_mm: { not: null } },
      orderBy: { created_at: 'desc' },
      select: { rain_mm: true, created_at: true },
    }),
  ])

  console.log('First today:', firstToday)
  console.log('Latest:', latest)

  if (!firstToday || !latest) return null
  return Math.max(0, (latest.rain_mm as number) - (firstToday.rain_mm as number))
}
