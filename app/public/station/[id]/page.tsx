import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { getDailyRainWithRate } from '@/lib/gdd'
import { degreesToCompass, windArrow } from '@/lib/wind'

export const dynamic = 'force-dynamic'

function readingAge(createdAt: Date | null) {
  if (!createdAt) return 'No readings yet'
  const diffMin = Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.round(diffMin / 60)}h ago`
  return `${Math.round(diffMin / 1440)}d ago`
}

export default async function PublicStationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const station = await prisma.stations.findUnique({
    where: { id },
    include: {
      weather_readings: { orderBy: { created_at: 'desc' }, take: 1 },
    },
  })

  if (!station) notFound()

  const r = station.weather_readings[0]
  const { rainMm: dailyRain } = await getDailyRainWithRate(id, prisma)
  const compass = degreesToCompass(r?.wind_dir_deg ?? null)
  const arrow = windArrow(r?.wind_dir_deg ?? null)
  const age = readingAge(r?.created_at ?? null)

  const wsBatV = r?.battery_mv ? (r.battery_mv as number) / 1000 : null
  const nodeBatV = r?.esp_battery_v as number | null
  const batLow = (wsBatV != null && wsBatV < 2.4) || (nodeBatV != null && nodeBatV < 3.7)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1c1326',
      color: '#f7f1ea',
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: '#a896c0', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Weather Station</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{station.paddock_name ?? station.id}</h1>
        <div style={{ fontSize: 13, color: '#a896c0', marginTop: 8 }}>{age}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 360, marginBottom: 16 }}>
        <StatCard icon="🌡️" label="Temperature" value={r?.temperature_c != null ? `${r.temperature_c.toFixed(1)}°C` : '—'} />
        <StatCard icon="💧" label="Humidity" value={r?.humidity != null ? `${r.humidity}%` : '—'} />
        <StatCard icon="💨" label="Wind" value={r?.wind_avg_ms != null ? `${(r.wind_avg_ms * 3.6).toFixed(0)} km/h` : '—'} sub={r?.wind_dir_deg != null ? `${arrow} ${compass}` : undefined} />
        <StatCard icon="🌧️" label="Rain today" value={dailyRain != null ? `${dailyRain.toFixed(1)} mm` : '—'} />
      </div>

      {batLow && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: '#ef4444', marginBottom: 16, textAlign: 'center' }}>
          ⚠️ Station battery low
        </div>
      )}

      <div style={{ fontSize: 12, color: '#6b5a80', marginTop: 8 }}>
        {station.id}{wsBatV != null ? ` · WS ${wsBatV.toFixed(2)}V` : ''}{nodeBatV != null ? ` · Node ${nodeBatV.toFixed(2)}V` : ''}
      </div>

      <div style={{ marginTop: 40, fontSize: 12, color: '#3f2c57' }}>Weather Wrangler</div>
    </div>
  )
}

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 13, color: '#f2762a', marginTop: 2 }}>{sub}</div>}
      <div style={{ fontSize: 11, color: '#a896c0', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>{label}</div>
    </div>
  )
}
