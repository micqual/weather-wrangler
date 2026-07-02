import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import GddCard from '@/components/GddCard'
import ETSparkline from '@/components/ETSparkline'
import { getDailyAvgTemps, getDailyRainWithRate, getRainStats } from '@/lib/gdd'
import { degreesToCompass, windArrow, rainVariance } from '@/lib/wind'
import { getDailyET, get7DayET } from '@/lib/et'
import { assessFieldDampness } from '@/lib/fieldDampness'
import { getSprayWindow } from '@/lib/sprayWindow'
import { getFrostRisk } from '@/lib/frostRisk'
import { getHeatStress } from '@/lib/heatStress'
import { assessDiseaseRisk } from '@/lib/diseaseRisk'

const toNum = (v: any): number | null => v == null ? null : parseFloat(String(v))

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
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/nitrogen" style={{ border: '1px solid var(--purple)', color: 'var(--purple)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Nitrogen
          </Link>
          {isAdmin && (
            <Link href="/admin" style={{ border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              Admin
            </Link>
          )}
        </div>
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
            const compass = degreesToCompass(r?.wind_dir_deg ?? null)
            const arrow = windArrow(r?.wind_dir_deg ?? null)
            const windKmh = r?.wind_avg_ms != null ? (r.wind_avg_ms * 3.6).toFixed(0) : null

            const cropBaseTemp = toNum(s.crop_types?.base_temp_gdd)
            const cropTargetGdd = toNum(s.crop_types?.target_gdd_harvest)
            const cropFrostTemp = toNum(s.crop_types?.frost_alert_temp)

            const [
              { rainMm: dailyRain, avgRateMMH },
              dailyAvgTemps,
              todayET,
              etHistory,
              rainStats,
            ] = await Promise.all([
              getDailyRainWithRate(s.id, prisma),
              (() => {
                const earliestPlanting = [s.planted_date, ...s.zones.map(z => z.planted_date)]
                  .filter((d): d is Date => d != null)
                  .sort((a, b) => a.getTime() - b.getTime())[0]
                return earliestPlanting ? getDailyAvgTemps(s.id, earliestPlanting, prisma) : Promise.resolve([])
              })(),
              getDailyET(s.id, s.elevation_m ?? null, s.latitude ?? null, prisma),
              get7DayET(s.id, s.elevation_m ?? null, s.latitude ?? null, prisma),
              getRainStats(s.id, prisma),
            ])

            const variance = dailyRain != null ? rainVariance(dailyRain, avgRateMMH) : null
            const hour = r?.created_at
              ? parseInt(new Date(r.created_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', hour12: false }))
              : new Date().getHours()

            const spray = getSprayWindow(r?.temperature_c ?? null, r?.humidity ?? null, r?.wind_avg_ms ?? null, r?.wind_max_ms ?? null, hour)
            const frost = getFrostRisk(r?.temperature_c ?? null, r?.humidity ?? null, cropFrostTemp, hour)
            const dampness = assessFieldDampness(rainStats.rainLast24h, rainStats.rainLast72h, rainStats.daysSinceLastRain, todayET?.etoMmDay ?? null, s.soil_type ?? null, r?.temperature_c ?? null)
            const heat = s.crop_types ? getHeatStress(r?.temperature_c ?? null, s.growth_stage ?? null) : null
            const disease = assessDiseaseRisk(r?.temperature_c ?? null, r?.humidity ?? null, rainStats.rainLast24h, s.crop_types?.crop_name ?? null)

            const sprayIcon = spray.overall === 'go' ? '🟢' : spray.overall === 'caution' ? '🟡' : '🔴'
            const frostIcon = frost.risk === 'none' ? '🟢' : frost.risk === 'watch' ? '🟡' : '🔴'

            return (
              <div key={s.id} className="card" style={{ padding: 20 }}>
                <Link href={`/station/${s.id}`} className="paddock-link">
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>{s.paddock_name ?? s.id}</h3>
                </Link>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: age.color }}>{age.text}</p>

                {/* Weather stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                  <Stat href={`/station/${s.id}/temp`} icon="🌡️" label="Temp" value={r?.temperature_c != null ? `${r.temperature_c.toFixed(1)}°` : '—'} />
                  <Stat href={`/station/${s.id}/humidity`} icon="💧" label="Humidity" value={r?.humidity != null ? `${r.humidity}%` : '—'} />
                  <div>
                    <Link href={`/station/${s.id}/wind`} className="stat-link" style={{ border: '1px solid var(--orange)', padding: '10px 6px', textAlign: 'center', display: 'block', borderRadius: 10 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>💨 {windKmh ?? '—'} km/h</div>
                      <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 2 }}>{arrow} {compass}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Wind</div>
                    </Link>
                  </div>
                  <Link href={`/station/${s.id}/rain`} className="stat-link" style={{ border: '1px solid var(--orange)', padding: '10px 6px', textAlign: 'center', borderRadius: 10 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>🌧️ {dailyRain != null ? `${dailyRain.toFixed(1)} mm` : '—'}</div>
                    {variance?.label && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{variance.label}</div>}
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Today</div>
                  </Link>
                </div>

                {/* Power */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ color: ws.color, fontWeight: 600, fontSize: 14 }}>🔋 {ws.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>WS{ws.volts != null ? ` · ${ws.volts.toFixed(2)}V` : ''}</div>
                  </div>
                  <div>
                    <div style={{ color: esp.color, fontWeight: 600, fontSize: 14 }}>🔋 {esp.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Node{esp.volts != null ? ` · ${esp.volts.toFixed(2)}V` : ''}</div>
                  </div>
                  <div>
                    <div style={{ color: solar.color, fontWeight: 600, fontSize: 14 }}>☀️ {solar.label}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Solar</div>
                  </div>
                </div>

                {/* Alert cards row 1 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 10 }}>
                  <AlertCard border="var(--orange)" icon="💧" value={todayET != null ? `${todayET.etoMmDay} mm` : '—'} sub={<ETSparkline points={etHistory} />} label="ET/day" />
                  <AlertCard border="var(--orange)" icon={sprayIcon} value={spray.overall === 'go' ? 'Spray' : spray.overall === 'caution' ? 'Caution' : 'No spray'} label="Spray" title={spray.conditions.map(c => `${c.label}: ${c.value}`).join(' · ')} />
                  <AlertCard border="var(--orange)" icon={frostIcon} value={frost.risk === 'none' ? 'No frost' : frost.risk === 'watch' ? 'Watch' : 'Warning'} label="Frost" title={frost.reason ?? undefined} />
                  <AlertCard border="var(--orange)" icon={`🚜 ${dampness.icon}`} value={dampness.level === 'dry' ? 'Drive OK' : dampness.level === 'damp' ? 'Caution' : 'Too wet'} label="Field" title={dampness.reason} />
                </div>

                {/* Disease risk card — full width, shows disease names */}
                {disease.isCereal && (
                  <div style={{ border: '1px solid var(--orange)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Disease risk</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{disease.icon} {disease.label}</span>
                    </div>
                    {disease.diseases.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {disease.diseases.map(d => (
                          <span key={d.name} title={d.reason} style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 12,
                            background: d.level === 'high' ? 'rgba(239,68,68,0.1)' : 'rgba(250,204,21,0.1)',
                            color: d.level === 'high' ? '#f87171' : '#fbbf24',
                            cursor: 'default',
                          }}>
                            {d.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {disease.diseases.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>No significant disease conditions</div>
                    )}
                  </div>
                )}

                {/* Heat stress — only when relevant */}
                {heat && heat.level !== 'none' && (
                  <div style={{ border: '1px solid var(--orange)', borderRadius: 10, padding: '8px 12px', marginBottom: 16, fontSize: 13 }}>
                    <span style={{ fontWeight: 600 }}>{heat.level === 'severe' ? '🔴' : '🟡'} {heat.label}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>{heat.reason}</span>
                  </div>
                )}

                {/* GDD */}
                {s.crop_types && s.planted_date && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <GddCard
                      title={`🌱 ${s.crop_types.crop_name} (${s.crop_types.variety})`}
                      baseTemp={cropBaseTemp}
                      target={cropTargetGdd}
                      dailyAvgTemps={dailyAvgTemps}
                      plantedDate={s.planted_date}
                    />
                  </div>
                )}

                {s.zones.filter(z => z.crop_types).map(z => {
                  const zBaseTemp = toNum(z.crop_types?.base_temp_gdd)
                  const zTargetGdd = toNum(z.crop_types?.target_gdd_harvest)
                  return (
                    <div key={z.id}>
                      {z.planted_date && (
                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 10 }}>
                          <GddCard
                            title={`🌱 ${z.name} — ${z.crop_types!.crop_name} (${z.crop_types!.variety})`}
                            baseTemp={zBaseTemp}
                            target={zTargetGdd}
                            dailyAvgTemps={dailyAvgTemps}
                            plantedDate={z.planted_date}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
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

function AlertCard({ border, icon, value, sub, label, title }: {
  border: string
  icon: string
  value: string
  sub?: React.ReactNode
  label: string
  title?: string
}) {
  return (
    <div title={title} style={{ border: `1px solid ${border}`, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{icon} {value}</div>
      {sub && <div style={{ marginTop: 2 }}>{sub}</div>}
      <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  )
}
