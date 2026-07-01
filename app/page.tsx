import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import GddCard from '@/components/GddCard'
import { getDailyAvgTemps, getDailyRain } from '@/lib/gdd'

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
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
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
    include: {
      weather_readings: { orderBy: { created_at: 'desc' }, take: 1 },
      crop_types: true,
      zones: { include: { crop_types: true }, orderBy: { created_at: 'asc' } },
    },
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
          <Link href="/admin" style={{ border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
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
          {await Promise.all(stations.map(async s => {
            const r = s.weather_readings[0]
            const ws = wsStatus(r?.battery_mv ?? null)
            const esp = espStatus(r?.esp_battery_v ?? null)
            const solar = solarStatus(r?.solar_v ?? null)
            const age = readingAge(r?.created_at ?? null)

            const [dailyRain, dailyAvgTemps] = await Promise.all([
              getDailyRain(s.id, prisma),
              (() => {
                const earliestPlanting = [s.planted_date, ...s.zones.map(z => z.planted_date)]
                  .filter((d): d is Date => d != null)
                  .sort((a, b) => a.getTime() - b.getTime())[0]
                return earliestPlanting ? getDailyAvgTemps(s.id, earliestPlanting, prisma) : Promise.resolve([])
              })(),
            ])

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
                  <Stat href={`/station/${s.id}/rain`} icon="🌧️" label="Today" value={dailyRain != null ? `${dailyRain.toFixed(1)} mm` : '—'} />
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

                {s.crop_types && s.planted_date && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
                    <GddCard
                      title={`🌱 ${s.crop_types.crop_name} (${s.crop_types.variety})`}
                      baseTemp={s.crop_types.base_temp_gdd}
                      target={s.crop_types.target_gdd_harvest}
                      dailyAvgTemps={dailyAvgTemps}
                      plantedDate={s.planted_date}
                    />
                  </div>
                )}

                {s.zones.filter(z => z.crop_types && z.planted_date).map(z => (
                  <div key={z.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
                    <GddCard
                      title={`🌱 ${z.name} — ${z.crop_types!.crop_name} (${z.crop_types!.variety})`}
                      baseTemp={z.crop_types!.base_temp_gdd}
                      target={z.crop_types!.target_gdd_harvest}
                      dailyAvgTemps={dailyAvgTemps}
                      plantedDate={z.planted_date}
                    />
                  </div>
                ))}
              </div>
            )
          }))}
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
