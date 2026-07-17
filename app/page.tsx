import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { signOut } from '@/auth'
import GddCard from '@/components/GddCard'
import ETSparkline from '@/components/ETSparkline'
import { getDailyAvgTemps, getDailyRainWithRate, getRainStats, getDailyAvgTempsWithGapFill } from '@/lib/gdd'
import { degreesToCompass, windArrow, rainVariance } from '@/lib/wind'
import { getDailyET, get7DayET } from '@/lib/et'
import { assessFieldDampness } from '@/lib/fieldDampness'
import { getSprayWindow } from '@/lib/sprayWindow'
import { getFrostRisk } from '@/lib/frostRisk'
import { getHeatStress } from '@/lib/heatStress'
import { assessDiseaseRisk } from '@/lib/diseaseRisk'
import { assessFireRisk } from '@/lib/fireRisk'
import { getSubscriptionStatus, canAccessFeature } from '@/lib/subscription'
import SubscriptionBanner from '@/components/SubscriptionBanner'
import LockedFeature from '@/components/LockedFeature'

const toNum = (v: any): number | null => v == null ? null : parseFloat(String(v))

function wsStatus(mv: number | null) {
  if (mv == null) return { color: '#a896c0', label: 'No data', volts: null }
  const v = mv / 1000
  const pct = Math.round(Math.max(0, Math.min(100, (v / 6) * 100)))
  if (v >= 2.4) return { color: '#f2762a', label: `${pct}%`, volts: v }
  if (v >= 2.0) return { color: '#facc15', label: `${pct}% — low`, volts: v }
  return { color: '#ef4444', label: `${pct}% — critical`, volts: v }
}

function espStatus(v: number | null) {
  if (v == null) return { color: '#a896c0', label: 'No data', volts: null }
  const pct = Math.round(Math.max(0, Math.min(100, ((v - 3.0) / (4.2 - 3.0)) * 100)))
  if (v >= 3.95) return { color: '#f2762a', label: `${pct}%`, volts: v }
  if (v >= 3.7) return { color: '#b182ff', label: `${pct}%`, volts: v }
  if (v >= 3.4) return { color: '#facc15', label: `${pct}% — low`, volts: v }
  return { color: '#ef4444', label: `${pct}% — critical`, volts: v }
}

function solarStatus(v: number | null) {
  if (v == null) return { color: '#a896c0', label: 'No data' }
  if (v >= 3.5) return { color: '#4ade80', label: '🟢 Charging well' }
  if (v >= 2.0) return { color: '#facc15', label: '🟡 Charging' }
  if (v >= 0.1) return { color: '#f97316', label: '🟡 Partial' }
  return { color: '#a896c0', label: '⚫ No light' }
}

function readingAge(createdAt: Date | null) {
  if (!createdAt) return { text: 'No readings yet', color: '#a896c0', dot: '#6b5a80' }
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
  const dot = diffMin > 1440 ? '#ef4444' : diffMin > 60 ? '#facc15' : '#4ade80'
  const color = diffMin > 1440 ? '#ef4444' : diffMin > 60 ? '#facc15' : '#a896c0'
  return { text: `${formatted} · ${relative}`, color, dot }
}

export default async function Dashboard() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const isAdmin = (session.user as any).email === 'mdpankhurst@gmail.com'

  const farmer = await prisma.farmers.findUnique({
    where: { id: (session.user as any).id },
    select: { tier: true, subscription_expires_at: true },
  })

  const subStatus = getSubscriptionStatus(
    farmer?.tier ?? 'base',
    (farmer as any)?.subscription_expires_at ?? null
  )

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
            {stations.length} station{stations.length !== 1 ? 's' : ''} · tap any reading for weather history
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/guide" style={{ border: '1px solid var(--text-muted)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Guide</Link>
          <Link href="/methodology" style={{ border: '1px solid var(--text-muted)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Methodology</Link>
          <form action={async () => { 'use server'; await signOut({ redirectTo: '/login' }) }}>
            <button type="submit" style={{ border: '1px solid var(--text-muted)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, background: 'none', cursor: 'pointer' }}>Sign out</button>
          </form>
          <Link href="/report" style={{ border: '1px solid var(--text-muted)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Report</Link>
          <Link href="/forecast" style={{ border: '1px solid var(--purple)', color: 'var(--purple)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Forecast</Link>
          {canAccessFeature(subStatus, 'pro') ? (
            <Link href="/agronomy" style={{ border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Agronomy</Link>
          ) : (
            <span style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'default' }} title="Requires Pro plan — contact info@weatherwrangler.net">Agronomy 🔒</span>
          )}
          {canAccessFeature(subStatus, 'pro') ? (
            <Link href="/nitrogen" style={{ border: '1px solid var(--purple)', color: 'var(--purple)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Nitrogen</Link>
          ) : (
            <span style={{ border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'default' }} title="Requires Pro plan — contact info@weatherwrangler.net">Nitrogen 🔒</span>
          )}
          {isAdmin && <Link href="/admin" style={{ border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Admin</Link>}
        </div>
      </div>

      <SubscriptionBanner
        daysUntilExpiry={subStatus.daysUntilExpiry}
        daysOverdue={subStatus.daysOverdue}
        isGrace={subStatus.isGrace}
        tier={subStatus.tier}
      />

      {stations.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No paddocks assigned yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {await Promise.all(stations.map(async s => {
            // Use borrowed station readings if this paddock has no own readings
            let r = s.weather_readings[0]
            let borrowedFrom: string | null = null
            if (!r && (s as any).borrowed_station_id) {
              const borrowed = await prisma.weather_readings.findFirst({
                where: { station_id: (s as any).borrowed_station_id },
                orderBy: { created_at: 'desc' },
              })
              if (borrowed) {
                r = borrowed as any
                borrowedFrom = (s as any).borrowed_station_id
              }
            }
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
              hourAgo,
            ] = await Promise.all([
              getDailyRainWithRate(s.id, prisma),
              (() => {
                const earliestPlanting = [s.planted_date, ...s.zones.map(z => z.planted_date)]
                  .filter((d): d is Date => d != null)
                  .sort((a, b) => a.getTime() - b.getTime())[0]
                return earliestPlanting
                  ? getDailyAvgTempsWithGapFill(s.id, earliestPlanting, s.latitude ?? null, s.longitude ?? null, prisma)
                  : Promise.resolve([])
              })(),
              getDailyET(s.id, s.elevation_m ?? null, s.latitude ?? null, prisma),
              get7DayET(s.id, s.elevation_m ?? null, s.latitude ?? null, prisma),
              getRainStats(s.id, prisma),
              prisma.weather_readings.findFirst({
                where: { station_id: s.id, created_at: { lte: new Date(Date.now() - 60 * 60 * 1000) } },
                orderBy: { created_at: 'desc' },
                select: { temperature_c: true, humidity: true },
              }),
            ])

            const variance = dailyRain != null ? rainVariance(dailyRain, avgRateMMH) : null
            const hour = r?.created_at
              ? parseInt(new Date(r.created_at).toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', hour12: false }))
              : new Date().getHours()

            const spray = getSprayWindow(r?.temperature_c ?? null, r?.humidity ?? null, r?.wind_avg_ms ?? null, r?.wind_max_ms ?? null, hour)
            const frost = getFrostRisk(r?.temperature_c ?? null, r?.humidity ?? null, cropFrostTemp, hour)
            const dampness = assessFieldDampness(rainStats.rainLast24h, rainStats.rainLast72h, rainStats.daysSinceLastRain, todayET?.etoMmDay ?? null, s.soil_type ?? null, r?.temperature_c ?? null)
            const heat = s.crop_types ? getHeatStress(r?.temperature_c ?? null, s.growth_stage ?? null) : null
            const gddProgress = cropTargetGdd > 0 ? (totalGdd / cropTargetGdd) : null
            const fireRisk = assessFireRisk(
              r?.temperature_c != null ? parseFloat(String(r.temperature_c)) : null,
              r?.humidity != null ? parseFloat(String(r.humidity)) : null,
              windKmh,
              gddProgress
            )

            const disease = assessDiseaseRisk(r?.temperature_c ?? null, r?.humidity ?? null, rainStats.rainLast24h, s.crop_types?.crop_name ?? null)

            const sprayIcon = spray.overall === 'go' ? '🟢' : spray.overall === 'caution' ? '🟡' : '🔴'
            const frostIcon = frost.risk === 'none' ? '🟢' : frost.risk === 'watch' ? '🟡' : '🔴'
            const deltaTIcon = spray.deltaT != null ? (spray.deltaT >= 2 && spray.deltaT <= 8 ? '🟢' : spray.deltaT <= 10 ? '🟡' : '🔴') : '—'

            const S = { padding: '0 20px 20px' }

            return (
              <div key={s.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Link href={`/station/${s.id}`} className="paddock-link">
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{s.paddock_name ?? s.id}</div>
                    </Link>
                    <div style={{ fontSize: 12, color: age.color, marginTop: 3 }}>{age.text}</div>
                  {borrowedFrom && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>📡 Weather from {borrowedFrom}</div>}
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: age.dot, marginTop: 6 }} />
                </div>

                {/* Weather strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', margin: '12px 0 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                  {[
                    { href: `/station/${s.id}/history?metric=temp`, value: r?.temperature_c != null ? `${r.temperature_c.toFixed(1)}°` : '—', sub: (() => { const p = hourAgo?.temperature_c != null ? parseFloat(String(hourAgo.temperature_c)) : null; const c = r?.temperature_c != null ? parseFloat(String(r.temperature_c)) : null; if (!p || !c) return ''; const d = c - p; return d > 0.5 ? '↑' : d < -0.5 ? '↓' : '→'; })(), label: 'Temp' },
                    { href: `/station/${s.id}/history?metric=humidity`, value: r?.humidity != null ? `${r.humidity}%` : '—', sub: (() => { const p = hourAgo?.humidity != null ? parseFloat(String(hourAgo.humidity)) : null; const c = r?.humidity != null ? parseFloat(String(r.humidity)) : null; if (!p || !c) return ''; const d = c - p; return d > 2 ? '↑' : d < -2 ? '↓' : '→'; })(), label: 'Humidity' },
                    { href: `/station/${s.id}/history?metric=wind`, value: windKmh ? `${windKmh} km/h` : '—', sub: windKmh ? `${arrow} ${compass}` : '', label: 'Wind' },
                    { href: `/station/${s.id}/history?metric=rain`, value: dailyRain != null ? `${dailyRain.toFixed(1)} mm` : '—', sub: variance?.label ?? '', label: 'Today' },
                  ].map((cell, i) => (
                    <Link key={i} href={cell.href} style={{ textDecoration: 'none', color: 'inherit', padding: '12px 8px', textAlign: 'center', borderRight: i < 3 ? '1px solid var(--border)' : 'none', display: 'block' }}>
                      <div style={{ fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cell.value}</div>
                      {cell.sub && <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 2 }}>{cell.sub}</div>}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{cell.label}</div>
                    </Link>
                  ))}
                </div>

                {/* Power strip */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.2)' }}>
                  {[
                    { value: ws.label, sub: ws.volts ? `${ws.volts.toFixed(2)}V` : '', label: 'WS battery', color: ws.color },
                    { value: esp.label, sub: esp.volts ? `${esp.volts.toFixed(2)}V` : '', label: 'Node battery', color: esp.color },
                    { value: solar.label, sub: r?.solar_v != null ? `${(r.solar_v as number).toFixed(2)}V` : '', label: 'Solar', color: solar.color },
                  ].map((cell, i) => (
                    <div key={i} style={{ flex: 1, padding: '8px 12px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: cell.color }}>{cell.value}{cell.sub ? ` · ${cell.sub}` : ''}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{cell.label}</div>
                    </div>
                  ))}
                </div>

                {/* Field conditions list */}
                <div style={{ padding: '12px 20px 0' }}>
                  <div style={{ fontSize: 10, color: '#6b5a80', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontWeight: 500 }}>Field conditions</div>
                </div>
                <div style={{ margin: '0 20px', background: 'rgba(0,0,0,0.2)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 12 }}>
                  {[
                    { name: 'Evapotranspiration', value: todayET ? `${todayET.etoMmDay} mm/day` : '—', status: null, detail: null, extra: <ETSparkline points={etHistory} /> },
                    { name: 'Delta T', value: spray.deltaT != null ? `${spray.deltaT.toFixed(1)}°C` : '—', status: deltaTIcon, detail: null, subDetail: spray.deltaT != null ? (spray.deltaT < 2 ? '2–8°C optimal range — current too low' : spray.deltaT > 8 ? '2–8°C optimal range — current too high' : '2–8°C optimal') : null },
                    { name: 'Spray window', subDetail: spray.overall !== 'go' ? spray.conditions.filter(c => c.status !== 'go').map(c => `${c.label}: ${c.value} (${c.reason})`).join(' · ') : null, value: spray.overall === 'go' ? 'Good to spray' : spray.overall === 'caution' ? 'Spray with caution' : 'Do not spray', status: sprayIcon, detail: null },
                    { name: 'Frost risk', value: frost.risk === 'none' ? 'No frost risk' : frost.risk === 'watch' ? 'Frost watch' : frost.risk === 'warning' ? 'Frost warning' : 'Frost!', status: frostIcon, detail: null },
                    { name: 'Field trafficability', value: dampness.level === 'dry' ? 'Drive OK' : dampness.level === 'damp' ? 'Proceed with caution' : 'Do not drive', status: dampness.icon, detail: null, subDetail: dampness.reason },
                    ...(disease.isCereal ? [{ name: 'Disease risk', value: disease.label, status: disease.icon, detail: disease.diseases.length > 0 ? disease.diseases.map(d => d.name).join(', ') : null }] : []),
                    ...(fireRisk.show ? [{ name: '🔥 Fire risk', value: fireRisk.label, status: fireRisk.level === 'high' ? '🔴' : fireRisk.level === 'elevated' ? '🟡' : '🟢', detail: null, subDetail: fireRisk.level !== 'low' ? fireRisk.detail : null }] : []),
                    ...(heat && heat.level !== 'none' ? [{ name: 'Heat stress', value: heat.label, status: heat.level === 'severe' ? '🔴' : '🟡', detail: heat.reason }] : []),
                  ].map((row, i, arr) => (
                    <div key={i} style={{ padding: '9px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{row.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>{row.value}</div>
                      {row.extra && <div style={{ marginLeft: 4 }}>{row.extra}</div>}
                      {row.status && <div style={{ fontSize: 13, marginLeft: 4, flexShrink: 0 }}>{row.status}</div>}
                      {row.detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }} title={row.detail}>· {row.detail}</div>}
                      </div>
                      {(row as any).subDetail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, paddingLeft: 0 }}>{(row as any).subDetail}</div>}
                    </div>
                  ))}
                </div>

                {/* Crop progress */}
                {(s.crop_types && s.planted_date) || s.zones.some(z => z.crop_types && z.planted_date) ? (
                  <div style={{ padding: '0 20px 16px' }}>
                    <div style={{ fontSize: 10, color: '#6b5a80', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 500 }}>Crop progress</div>
                    {s.crop_types && s.planted_date && (
                      <GddCard
                        title={`🌱 ${s.crop_types.crop_name} (${s.crop_types.variety})`}
                        baseTemp={cropBaseTemp}
                        target={cropTargetGdd}
                        dailyAvgTemps={dailyAvgTemps}
                        plantedDate={s.planted_date}
                      />
                    )}
                    {s.zones.filter(z => z.crop_types && z.planted_date).map(z => {
                      const zBaseTemp = toNum(z.crop_types?.base_temp_gdd)
                      const zTargetGdd = toNum(z.crop_types?.target_gdd_harvest)
                      return (
                        <div key={z.id} style={{ marginTop: 10 }}>
                          <GddCard
                            title={`🌱 ${z.name} — ${z.crop_types!.crop_name} (${z.crop_types!.variety})`}
                            baseTemp={zBaseTemp}
                            target={zTargetGdd}
                            dailyAvgTemps={dailyAvgTemps}
                            plantedDate={z.planted_date}
                          />
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div style={{ height: 16 }} />
                )}
              </div>
            )
          }))}
        </div>
      )}
    </div>
  )
}
