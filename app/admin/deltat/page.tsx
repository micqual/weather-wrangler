import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { calculateDeltaT } from '@/lib/sprayWindow'
import { windTo10m, SENSOR_HEIGHT_M } from '@/lib/harvestWindow'

export const dynamic = 'force-dynamic'

// Compare each station with the Open-Meteo model for the same hours (last 7 days):
// Delta T, wind (station height vs 10 m) and 9am–9am rain, so we can see how far the forecast is off
// for that paddock and spot sensors that have stopped working.
type Row = {
  key: string
  sT: number; sRH: number; sDT: number; sW: number | null
  fT: number; fRH: number; fDT: number; fW: number | null
  diff: number
}
type RainDay = { date: string; gauge: number; model: number; note: string | null; partial: boolean }

const melb = (d: Date) => d.toLocaleString('sv-SE', { timeZone: 'Australia/Melbourne' }) // "2026-11-21 13:05:00"
const hourKey = (d: Date) => melb(new Date(d.getTime() + 30 * 60000)).slice(0, 13)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const f1 = (n: number | null) => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(1)}`)
const shiftDay = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
// Rain day runs 9am–9am and is named after the day it starts
const rainDayOf = (local: string, before9: boolean) => (before9 ? shiftDay(local.slice(0, 10), -1) : local.slice(0, 10))

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

  const rows: Row[] = []
  const rainDays: RainDay[] = []
  let gaugeStuck = false
  let error: string | null = null

  if (station) {
    const dataId = station.borrowed_station_id ?? station.id
    const src = station.borrowed_station_id ? stations.find(s => s.id === station.borrowed_station_id) : station
    const lat = src?.latitude ?? station.latitude
    const lon = src?.longitude ?? station.longitude

    if (lat == null || lon == null) {
      error = 'This station has no latitude/longitude, so there is no forecast to compare against.'
    } else {
      const since = new Date(Date.now() - 8 * 86400000)
      const [readings, rainReadings] = await Promise.all([
        prisma.weather_readings.findMany({
          where: { station_id: dataId, created_at: { gte: since }, temperature_c: { not: null }, humidity: { not: null } },
          orderBy: { created_at: 'asc' },
          select: { created_at: true, temperature_c: true, humidity: true, wind_avg_ms: true },
        }),
        prisma.weather_readings.findMany({
          where: { station_id: dataId, created_at: { gte: since }, rain_mm: { not: null } },
          orderBy: { created_at: 'asc' },
          select: { created_at: true, rain_mm: true },
        }),
      ])

      // Average station readings into hourly buckets (nearest hour, Melbourne time)
      const buckets = new Map<string, { t: number[]; rh: number[]; w: number[] }>()
      for (const r of readings) {
        if (!r.created_at) continue
        const k = hourKey(new Date(r.created_at))
        const b = buckets.get(k) ?? { t: [], rh: [], w: [] }
        b.t.push(Number(r.temperature_c))
        b.rh.push(Number(r.humidity))
        if (r.wind_avg_ms != null) b.w.push(Number(r.wind_avg_ms) * 3.6)
        buckets.set(k, b)
      }

      // Gauge rain per 9am–9am day from the cumulative counter (skip resets and spikes, like the rain page)
      const gauge = new Map<string, number>()
      let last: number | null = null
      const rainValues = new Set<number>()
      for (const r of rainReadings) {
        const curr = Number(r.rain_mm)
        rainValues.add(curr)
        if (last != null) {
          const inc = curr - last
          if (inc > 0 && inc <= 25 && r.created_at) {
            const local = melb(new Date(r.created_at))
            const day = rainDayOf(local, parseInt(local.slice(11, 13)) < 9)
            gauge.set(day, (gauge.get(day) ?? 0) + inc)
          }
        }
        last = curr
      }

      const params = new URLSearchParams({
        latitude: String(lat), longitude: String(lon),
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation',
        timezone: 'Australia/Melbourne', wind_speed_unit: 'kmh', past_days: '8', forecast_days: '1',
      })
      try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: 'no-store' })
        const h = res.ok ? (await res.json())?.hourly : null
        if (!h?.time) throw new Error('no data')
        const nowKey = melb(new Date()).slice(0, 13)
        const model = new Map<string, number>()
        for (let i = 0; i < h.time.length; i++) {
          const k = String(h.time[i]).replace('T', ' ').slice(0, 13)
          if (k > nowKey) continue

          // Model rain: each hourly value covers the hour before its timestamp, so the 9:00 value still belongs to the previous rain day
          const p = h.precipitation?.[i]
          if (p != null) {
            const day = rainDayOf(k, parseInt(k.slice(11, 13)) <= 9)
            model.set(day, (model.get(day) ?? 0) + p)
          }

          const b = buckets.get(k)
          const fT = h.temperature_2m?.[i], fRH = h.relative_humidity_2m?.[i]
          if (!b || fT == null || fRH == null) continue
          const sT = mean(b.t)!, sRH = mean(b.rh)!
          if (sRH <= 0 || fRH <= 0) continue
          const sDT = calculateDeltaT(sT, sRH), fDT = calculateDeltaT(fT, fRH)
          rows.push({ key: k, sT, sRH, sDT, sW: mean(b.w), fT, fRH, fDT, fW: h.wind_speed_10m?.[i] ?? null, diff: sDT - fDT })
        }

        // Last 7 rain days, newest first (today's is still running)
        const nowLocal = melb(new Date())
        const today = rainDayOf(nowLocal, parseInt(nowLocal.slice(11, 13)) < 9)
        for (let d = 0; d < 7; d++) {
          const date = shiftDay(today, -d)
          const g = Math.round((gauge.get(date) ?? 0) * 10) / 10
          const m = Math.round((model.get(date) ?? 0) * 10) / 10
          const note = m >= 2 && g < 0.2 ? 'Forecast had rain, gauge recorded none — check gauge'
            : g >= 2 && m < 0.2 ? 'Gauge only — local shower?'
            : m >= 2 && g < m * 0.4 ? 'Gauge well below forecast'
            : null
          rainDays.push({ date, gauge: g, model: m, note, partial: d === 0 })
        }
        const modelTotal = rainDays.reduce((s, d) => s + d.model, 0)
        gaugeStuck = rainReadings.length > 0 && rainValues.size === 1 && modelTotal >= 5
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

  // Wind ratio: forecast 10 m wind ÷ station wind, over hours with real wind at the station (ignores calm hours)
  const windy = rows.filter(r => r.sW != null && r.fW != null && r.sW >= 3)
  const windRatio = windy.length >= 6 ? windy.reduce((s, r) => s + r.fW!, 0) / windy.reduce((s, r) => s + r.sW!, 0) : null
  const theoryRatio = windTo10m(1, SENSOR_HEIGHT_M)

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }
  const th = { textAlign: 'right' as const, padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }
  const td = { textAlign: 'right' as const, padding: '6px 8px', fontSize: 12, fontVariantNumeric: 'tabular-nums' as const }
  const h2 = { fontSize: 15, fontWeight: 700, margin: '28px 0 10px' }
  const dayLabel = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div style={{ minHeight: '100vh', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>← Admin</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '4px 0 6px' }}>Delta T calibration</h1>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Compares the station with the Open-Meteo model for the same hours over the last 7 days: Delta T, wind and rain.
        A positive Delta T difference means the station is drier than the forecast.
      </p>

      <form method="get" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <select name="station" defaultValue={selectedId ?? ''} className="input" style={{ flex: 1 }}>
          <option value="" disabled>Select a station…</option>
          {stations.filter(s => !s.borrowed_station_id).map(s => (
            <option key={s.id} value={s.id}>
              {s.paddock_name ?? s.id} ({s.id})
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
              {
                label: 'Wind ratio (10 m ÷ station)',
                value: windRatio != null ? `${windRatio.toFixed(2)}×` : '—',
                sub: windRatio != null
                  ? `${windy.length} windy hours · theory for ${SENSOR_HEIGHT_M} m is ${theoryRatio.toFixed(2)}×`
                  : 'Not enough windy hours yet',
              },
            ].map((c, i) => (
              <div key={i} style={card}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{c.value}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>
          {windRatio != null && Math.abs(windRatio - theoryRatio) / theoryRatio > 0.25 && (
            <div style={{ ...card, color: '#f97316', fontSize: 13, marginBottom: 20 }}>
              The measured wind ratio is more than 25% away from the {theoryRatio.toFixed(2)}× the harvest window uses.
              {windRatio > theoryRatio ? ' The station may be sheltered (trees, sheds) or the anemometer may be dragging.' : ' The station may be more exposed than a typical 1.5 m site.'}
              {' '}The model wind is a grid average, so treat this as a sanity check rather than an exact figure.
            </div>
          )}

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
                  <th style={th}>Wind stn / 10 m</th>
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
                    <td style={td}>{r.sW != null ? Math.round(r.sW) : '—'} / {r.fW != null ? Math.round(r.fW) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Showing the latest 48 matched hours. Delta T differences of 2 °C or more are highlighted. Wind is in km/h.
          </p>
        </>
      )}

      {rainDays.length > 0 && (
        <>
          <h2 style={h2}>Rain: gauge vs forecast (9am–9am)</h2>
          {gaugeStuck && (
            <div style={{ ...card, color: '#ef4444', fontSize: 13, marginBottom: 12 }}>
              The gauge reading hasn&apos;t changed all week, but the model had {rainDays.reduce((s, d) => s + d.model, 0).toFixed(1)} mm.
              The gauge may be blocked or the tipping bucket stuck.
            </div>
          )}
          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Rain day</th>
                  <th style={th}>Gauge</th>
                  <th style={th}>Forecast</th>
                  <th style={{ ...th, textAlign: 'left' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {rainDays.map(d => (
                  <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, textAlign: 'left' }}>{dayLabel(d.date)}{d.partial ? ' (so far)' : ''}</td>
                    <td style={td}>{d.gauge.toFixed(1)} mm</td>
                    <td style={td}>{d.model.toFixed(1)} mm</td>
                    <td style={{ ...td, textAlign: 'left', color: d.note?.startsWith('Forecast had rain') ? '#f97316' : 'var(--text-muted)' }}>{d.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Model rain is spread over a grid square several kilometres wide, so a single shower can miss the gauge or the model. Look for a pattern over several days, not one day.
          </p>
        </>
      )}
    </div>
  )
}
