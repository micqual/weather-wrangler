import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import HistoryCharts from './HistoryCharts'

export const dynamic = 'force-dynamic'

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string; metric?: string }>
}) {
  const { id } = await params
  const { from, to, metric } = await searchParams

  const session = await auth()
  if (!session?.user) redirect('/login')

  const station = await prisma.stations.findFirst({
    where: { id, farmer_id: (session.user as any).id },
  })
  if (!station) notFound()

  const toDate = to ? new Date(to) : new Date()
  const fromDate = from ? new Date(from) : new Date(Date.now() - 48 * 60 * 60 * 1000)
  toDate.setHours(23, 59, 59, 999)

  const readings = await prisma.weather_readings.findMany({
    where: {
      station_id: id,
      created_at: { gte: fromDate, lte: toDate },
    },
    orderBy: { created_at: 'asc' },
    select: {
      created_at: true,
      temperature_c: true,
      humidity: true,
      wind_avg_ms: true,
      rain_mm: true,
    },
  })

  const data = readings.map(r => ({
    t: new Date(r.created_at!).getTime(),
    temp: r.temperature_c != null ? parseFloat(String(r.temperature_c)) : null,
    humidity: r.humidity != null ? parseFloat(String(r.humidity)) : null,
    wind: r.wind_avg_ms != null ? parseFloat(String(r.wind_avg_ms)) * 3.6 : null,
    rain_mm: r.rain_mm != null ? parseFloat(String(r.rain_mm)) : null,
  }))

  const rainData = data.map((d, i) => {
    if (i === 0 || d.rain_mm == null || data[i - 1].rain_mm == null) return { t: d.t, v: 0 }
    const inc = d.rain_mm - data[i - 1].rain_mm!
    // If negative or >50mm spike, treat as sensor reset — skip interval
    if (inc < 0 || inc > 50) return { t: d.t, v: 0 }
    return { t: d.t, v: inc }
  })

  const fromStr = fromDate.toLocaleDateString('en-CA')
  const toStr = new Date(toDate).toLocaleDateString('en-CA')

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 960, margin: '0 auto' }}>
      <Link href={`/station/${id}`} style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>
        Back to {station.paddock_name ?? id}
      </Link>
      <div style={{ margin: '12px 0 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
          <span style={{ color: 'var(--orange)' }}>Weather History</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
          {station.paddock_name ?? id} · {readings.length} readings
        </p>
      </div>

      <form method="get" style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>From</label>
          <input className="input" type="date" name="from" defaultValue={fromStr} style={{ width: 160 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>To</label>
          <input className="input" type="date" name="to" defaultValue={toStr} style={{ width: 160 }} />
        </div>
        {metric && <input type="hidden" name="metric" value={metric} />}
        <button className="btn-primary" type="submit" style={{ padding: '8px 20px' }}>View</button>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '48h', days: 2 },
            { label: '7d', days: 7 },
            { label: '14d', days: 14 },
            { label: '30d', days: 30 },
          ].map(({ label, days }) => {
            const f = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA')
            const t = new Date().toLocaleDateString('en-CA')
            const href = `/station/${id}/history?from=${f}&to=${t}${metric ? `&metric=${metric}` : ''}`
            return (
              <a key={label} href={href} style={{
                fontSize: 12, color: 'var(--orange)', border: '1px solid var(--orange)',
                borderRadius: 6, padding: '4px 10px', textDecoration: 'none'
              }}>{label}</a>
            )
          })}
        </div>
      </form>

      {readings.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No readings found for this date range.
        </div>
      ) : (
        <HistoryCharts
          tempData={data.filter(d => d.temp != null).map(d => ({ t: d.t, v: d.temp! }))}
          humidityData={data.filter(d => d.humidity != null).map(d => ({ t: d.t, v: d.humidity! }))}
          windData={data.filter(d => d.wind != null).map(d => ({ t: d.t, v: d.wind! }))}
          rainData={rainData}
          scrollTo={metric}
        />
      )}
    </div>
  )
}
