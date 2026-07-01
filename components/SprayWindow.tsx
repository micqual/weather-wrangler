import { getSprayWindow, STATUS_COLORS } from '@/lib/sprayWindow'

export default function SprayWindow({
  tempC,
  humidity,
  windAvgMs,
  windMaxMs,
  createdAt,
}: {
  tempC: number | null
  humidity: number | null
  windAvgMs: number | null
  windMaxMs: number | null
  createdAt: Date | null
}) {
  const hour = createdAt
    ? parseInt(new Date(createdAt).toLocaleTimeString('en-AU', { timeZone: 'Australia/Melbourne', hour: '2-digit', hour12: false }))
    : new Date().getHours()

  const result = getSprayWindow(tempC, humidity, windAvgMs, windMaxMs, hour)
  const statusStyle = STATUS_COLORS[result.overall]

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Spray window</span>
        <span style={{
          background: statusStyle.bg,
          color: statusStyle.text,
          fontSize: 12,
          fontWeight: 600,
          padding: '3px 10px',
          borderRadius: 20,
        }}>
          {statusStyle.label}
        </span>
      </div>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {result.conditions.map(c => (
          <span key={c.label} title={c.reason} style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 12,
            background: c.status === 'go' ? 'rgba(22,163,74,0.15)' : c.status === 'caution' ? 'rgba(217,119,6,0.15)' : 'rgba(220,38,38,0.15)',
            color: c.status === 'go' ? '#4ade80' : c.status === 'caution' ? '#fbbf24' : '#f87171',
            cursor: 'default',
          }}>
            {c.label}: {c.value}
          </span>
        ))}
      </div>
    </div>
  )
}
