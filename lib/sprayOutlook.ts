import { getSprayWindow, SprayStatus } from '@/lib/sprayWindow'

export type OutlookHour = { hour: number; label: string; status: SprayStatus; note: string | null }
export type SprayOutlook = { headline: string; detail: string | null; icon: string; hours: OutlookHour[] }

const fmtH = (h: number) => {
  const x = ((h % 24) + 24) % 24
  return `${x % 12 === 0 ? 12 : x % 12}${x < 12 ? 'am' : 'pm'}`
}

type Run = { start: number; end: number }
function runsOf(hours: OutlookHour[], status: SprayStatus): Run[] {
  const out: Run[] = []
  for (const h of hours) {
    if (h.status !== status) continue
    const last = out[out.length - 1]
    if (last && last.end === h.hour - 1) last.end = h.hour
    else out.push({ start: h.hour, end: h.hour })
  }
  return out
}

// Open-Meteo hourly forecast for the rest of today (Melbourne time), run through the same spray rules as the live reading.
// Note: forecast wind is at 10 m, so it tends to read higher than wind at boom height.
export async function getSprayOutlook(lat: number | null, lon: number | null): Promise<SprayOutlook | null> {
  if (lat == null || lon == null) return null
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'wind_gusts_10m', 'precipitation', 'precipitation_probability'].join(','),
    timezone: 'Australia/Melbourne',
    wind_speed_unit: 'kmh',
    forecast_days: '2',
  })
  let data: any
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 900 } })
    if (!res.ok) return null
    data = await res.json()
  } catch { return null }
  const h = data?.hourly
  if (!h?.time) return null

  const nowLocal = new Date().toLocaleString('sv-SE', { timeZone: 'Australia/Melbourne' }) // "2026-10-31 14:35:12"
  const todayStr = nowLocal.slice(0, 10)
  const nowHour = parseInt(nowLocal.slice(11, 13))

  const hours: OutlookHour[] = []
  for (let i = 0; i < h.time.length; i++) {
    const t: string = h.time[i]
    const hr = parseInt(t.slice(11, 13))
    if (t.slice(0, 10) !== todayStr || hr < nowHour) continue
    const w = getSprayWindow(
      h.temperature_2m?.[i] ?? null,
      h.relative_humidity_2m?.[i] ?? null,
      h.wind_speed_10m?.[i] != null ? h.wind_speed_10m[i] / 3.6 : null,
      h.wind_gusts_10m?.[i] != null ? h.wind_gusts_10m[i] / 3.6 : null,
      hr,
      h.precipitation?.[i] ?? 0,
    )
    let status: SprayStatus = w.overall
    let note: string | null = w.conditions.filter(c => c.status !== 'go').map(c => `${c.label}: ${c.value} (${c.reason})`).join(' · ') || null
    const prob = h.precipitation_probability?.[i] ?? 0
    if (status === 'go' && prob >= 50) { status = 'caution'; note = `Rain chance ${prob}%` }
    hours.push({ hour: hr, label: fmtH(hr), status, note })
  }
  if (hours.length === 0) return null

  const now = hours[0]
  const go = runsOf(hours, 'go')
  const caution = runsOf(hours, 'caution')
  const noteAt = (hr: number) => hours.find(x => x.hour === hr)?.note ?? null

  if (go.length && go[0].start === now.hour) {
    const end = go[0].end
    const lastHour = hours[hours.length - 1].hour
    if (end >= lastHour) return { headline: 'Good for the rest of today', detail: null, icon: '🟢', hours }
    const next = noteAt(end + 1)
    return { headline: `Good until ${fmtH(end + 1)}`, detail: next ? `Then ${next}` : null, icon: '🟢', hours }
  }
  if (go.length) {
    const g = go[0]
    return { headline: `Good ${fmtH(g.start)}–${fmtH(g.end + 1)}`, detail: now.note ? `Now: ${now.note}` : null, icon: '🟡', hours }
  }
  if (caution.length) {
    const c = caution[0]
    return { headline: `Marginal ${fmtH(c.start)}–${fmtH(c.end + 1)}`, detail: noteAt(c.start), icon: '🟡', hours }
  }
  return { headline: 'No suitable window today', detail: now.note, icon: '🔴', hours }
}
