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
      crop_types: true,
    },
  })

  if (!station) notFound()

  const settings = await prisma.settings.findUnique({ where: { id: 1 } })
  const r = station.weather_readings[0]
  const { rainMm: dailyRain } = await getDailyRainWithRate(id, prisma)
  const compass = degreesToCompass(r?.wind_dir_deg ?? null)
  const arrow = windArrow(r?.wind_dir_deg ?? null)
  const age = readingAge(r?.created_at ?? null)
  const isRecent = r?.created_at && (Date.now() - new Date(r.created_at).getTime()) < 30 * 60 * 1000

  const wsBatV = r?.battery_mv ? (r.battery_mv as number) / 1000 : null
  const nodeBatV = r?.esp_battery_v as number | null
  const batLow = (wsBatV != null && wsBatV < 2.4) || (nodeBatV != null && nodeBatV < 3.7)

  const cropName = station.crop_types?.crop_name
  const variety = station.crop_types?.variety

  const s = {
    contactName: (settings as any)?.contact_name ?? 'Michael Pankhurst',
    contactEmail: (settings as any)?.contact_email ?? 'info@weatherwrangler.net',
    contactPhone: (settings as any)?.contact_phone ?? '+61 422 490 254',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#1c1326', color: '#f7f1ea', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 32px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Header */}
        <div style={{ background: '#271b38', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #3f2c57' }}>
          <img src="/Logo.png" alt="Weather Wrangler" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 10, color: '#a896c0', letterSpacing: 1, textTransform: 'uppercase' }}>Weather Wrangler</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Live station data</div>
          </div>
        </div>

        {/* Paddock name */}
        <div style={{ padding: '16px 16px 8px' }}>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{station.paddock_name ?? station.id}</div>
          <div style={{ fontSize: 12, color: '#a896c0', marginTop: 2 }}>
            {age} <span style={{ color: isRecent ? '#4ade80' : '#f97316' }}>●</span>
          </div>
        </div>

        {/* Battery warning */}
        {batLow && (
          <div style={{ margin: '0 16px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ef4444' }}>
            ⚠️ Station battery low — readings may stop soon
          </div>
        )}

        {/* Live readings */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '8px 16px' }}>
          <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{r?.temperature_c != null ? `${parseFloat(String(r.temperature_c)).toFixed(1)}°` : '—'}</div>
            <div style={{ fontSize: 10, color: '#a896c0', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Temperature</div>
          </div>
          <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{r?.humidity != null ? `${r.humidity}%` : '—'}</div>
            <div style={{ fontSize: 10, color: '#a896c0', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Humidity</div>
          </div>
          <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{r?.wind_avg_ms != null ? `${(parseFloat(String(r.wind_avg_ms)) * 3.6).toFixed(0)}` : '—'}<span style={{ fontSize: 14 }}> km/h</span></div>
            {r?.wind_dir_deg != null && <div style={{ fontSize: 11, color: '#f2762a', marginTop: 1 }}>{arrow} {compass}</div>}
            <div style={{ fontSize: 10, color: '#a896c0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Wind</div>
          </div>
          <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{dailyRain != null ? `${dailyRain.toFixed(1)}` : '—'}<span style={{ fontSize: 14 }}> mm</span></div>
            <div style={{ fontSize: 10, color: '#a896c0', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Rain today</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ margin: '12px 16px', borderTop: '1px solid #3f2c57' }} />

        {/* Subscription preview */}
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ fontSize: 11, color: '#a896c0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>With a subscription you also get</div>

          {/* Spray window — visible */}
          <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#a896c0' }}>Spray window</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#4ade80' }}>Good to spray 🟢</span>
          </div>

          {/* Frost risk — blurred */}
          <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 10, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5, filter: 'blur(1.5px)', userSelect: 'none' }}>
            <span style={{ fontSize: 13, color: '#a896c0' }}>Frost risk</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Frost watch 🟡</span>
          </div>

          {/* GDD — blurred */}
          {cropName && (
            <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 10, padding: '10px 12px', marginBottom: 6, opacity: 0.5, filter: 'blur(1.5px)', userSelect: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#a896c0' }}>{cropName}{variety ? ` (${variety})` : ''}</span>
                <span style={{ fontSize: 12, color: '#a896c0' }}>847 / 1420 GDD</span>
              </div>
              <div style={{ height: 6, background: '#3f2c57', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: '60%', height: '100%', background: '#f2762a', borderRadius: 3 }} />
              </div>
            </div>
          )}

          {/* Lock badge */}
          <div style={{ background: '#3f2c57', borderRadius: 8, padding: '8px 12px', textAlign: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#a896c0' }}>🔒 Subscribe to unlock frost risk, GDD, N budget, agronomy and more</span>
          </div>
        </div>

        {/* What's included */}
        <div style={{ margin: '0 16px', background: '#271b38', border: '1px solid #3f2c57', borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>What's included</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {['Real-time weather', 'Spray windows', 'Frost & heat alerts', 'GDD & harvest est.', 'N budget & agronomy', 'Monthly report'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#a896c0' }}>
                <span style={{ color: '#4ade80' }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ background: '#271b38', border: '1px solid #3f2c57', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{s.contactName}</div>
            <a href={'tel:' + s.contactPhone} style={{ display: 'block', fontSize: 20, fontWeight: 700, color: '#f2762a', textDecoration: 'none', marginBottom: 4 }}>{s.contactPhone}</a>
            <a href={'mailto:' + s.contactEmail} style={{ fontSize: 12, color: '#a896c0', textDecoration: 'none' }}>{s.contactEmail}</a>
          </div>
        </div>

      </div>
    </div>
  )
}
