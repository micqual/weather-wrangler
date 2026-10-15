'use server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getDailyRainWithRate } from '@/lib/gdd'
import { getSprayWindow } from '@/lib/sprayWindow'
import { degreesToCompass } from '@/lib/wind'
import type { Conditions } from './types'

const TZ = 'Australia/Melbourne'
const DAY = 24 * 60 * 60 * 1000

function melbNow(d: Date) {
  const opts: any = { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23', timeZoneName: 'shortOffset' }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU', opts).formatToParts(d).map((p) => [p.type, p.value]))
  const m = /GMT([+-]\d+)/.exec(parts.timeZoneName ?? '')
  return { y: +parts.year, mo: +parts.month, d: +parts.day, h: +parts.hour, offsetMin: m ? Number(m[1]) * 60 : 600 }
}

// Start of the current rain day (9am Melbourne time)
function rainDayStart(now: Date): Date {
  const p = melbNow(now)
  let start = Date.UTC(p.y, p.mo - 1, p.d, 9) - p.offsetMin * 60000
  if (p.h < 9) start -= DAY
  return new Date(start)
}

// Sum of increases in the cumulative rain counter, handling counter resets
async function rainBetween(stationId: string, from: Date, to: Date): Promise<number | null> {
  const [base, rows] = await Promise.all([
    prisma.weather_readings.findFirst({
      where: { station_id: stationId, created_at: { lt: from }, rain_mm: { not: null } },
      orderBy: { created_at: 'desc' },
      select: { rain_mm: true },
    }),
    prisma.weather_readings.findMany({
      where: { station_id: stationId, created_at: { gte: from, lt: to }, rain_mm: { not: null } },
      orderBy: { created_at: 'asc' },
      select: { rain_mm: true },
    }),
  ])
  if (!rows.length) return null
  let prev = base?.rain_mm ?? (rows[0].rain_mm as number)
  let total = 0
  for (const r of rows) {
    const v = r.rain_mm as number
    total += v >= prev ? v - prev : v
    prev = v
  }
  return Math.round(total * 10) / 10
}

export async function getConditions(stationId: string): Promise<Conditions | null> {
  const session = await auth()
  if (!session?.user) return null

  const station = await prisma.stations.findFirst({
    where: { id: stationId, farmer_id: (session.user as any).id },
  })
  if (!station) return null

  let sourceId = stationId
  let borrowedFrom: string | null = null
  let r = await prisma.weather_readings.findFirst({ where: { station_id: stationId }, orderBy: { created_at: 'desc' } })
  const borrowedId = (station as any).borrowed_station_id as string | null
  if (!r && borrowedId) {
    r = await prisma.weather_readings.findFirst({ where: { station_id: borrowedId }, orderBy: { created_at: 'desc' } })
    if (r) { sourceId = borrowedId; borrowedFrom = borrowedId }
  }

  if (!r) {
    return {
      hasData: false, borrowedFrom: null, readingAt: null, tempC: null, humidity: null, windKmh: null, gustKmh: null,
      windDir: null, uvi: null, rainToday: null, rainYesterday: null, rain7d: null, deltaT: null,
      sprayOverall: 'stop', sprayConditions: [],
    }
  }

  const now = new Date()
  const dayStart = rainDayStart(now)
  const [today, yesterday, week] = await Promise.all([
    getDailyRainWithRate(sourceId, prisma),
    rainBetween(sourceId, new Date(dayStart.getTime() - DAY), dayStart),
    rainBetween(sourceId, new Date(dayStart.getTime() - 6 * DAY), now),
  ])

  const spray = getSprayWindow(r.temperature_c, r.humidity, r.wind_avg_ms, r.wind_max_ms, melbNow(now).h)

  return {
    hasData: true,
    borrowedFrom,
    readingAt: r.created_at ? r.created_at.toISOString() : null,
    tempC: r.temperature_c,
    humidity: r.humidity,
    windKmh: r.wind_avg_ms != null ? r.wind_avg_ms * 3.6 : null,
    gustKmh: r.wind_max_ms != null ? r.wind_max_ms * 3.6 : null,
    windDir: r.wind_dir_deg != null ? degreesToCompass(r.wind_dir_deg) : null,
    uvi: r.uvi,
    rainToday: today.rainMm,
    rainYesterday: yesterday,
    rain7d: week,
    deltaT: spray.deltaT,
    sprayOverall: spray.overall,
    sprayConditions: spray.conditions,
  }
}
