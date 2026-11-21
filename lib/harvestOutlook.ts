// Daily harvest outlook: 7-day hourly forecast (Open-Meteo) checked against crop-specific Delta T,
// fire danger (GFDI > 35 stops, CFA/VFF guide) and rain. Forecast wind is already at 10 m.
import { calculateDeltaT } from '@/lib/sprayWindow'
import { calcGFDI, HarvestStatus } from '@/lib/harvestWindow'

export type CropGroup = 'cereal' | 'canola' | 'pulse'
export type HarvestDay = { date: string; label: string; window: string | null; hoursGood: number; status: HarvestStatus; reason: string | null }

type Bands = { stopBelow: number; goFrom: number; shatterAbove: number | null }
const BANDS: Record<CropGroup, Bands> = {
  cereal: { stopBelow: 2, goFrom: 4, shatterAbove: null },
  canola: { stopBelow: 2, goFrom: 3, shatterAbove: 10 },
  pulse: { stopBelow: 2, goFrom: 3, shatterAbove: 8 },
}

export function cropGroupOf(cropName: string | null | undefined): CropGroup {
  const n = (cropName ?? '').toLowerCase()
  if (n.includes('canola')) return 'canola'
  if (/(lentil|pea|chickpea|bean|faba|vetch|lupin)/.test(n)) return 'pulse'
  return 'cereal'
}

function hourStatus(dt: number, gfdi: number, rain: number, b: Bands): { status: HarvestStatus; reason: string | null } {
  if (gfdi > 35) return { status: 'stop', reason: `Fire danger ${gfdi.toFixed(0)}` }
  if (rain >= 0.5) return { status: 'stop', reason: 'Rain' }
  if (dt < b.stopBelow) return { status: 'stop', reason: `Delta T ${dt.toFixed(1)} — too damp` }
  if (dt < b.goFrom) return { status: 'caution', reason: `Delta T ${dt.toFixed(1)} — grain may be tough` }
  if (b.shatterAbove != null && dt > b.shatterAbove) return { status: 'caution', reason: `Delta T ${dt.toFixed(1)} — shatter risk` }
  if (gfdi > 30) return { status: 'caution', reason: `Fire danger ${gfdi.toFixed(0)} — monitor` }
  return { status: 'go', reason: null }
}

const fmtH = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 || h === 24 ? 'am' : 'pm'}`

export async function getHarvestOutlook(lat: number | null, lon: number | null, cropName: string | null | undefined): Promise<HarvestDay[] | null> {
  if (lat == null || lon == null) return null
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lon),
    hourly: ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'precipitation'].join(','),
    timezone: 'Australia/Melbourne', wind_speed_unit: 'kmh', forecast_days: '7',
  })
  let h: any
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    h = (await res.json())?.hourly
  } catch { return null }
  if (!h?.time) return null

  const bands = BANDS[cropGroupOf(cropName)]
  const nowLocal = new Date().toLocaleString('sv-SE', { timeZone: 'Australia/Melbourne' })
  const today = nowLocal.slice(0, 10)
  const nowHour = parseInt(nowLocal.slice(11, 13))

  const byDay = new Map<string, { hour: number; status: HarvestStatus; reason: string | null }[]>()
  for (let i = 0; i < h.time.length; i++) {
    const t: string = h.time[i]
    const date = t.slice(0, 10)
    const hr = parseInt(t.slice(11, 13))
    if (hr < 6 || (date === today && hr < nowHour)) continue
    const T = h.temperature_2m?.[i], RH = h.relative_humidity_2m?.[i], W = h.wind_speed_10m?.[i]
    if (T == null || RH == null || W == null || RH <= 0) continue
    const s = hourStatus(calculateDeltaT(T, RH), calcGFDI(T, RH, W), h.precipitation?.[i] ?? 0, bands)
    if (!byDay.has(date)) byDay.set(date, [])
    byDay.get(date)!.push({ hour: hr, ...s })
  }

  const days: HarvestDay[] = []
  for (const [date, hours] of byDay) {
    // longest run of 'go' hours
    let best: { start: number; end: number } | null = null
    let cur: { start: number; end: number } | null = null
    for (const x of hours) {
      if (x.status === 'go') {
        cur = cur && cur.end === x.hour - 1 ? { start: cur.start, end: x.hour } : { start: x.hour, end: x.hour }
        if (!best || cur.end - cur.start > best.end - best.start) best = { ...cur }
      } else cur = null
    }
    const hoursGood = hours.filter(x => x.status === 'go').length
    const status: HarvestStatus = hoursGood >= 4 ? 'go' : hoursGood > 0 || hours.some(x => x.status === 'caution') ? 'caution' : 'stop'
    const counts = new Map<string, number>()
    for (const x of hours) if (x.reason) { const k = x.reason.replace(/ [\d.]+/, ''); counts.set(k, (counts.get(k) ?? 0) + 1) }
    const reason = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    const d = new Date(`${date}T12:00:00`)
    days.push({
      date,
      label: date === today ? 'Today' : d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }),
      window: best ? `${fmtH(best.start)}–${fmtH(best.end + 1)}` : null,
      hoursGood, status, reason: status === 'go' ? null : reason,
    })
  }
  return days
}
