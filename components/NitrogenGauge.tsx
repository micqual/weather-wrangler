export type NGaugeData = {
  label: string
  soilN: number
  appliedNRetained: number
  targetN: number | null
  yieldTarget: number | null
}

export default function NitrogenGauge({ data }: { data: NGaugeData }) {
  const available = data.soilN + data.appliedNRetained
  const target = data.targetN ?? 120 // fallback if no yield target set
  const pct = Math.min(100, Math.round((available / target) * 100))

  const status =
    pct >= 90 ? { color: '#4ade80', label: 'Sufficient' }
    : pct >= 70 ? { color: 'var(--amber)', label: 'Monitor' }
    : { color: 'var(--red)', label: 'Deficient' }

  const gap = Math.max(0, target - available)

  // SVG arc gauge — 180° sweep
  const r = 54
  const cx = 70
  const cy = 70
  const startAngle = 180
  const endAngle = 0
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const arcPath = (pct: number, color: string) => {
    const sweep = pct / 100 * 180
    const angle = 180 - sweep
    const x1 = cx + r * Math.cos(toRad(180))
    const y1 = cy - r * Math.sin(toRad(180))
    const x2 = cx + r * Math.cos(toRad(angle))
    const y2 = cy - r * Math.sin(toRad(angle))
    const largeArc = sweep > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 140 80" style={{ width: '100%', maxWidth: 180 }}>
        {/* Background track */}
        <path
          d={arcPath(100, '#333')}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={arcPath(pct, status.color)}
          fill="none"
          stroke={status.color}
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Centre text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="18" fontWeight="bold" fill={status.color}>
          {pct}%
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="9" fill="var(--text-muted)">
          {available.toFixed(0)} / {target.toFixed(0)} kg/ha
        </text>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: status.color, marginTop: 2 }}>{status.label}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{data.label}</div>
      {data.yieldTarget && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Target: {data.yieldTarget} t/ha
        </div>
      )}
      {gap > 0 && (
        <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 4 }}>
          Gap: {gap.toFixed(0)} kg N/ha needed
        </div>
      )}
    </div>
  )
}
