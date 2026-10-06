import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fetchBOMHistorical, fetchClimateNormals } from '@/lib/bom'
import RainCharts from './RainCharts'

export const dynamic = 'force-dynamic'

function toN(v: any) { return v == null ? null : parseFloat(String(v)) }

export default async function RainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const isAdmin = (session.user as any).email === 'mdpankhurst@gmail.com'
  const station = await prisma.stations.findFirst({
    where: isAdmin ? { id } : { id, farmer_id: (session.user as any).id },
    include: { crop_types: true },
  })
  if (!station) redirect('/')

  // Fetch last 90 days of readings
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const readings = await prisma.weather_readings.findMany({
    where: { station_id: id, created_at: { gte: ninetyDaysAgo }, rain_mm: { not: null } },
    orderBy: { created_at: 'asc' },
    select: { created_at: true, rain_mm: true },
  })

  // Calculate daily rain using 9am-9am increments
  const dailyMap = new Map<string, number>()
  let lastValidRaw: number | null = null
  for (const r of readings) {
    const curr = toN(r.rain_mm)
    if (curr == null) continue
    if (curr > 600) continue
    if (lastValidRaw == null) { lastValidRaw = curr; continue }
    const inc = curr - lastValidRaw
    if (inc < 0) { lastValidRaw = curr; continue }
    if (inc > 25) { continue }
    if (inc > 0) {
      // Use 9am Melbourne as day boundary
      const melbDate = new Date(r.created_at!).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
      const melbHour = new Date(new Date(r.created_at!).toLocaleString('en-US', { timeZone: 'Australia/Melbourne' })).getHours()
      // If before 9am, attribute to previous day
      const d = new Date(melbDate)
      if (melbHour < 9) d.setDate(d.getDate() - 1)
      const key = d.toLocaleDateString('en-CA')
      dailyMap.set(key, (dailyMap.get(key) ?? 0) + inc)
    }
    lastValidRaw = curr
  }

  // Build 30-day array
  const days: { date: string; rain: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('en-CA')
    days.push({ date: key, rain: Math.round((dailyMap.get(key) ?? 0) * 10) / 10 })
  }

  // Summary stats
  const today = days[days.length - 1]?.rain ?? 0
  const last7 = days.slice(-7).reduce((s, d) => s + d.rain, 0)
  const last30 = days.reduce((s, d) => s + d.rain, 0)

  // Season rain since planting
  let seasonRain = 0
  let seasonDays: { date: string; rain: number }[] = []
  if (station.planted_date) {
    const plantedDate = new Date(station.planted_date)
    const seasonReadings = await prisma.weather_readings.findMany({
      where: { station_id: id, created_at: { gte: plantedDate }, rain_mm: { not: null } },
      orderBy: { created_at: 'asc' },
      select: { created_at: true, rain_mm: true },
    })
    const seasonMap = new Map<string, number>()
    let lastRaw: number | null = null
    for (const r of seasonReadings) {
      const curr = toN(r.rain_mm)
      if (curr == null || curr > 600) continue
      if (lastRaw == null) { lastRaw = curr; continue }
      const inc = curr - lastRaw
      if (inc < 0) { lastRaw = curr; continue }
      if (inc > 25) continue
      if (inc > 0) {
        const key = new Date(r.created_at!).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
        seasonMap.set(key, (seasonMap.get(key) ?? 0) + inc)
      }
      lastRaw = curr
    }
    seasonRain = Math.round([...seasonMap.values()].reduce((s, v) => s + v, 0) * 10) / 10
    seasonDays = [...seasonMap.entries()].map(([date, rain]) => ({ date, rain: Math.round(rain * 10) / 10 })).sort((a, b) => a.date.localeCompare(b.date))
  }

  // Days since last rain
  const lastRainDay = [...days].reverse().find(d => d.rain >= 1)
  const daysSinceRain = lastRainDay ? days.slice(days.indexOf(lastRainDay) + 1).length : null

  // Rain events (days with ≥1mm)
  const rainEvents = seasonDays.filter(d => d.rain >= 1).reverse().slice(0, 20)

  // BOM historical for comparison — use all daily rain data regardless of planted date
  let bomMonthly: { month: string; bom: number; station: number }[] = []
  if (station.latitude && station.longitude) {
    try {
      const bomStart = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
      const bomEnd = new Date().toLocaleDateString('en-CA')
      const bomData = await fetchBOMHistorical(station.latitude, station.longitude, bomStart, bomEnd)

      const monthMap = new Map<string, number>()
      for (const d of bomData) {
        const m = d.date.slice(0, 7)
        monthMap.set(m, (monthMap.get(m) ?? 0) + (d.precipitation ?? 0))
      }

      // Use all daily rain data (not just season) for station comparison
      const allDailyMap = new Map<string, number>()
      for (const d of days) allDailyMap.set(d.date, d.rain)
      for (const d of seasonDays) allDailyMap.set(d.date, d.rain)

      for (const [m, bom] of monthMap.entries()) {
        const stationTotal = [...allDailyMap.entries()]
          .filter(([date]) => date.startsWith(m))
          .reduce((s, [, rain]) => s + rain, 0)
        bomMonthly.push({
          month: new Date(m + '-01').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
          bom: Math.round(bom * 10) / 10,
          station: Math.round(stationTotal * 10) / 10,
        })
      }
    } catch {}
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Link href={`/station/${id}`} style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>← {station.paddock_name ?? id}</Link>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>Rain</h1>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Since 9am', value: `${today.toFixed(1)} mm` },
          { label: 'Last 7 days', value: `${last7.toFixed(1)} mm` },
          { label: 'Last 30 days', value: `${last30.toFixed(1)} mm` },
          { label: 'Season to date', value: `${seasonRain.toFixed(1)} mm`, sub: station.planted_date ? `Since ${new Date(station.planted_date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : undefined },
        ].map((c, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {daysSinceRain != null && daysSinceRain > 0 && (
        <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid #f97316', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#f97316' }}>
          ☀️ {daysSinceRain} days since last rain event (≥1mm)
        </div>
      )}

      <RainCharts days={days} seasonDays={seasonDays} bomMonthly={bomMonthly} rainEvents={rainEvents} />
    </div>
  )
}
