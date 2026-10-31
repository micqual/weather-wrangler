import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fetchBOMHistorical } from '@/lib/bom'
import RainCharts from './RainCharts'

export const dynamic = 'force-dynamic'

function toN(v: any) { return v == null ? null : parseFloat(String(v)) }
const melbKey = (t: Date) => t.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })

// Cumulative rain_mm -> mm per rain day (9am-9am), skipping resets and corrupt jumps
function dailyFromReadings(readings: { created_at: Date | null; rain_mm: any }[]) {
  const map = new Map<string, number>()
  let last: number | null = null
  for (const r of readings) {
    const curr = toN(r.rain_mm)
    if (curr == null || curr > 600) continue
    if (last == null) { last = curr; continue }
    const inc = curr - last
    if (inc < 0) { last = curr; continue }
    if (inc > 25) continue
    if (inc > 0) {
      const t = new Date(r.created_at!)
      const hour = parseInt(t.toLocaleTimeString('en-GB', { timeZone: 'Australia/Melbourne', hour: '2-digit', hour12: false }))
      const d = new Date(melbKey(t) + 'T12:00:00')
      if (hour < 9) d.setDate(d.getDate() - 1)
      const key = d.toLocaleDateString('en-CA')
      map.set(key, (map.get(key) ?? 0) + inc)
    }
    last = curr
  }
  return map
}

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

  // Shared paddocks read the station they borrow from
  const effectiveId = station.borrowed_station_id ?? id
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000)
  const planted = station.planted_date ? new Date(station.planted_date) : null
  const since = planted && planted < ninetyDaysAgo ? planted : ninetyDaysAgo

  const [readings, firstReading, manualRows] = await Promise.all([
    prisma.weather_readings.findMany({
      where: { station_id: effectiveId, created_at: { gte: since }, rain_mm: { not: null } },
      orderBy: { created_at: 'asc' },
      select: { created_at: true, rain_mm: true },
    }),
    prisma.weather_readings.findFirst({ where: { station_id: effectiveId }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.manual_rain_entries.findMany({ where: { station_id: id }, orderBy: { rain_date: 'asc' } }),
  ])

  // Manual entries only count for days before the station was installed
  const installKey = firstReading?.created_at ? melbKey(new Date(firstReading.created_at)) : '9999-12-31'
  const allMap = new Map<string, { date: string; rain: number; manual: boolean }>()
  for (const [date, rain] of dailyFromReadings(readings)) allMap.set(date, { date, rain: Math.round(rain * 10) / 10, manual: false })
  for (const m of manualRows) {
    const date = m.rain_date.toISOString().slice(0, 10)
    if (date < installKey && !allMap.has(date)) allMap.set(date, { date, rain: toN(m.amount_mm) ?? 0, manual: true })
  }
  const allDays = [...allMap.values()].sort((a, b) => a.date.localeCompare(b.date))

  const days = Array.from({ length: 30 }, (_, i) => {
    const date = melbKey(new Date(Date.now() - (29 - i) * 86400000))
    const e = allMap.get(date)
    return { date, rain: e?.rain ?? 0, manual: e?.manual ?? false }
  })

  const plantedKey = planted ? planted.toISOString().slice(0, 10) : null
  const seasonDays = plantedKey ? allDays.filter(d => d.date >= plantedKey) : []

  const today = days[days.length - 1]?.rain ?? 0
  const last7 = days.slice(-7).reduce((s, d) => s + d.rain, 0)
  const last30 = days.reduce((s, d) => s + d.rain, 0)
  const seasonRain = Math.round(seasonDays.reduce((s, d) => s + d.rain, 0) * 10) / 10
  const lastRainIdx = days.map(d => d.rain >= 1).lastIndexOf(true)
  const daysSinceRain = lastRainIdx >= 0 ? days.length - 1 - lastRainIdx : null
  const rainEvents = seasonDays.filter(d => d.rain >= 1).reverse().slice(0, 20)

  // Monthly totals: station and manual stacked, BOM alongside where we have it
  const agg = new Map<string, { station: number; manual: number }>()
  for (const d of allDays) {
    const m = d.date.slice(0, 7)
    const e = agg.get(m) ?? { station: 0, manual: 0 }
    if (d.manual) e.manual += d.rain; else e.station += d.rain
    agg.set(m, e)
  }
  const bomByMonth = new Map<string, number>()
  if (station.latitude && station.longitude) {
    try {
      const bomData = await fetchBOMHistorical(station.latitude, station.longitude,
        new Date(Date.now() - 180 * 86400000).toLocaleDateString('en-CA'), new Date().toLocaleDateString('en-CA'))
      for (const d of bomData) { const m = d.date.slice(0, 7); bomByMonth.set(m, (bomByMonth.get(m) ?? 0) + (d.precipitation ?? 0)) }
    } catch {}
  }
  const monthKeys = [...new Set([...agg.keys(), ...bomByMonth.keys()])].sort().slice(-12)
  const monthly = monthKeys.map(m => ({
    month: new Date(m + '-01T12:00:00').toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
    station: Math.round((agg.get(m)?.station ?? 0) * 10) / 10,
    manual: Math.round((agg.get(m)?.manual ?? 0) * 10) / 10,
    bom: bomByMonth.has(m) ? Math.round(bomByMonth.get(m)! * 10) / 10 : null,
  }))

  const cards = [
    { label: 'Since 9am', value: `${today.toFixed(1)} mm` },
    { label: 'Last 7 days', value: `${last7.toFixed(1)} mm` },
    { label: 'Last 30 days', value: `${last30.toFixed(1)} mm` },
    { label: 'Season to date', value: `${seasonRain.toFixed(1)} mm`, sub: planted ? `Since ${planted.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : undefined },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>← My Paddocks</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 20px' }}>Rain</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      {daysSinceRain != null && daysSinceRain > 0 && (
        <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid #f97316', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#f97316' }}>
          ☀️ {daysSinceRain} days since last rain event (≥1mm)
        </div>
      )}

      <RainCharts days={days} seasonDays={seasonDays} allDays={allDays} monthly={monthly} rainEvents={rainEvents} />
    </div>
  )
}
