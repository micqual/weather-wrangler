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

export async function getPostApplicationWeather(
  stationId: string,
  appliedAt: Date,
  prisma: any
): Promise<{ avgTempC: number | null; avgHumidity: number | null; daysToRain: number | null; totalRainMm: number | null }> {
  const dayAfter = new Date(appliedAt.getTime() + 14 * 86400000)

  const readings = await prisma.weather_readings.findMany({
    where: {
      station_id: stationId,
      created_at: { gte: appliedAt, lte: dayAfter },
    },
    select: { temperature_c: true, humidity: true, rain_mm: true, created_at: true },
    orderBy: { created_at: 'asc' },
  })

  if (readings.length === 0) return { avgTempC: null, avgHumidity: null, daysToRain: null, totalRainMm: null }

  const temps = readings.filter((r: any) => r.temperature_c != null).map((r: any) => r.temperature_c as number)
  const humids = readings.filter((r: any) => r.humidity != null).map((r: any) => r.humidity as number)
  const avgTempC = temps.length > 0 ? temps.reduce((a: number, b: number) => a + b, 0) / temps.length : null
  const avgHumidity = humids.length > 0 ? humids.reduce((a: number, b: number) => a + b, 0) / humids.length : null

  // Find first rain event (>1mm) and total rain
  let daysToRain: number | null = null
  let totalRainMm = 0
  const firstReading = readings[0]
  const baseRain = firstReading?.rain_mm ?? 0

  for (const r of readings) {
    if (r.rain_mm != null && r.rain_mm > baseRain + 1) {
      if (daysToRain === null) {
        daysToRain = Math.round((new Date(r.created_at).getTime() - appliedAt.getTime()) / 86400000)
      }
    }
  }

  const lastReading = readings[readings.length - 1]
  totalRainMm = lastReading?.rain_mm != null && firstReading?.rain_mm != null
    ? Math.max(0, (lastReading.rain_mm as number) - (firstReading.rain_mm as number))
    : 0

  return { avgTempC, avgHumidity, daysToRain, totalRainMm }
}

export async function getDailyRainWithRate(stationId: string, prisma: any): Promise<{ rainMm: number | null; avgRateMMH: number | null }> {
  const midnightUTC = getMelbourneMidnightUTC()

  const [firstToday, latest, todayReadings] = await Promise.all([
    prisma.weather_readings.findFirst({
      where: { station_id: stationId, created_at: { gte: midnightUTC }, rain_mm: { not: null } },
      orderBy: { created_at: 'asc' },
      select: { rain_mm: true },
    }),
    prisma.weather_readings.findFirst({
      where: { station_id: stationId, rain_mm: { not: null } },
      orderBy: { created_at: 'desc' },
      select: { rain_mm: true },
    }),
    prisma.weather_readings.findMany({
      where: { station_id: stationId, created_at: { gte: midnightUTC }, rain_mm: { not: null } },
      orderBy: { created_at: 'asc' },
      select: { rain_mm: true },
    }),
  ])

  if (!firstToday || !latest) return { rainMm: null, avgRateMMH: null }

  const rainMm = Math.max(0, (latest.rain_mm as number) - (firstToday.rain_mm as number))

  // Calculate average rain rate from increments — 15 min intervals × 4 = mm/h
  let totalRate = 0
  let rateCount = 0
  for (let i = 1; i < todayReadings.length; i++) {
    const inc = Math.max(0, (todayReadings[i].rain_mm as number) - (todayReadings[i - 1].rain_mm as number))
    if (inc > 0) {
      totalRate += inc * 4 // 15 min to hourly rate
      rateCount++
    }
  }
  const avgRateMMH = rateCount > 0 ? totalRate / rateCount : null

  return { rainMm, avgRateMMH }
}

export async function getRainStats(stationId: string, prisma: any): Promise<{
  rainLast24h: number
  rainLast72h: number
  daysSinceLastRain: number | null
}> {
  const now = new Date()
  const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const h72ago = new Date(now.getTime() - 72 * 60 * 60 * 1000)

  const [readings24, readings72] = await Promise.all([
    prisma.weather_readings.findMany({
      where: { station_id: stationId, created_at: { gte: h24ago }, rain_mm: { not: null } },
      select: { rain_mm: true },
      orderBy: { created_at: 'asc' },
    }),
    prisma.weather_readings.findMany({
      where: { station_id: stationId, created_at: { gte: h72ago }, rain_mm: { not: null } },
      select: { rain_mm: true },
      orderBy: { created_at: 'asc' },
    }),
  ])

  const calcRain = (readings: any[]) => {
    if (readings.length < 2) return 0
    const first = readings[0].rain_mm as number
    const last = readings[readings.length - 1].rain_mm as number
    return Math.max(0, last - first)
  }

  const rainLast24h = calcRain(readings24)
  const rainLast72h = calcRain(readings72)

  // Find days since last rain event (>0.5mm)
  const recentReadings = await prisma.weather_readings.findMany({
    where: { station_id: stationId, rain_mm: { not: null } },
    select: { rain_mm: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 200,
  })

  let daysSinceLastRain: number | null = null
  let prevRain: number | null = null
  for (const r of recentReadings) {
    if (prevRain !== null) {
      const inc = prevRain - (r.rain_mm as number)
      if (inc > 0.5) {
        daysSinceLastRain = Math.round((now.getTime() - new Date(r.created_at).getTime()) / 86400000)
        break
      }
    }
    prevRain = r.rain_mm as number
  }

  return { rainLast24h, rainLast72h, daysSinceLastRain }
}
