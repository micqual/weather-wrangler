import type { OutlookHour } from '@/lib/sprayOutlook'

const COLOUR = { go: '#4ade80', caution: '#facc15', stop: '#ef4444' } as const

export default function SprayStrip({ hours }: { hours: OutlookHour[] }) {
  return (
    <div style={{ display: 'flex', gap: 1 }} aria-label="Hourly spray outlook for the rest of today">
      {hours.slice(0, 14).map(h => (
        <div key={h.hour} title={`${h.label}: ${h.status}${h.note ? ` — ${h.note}` : ''}`}
          style={{ width: 7, height: 16, borderRadius: 2, background: COLOUR[h.status] }} />
      ))}
    </div>
  )
}
