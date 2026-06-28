import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Chart, Point } from '@/components/Chart'
import { METRICS } from '@/lib/metrics'

export default async function StationHistory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const station = await prisma.stations.findFirst({ where: { id, farmer_id: (session.user as any).id } })
  if (!station) notFound()

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const readings = await prisma.weather_readings.findMany({
    where: { station_id: id, created_at: { gte: since } },
    orderBy: { created_at: 'asc' },
  })

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
      <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← Back to paddocks</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 4px' }}>
        {station.paddock_name ?? station.id} <span style={{ color: 'var(--orange)' }}>· Last 48h</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 24px' }}>{readings.length} readings</p>

      {Object.entries(METRICS).map(([key, m]) => {
        const points: Point[] = readings
          .filter(r => (r as any)[m.field] != null && r.created_at != null)
          .map(r => ({ t: new Date(r.created_at as Date).getTime(), v: m.transform((r as any)[m.field] as number) }))
        return <Chart key={key} title={m.label} color={m.color} points={points} fmt={m.fmt} />
      })}
    </div>
  )
}
