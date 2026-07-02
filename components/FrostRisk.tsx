import { getFrostRisk } from '@/lib/frostRisk'

export default function FrostRisk({
  tempC,
  humidity,
  alertTemp,
  createdAt,
  cropName,
}: {
  tempC: number | null
  humidity: number | null
  alertTemp: number | null
  createdAt: Date | null
  cropName: string | null
}) {
  const hour = createdAt
    ? parseInt(new Date(createdAt).toLocaleTimeString('en-AU', {
        timeZone: 'Australia/Melbourne',
        hour: '2-digit',
        hour12: false,
      }))
    : new Date().getHours()

  const result = getFrostRisk(tempC, humidity, alertTemp, hour)

  const icon = result.risk === 'frost' ? '🔴'
    : result.risk === 'warning' ? '🟡'
    : result.risk === 'watch' ? '🟡'
    : '🟢'

  const label = result.risk === 'none' ? 'No frost risk' : result.label

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Frost risk{cropName ? ` · ${cropName}` : ''}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {icon} {label}
        </span>
      </div>
      {result.risk !== 'none' && result.reason && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {result.reason}
          {result.dewPoint != null && ` · Dew point ${result.dewPoint.toFixed(1)}°C`}
        </div>
      )}
    </div>
  )
}
