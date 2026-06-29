import { calculateGdd } from '@/lib/gdd'

export default function GddCard({
  title,
  baseTemp,
  target,
  dailyAvgTemps,
  plantedDate,
}: {
  title: string
  baseTemp: number | null
  target: number | null
  dailyAvgTemps: number[]
  plantedDate: Date | null
}) {
  if (!plantedDate) return null

  if (baseTemp == null) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
        {title}: set a base temp on this crop type to enable a harvest estimate.
      </div>
    )
  }

  const result = calculateGdd(baseTemp, target, dailyAvgTemps)
  const pct = result.target ? Math.min(100, Math.round((result.accumulated / result.target) * 100)) : null

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span>{title}</span>
        <span style={{ color: 'var(--text-muted)' }}>
          {Math.round(result.accumulated)}{result.target ? ` / ${result.target}` : ''} GDD
        </span>
      </div>
      {pct != null && (
        <div style={{ background: 'var(--bg)', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--orange)' }} />
        </div>
      )}
      {result.estimatedHarvestDate ? (
        <div style={{ fontSize: 13, color: 'var(--orange)' }}>
          Estimated harvest: {result.estimatedHarvestDate.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
          {result.daysRemaining ? ` · ${result.daysRemaining} days to go` : ' · ready now'}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {target == null ? 'Set a target GDD on this crop type for a harvest estimate.' : 'Not enough data yet.'}
        </div>
      )}
    </div>
  )
}
