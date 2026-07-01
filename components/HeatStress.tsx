import { getHeatStress } from '@/lib/heatStress'

export default function HeatStress({
  tempC,
  growthStage,
  label,
}: {
  tempC: number | null
  growthStage: string | null
  label?: string
}) {
  const result = getHeatStress(tempC, growthStage)
  if (result.level === 'none') return null

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Heat stress{label ? ` · ${label}` : ''}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: result.color }}>
          {result.label}
        </span>
      </div>
      {result.reason && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {result.reason}
        </div>
      )}
    </div>
  )
}
