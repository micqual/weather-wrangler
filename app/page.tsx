import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

function wsStatus(mv: number | null) {
  if (mv == null) return { color: 'var(--text-muted)', label: 'No data', volts: null }
  const v = mv / 1000
  const pct = Math.round(Math.max(0, Math.min(100, (v / 6) * 100)))
  if (v >= 2.4) return { color: 'var(--orange)', label: `${pct}%`, volts: v }
  if (v >= 2.0) return { color: 'var(--amber)', label: `${pct}% — low`, volts: v }
  return { color: 'var(--red)', label: `${pct}% — critical`, volts: v }
}

function espStatus(v: number | null) {
  if (v == null) return { color: 'var(--text-muted)', label: 'No data', volts: null }
  const pct = Math.round(Math.max(0, Math.min(100, ((v - 3.0) / (4.2 - 3.0)) * 100)))
  if (v >= 3.95) return { color: 'var(--orange)', label: `${pct}%`, volts: v }
  if (v >= 3.7) return { color: 'var(--purple)', label: `${pct}%`, volts: v }
  if (v >= 3.4) return { color: 'var(--amber)', label: `${pct}% — low`, volts: v }
  return { color: 'var(--red)', label: `${pct}% — critical`, volts: v }
}

function solarStatus(v: number | null) {
  if (v == null) return { color: 'var(--text-muted)', label: 'No data' }
  if (v >= 0.15) return { color: 'var(--orange)', label: 'Charging' }
  return { color: 'var(--purple)', label: 'Low light' }
}

function readingAge(createdAt: Date | null) {
  if (!createdAt) return { text: 'No readings yet', color: 'var(--text-muted)' }
  const date = new Date(createdAt)
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000)

  const relative =
    diffMin < 1 ? 'just now'
    : diffMin < 60 ? `${diffMin}m ago`
    : diffMin < 1440 ? `${Math.round(diffMin / 60)}h ago`
    : `${Math.round(diffMin / 1440)}d ago`

  const formatted = date.toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  const color = diffMin > 1440 ? 'var(--red)' : diffMin > 60 ? 'var(--amber)' : 'var(--text-muted)'

  return { text: `${formatted} · ${relative}`, color }
}

export default async function Dashboard() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const isAdmin = (session.user as any).email === 'mdpankhurst@gmail.com'

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: { weather_readings: { orderBy: { created_at: 'desc' }, take: 1 } },
  })

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            My <span style={{ color: 'var(--orange)' }}>Paddocks</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            {stations.length} station{stations.length !== 1 ? 's' : ''} · click any reading for its 48h history
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin"
            style={{
              border: '1px solid var(--orange)',
              color: 'var(--orange)',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Admin
          </Link>
        )}
      </div>

      {stations.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No paddocks assigned yet.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {stations.map(s => {
            const r = s.weather_readings[0]
            const ws = wsStatus(r?.battery_mv ?? null)
            const esp = espStatus(r?.esp_battery_v ?? null)
            const solar = solarStatus(r?.solar_v ?? null)
            const age = readingAge(r?.created_at ?? null)
            return (
              <div key={s.id} className="card" style={{ padding: 20 }}>
                <Link href={`/station/${s.id}`} className="paddock-link">
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{s.paddock_name ?? s.id}</h3>
                </Link>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: age.color }}>{age.text}</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                  <Stat href={`/station/${s.id}/temp`} icon="🌡️" label="Temp" value={r?.temperature_c != null ? `${r.temperature_c.toFixed(1)}°` : '—'} />
                  <Stat href={`/station/${s.id}/humidity`} icon="💧" label="Humidity" value={r?.humidity != null ? `${r.humidity}%` : '—'} />
                  <Stat href={`/station/${s.id}/wind`} icon="💨" label="Wind" value={r?.wind_avg_ms != null ? `${(r.wind_avg_ms * 3.6).toFixed(0)} km/h` : '—'} />
                  <Stat href={`/station/${s.id}/rain`} icon="🌧️" label="Rain" value={r?.rain_mm != null ? `${r.rain_mm.toFixed(1)} mm` : '—'} />
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ color: ws.color, fontWeight: 600, fontSize: 14 }}>🔋 {ws.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      WS{ws.volts != null ? ` · ${ws.volts.toFixed(2)}V` : ''}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: esp.color, fontWeight: 600, fontSize: 14 }}>🔋 {esp.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Node{esp.volts != null ? ` · ${esp.volts.toFixed(2)}V` : ''}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: solar.color, fontWeight: 600, fontSize: 14 }}>☀️ {solar.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Solar</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ href, icon, label, value }: { href: string; icon: string; label: string; value: string }) {
  return (
    <Link href={href} className="stat-link" style={{ border: '1px solid var(--orange)', padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{icon} {value}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </Link>
  )
}
