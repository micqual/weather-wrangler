import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { calculateDeltaT } from '@/lib/sprayWindow'

export const dynamic = 'force-dynamic'

// Compare each station's measured Delta T with the Open-Meteo model for the same hours (last 7 days),
// so we can see how far the forecast is off for that paddock.
type Row = { key: string; sT: number; sRH: number; sDT: number; fT: number; fRH: number; fDT: number; diff: number }

const hourKey = (d: Date) => new Date(d.getTime() + 30 * 60000).toLocaleString('sv-SE', { timeZone: 'Australia/Melbourne' }).slice(0, 13)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const f1 = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}`)

export default async function DeltaTCalibrationPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).email !== 'mdpankhurst@gmail.com') redirect('/')

  const { station: selectedId } = await searchParams
  const stations = await prisma.stations.findMany({
    orderBy: { paddock_name: 'asc' },
    select: { id: true, paddock_name: true, latitude: true, longitude: true, borrowed_station_id: true },
  })
  const station = stations.find(s => s.id === selectedId) ?? null

  let rows: Row[] = []
  let error: string | null = null

  if (station) {
    const dataId = station.borrowed_station_id ?? station.id
    const src = station.borrowed_station_id ? stations.find(s => s.id === station.borrowed_station_id) : station
    const lat = src?.latitude ?? station.latitude
    const lon = src?.longitude ?? station.longitude

    if (lat == null || lon == null) {
      error = 'This station has no latitude/longitude, so there is no forecast to compare against.'
    } else {
      const since = new Date(Date.now() - 7 * 86400000)
      const readings = await prisma.weather_readings.findMany({
        where: { station_id: dataId, created_at: { gte: since }, temperature_c: { not: null }, humidity: { not: null } },
        orderBy: { created_at: 'asc' },
        select: { created_at: true, temperature_c: true, humidity: true },
      })

      // Average station readings into hourly buckets (nearest hour, Melbourne time)
      const buckets = new Map<string, { t: number[]; rh: number[] }>()
      for (const r of readings) {
        if (!r.created_at) continue
        const k = hourKey(new Date(r.created_at))
        const b = buckets.get(k) ?? { t: [], rh: [] }
        b.t.push(Number(r.temperature_c))
        b.rh.push(Number(r.humidity))
        buckets.set(k, b)
      }

      const params = new URLSearchParams({
        latitude: String(lat), longitude: String(lon),
        hourly: 'temperature_2m,relative_humidity_2m',
        timezone: 'Australia/Melbourne', past_days: '7', forecast_days: '1',
      })
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: 'no-store' })
        const h = res.ok ? (await res.json())?.hourly : null
        if (!h?.time) throw new Error('no data')
        for (let i = 0; i < h.time.length; i++) {
          const k = String(h.time[i]).replace('T', ' ').slice(0, 13)
          const b = buckets.get(k)
          const fT = h.temperature_2m?.[i], fRH = h.relative_humidity_2m?.[i]
          if (!b || fT == null || fRH == null) continue
          const sT = mean(b.t)!, sRH = mean(b.rh)!
          if (sRH <= 0 || fRH <= 0) continue
          const sDT = calculateDeltaT(sT, sRH), fDT = calculateDeltaT(fT, fRH)
          rows.push({ key: k, sT, sRH, sDT, fT, fRH, fDT, diff: sDT - fDT })
        }
      } catch {
        error = 'Could not load the Open-Meteo data. Try again in a minute.'
      }
    }
  }

  const daytime = rows.filter(r => { const h = parseInt(r.key.slice(11, 13)); return h >= 9 && h <= 18 })
  const stats = (rs: Row[]) => ({
    n: rs.length,
    dt: mean(rs.map(r => r.diff)),
    absDt: mean(rs.map(r => Math.abs(r.diff))),
    t: mean(rs.map(r => r.sT - r.fT)),
    rh: mean(rs.map(r => r.sRH - r.fRH)),
  })
  const all = stats(rows)
  const day = stats(daytime)

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }
  const th = { textAlign: 'right' as const, padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }
  const td = { textAlign: 'right' as const, padding: '6px 8px', fontSize: 12, fontVariantNumeric: 'tabular-nums' as const }

  return (
    <div style={{ minHeight: '100vh', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>← Admin</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 6px' }}>Delta T calibration</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Compares the station&apos;s measured Delta T with the Open-Meteo model for the same hours over the last 7 days.
        A positive difference means the station is drier than the forecast.
      </p>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <select name="station" defaultValue={selectedId ?? ''} className="input" style={{ flex: 1 }}>
          <option value="" disabled>Select a station…</option>
          {stations.map(s => (
            <option key={s.id} value={s.id}>
              {s.paddock_name ?? s.id} ({s.id}){s.borrowed_station_id ? ` — borrows ${s.borrowed_station_id}` : ''}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">Compare</button>
      </form>

      {error && <div style={{ ...card, color: '#f97316', marginBottom: 16 }}>{error}</div>}

      {station && !error && rows.length === 0 && (
        <div style={{ ...card, marginBottom: 16 }}>No matching hours yet. The station needs temperature and humidity readings in the last 7 days.</div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Daytime Delta T offset (9am–6pm)', value: `${f1(day.dt)} °C`, sub: `${day.n} hours` },
              { label: 'All-hours Delta T offset', value: `${f1(all.dt)} °C`, sub: `${all.n} hours · avg miss ${all.absDt?.toFixed(1)} °C` },
              { label: 'Temperature bias', value: `${f1(day.t)} °C`, sub: 'Station − forecast, daytime' },
              { label: 'Humidity bias', value: `${f1(day.rh)} %`, sub: 'Station − forecast, daytime' },
            ].map((c, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{c.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Hour</th>
                  <th style={th}>Station T / RH</th>
                  <th style={th}>Forecast T / RH</th>
                  <th style={th}>Station ΔT</th>
                  <th style={th}>Forecast ΔT</th>
                  <th style={th}>Diff</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(-48).reverse().map(r => (
                  <tr key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, textAlign: 'left' }}>
                      {new Date(r.key.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' })} {r.key.slice(11, 13)}:00
                    </td>
                    <td style={td}>{r.sT.toFixed(1)}° / {Math.round(r.sRH)}%</td>
                    <td style={td}>{r.fT.toFixed(1)}° / {Math.round(r.fRH)}%</td>
                    <td style={td}>{r.sDT.toFixed(1)}</td>
                    <td style={td}>{r.fDT.toFixed(1)}</td>
                    <td style={{ ...td, color: Math.abs(r.diff) >= 2 ? '#f97316' : 'var(--text)' }}>{f1(r.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Showing the latest 48 matched hours. Differences of 2 °C or more are highlighted.</p>
        </>
      )}
    </div>
  )
}
