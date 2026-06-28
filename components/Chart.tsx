export type Point = { t: number; v: number }

export function buildChart(points: Point[], width: number, height: number, padLeft: number, padRight: number, padTop: number, padBottom: number, fmt: (v: number) => string) {
  if (points.length < 2) return null
  const minT = points[0].t
  const maxT = points[points.length - 1].t
  const minV = Math.min(...points.map(p => p.v))
  const maxV = Math.max(...points.map(p => p.v))
  const vRange = maxV - minV || 1
  const tRange = maxT - minT || 1
  const x = (t: number) => padLeft + ((t - minT) / tRange) * (width - padLeft - padRight)
  const y = (v: number) => padTop + (1 - (v - minV) / vRange) * (height - padTop - padBottom)
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  const yTicks = [minV, (minV + maxV) / 2, maxV].map(v => ({ y: y(v), label: fmt(v) }))
  const xTicks = Array.from({ length: 7 }, (_, i) => {
    const t = minT + (tRange * i) / 6
    return { x: x(t), label: new Date(t).toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false }) }
  })
  return { pathD, yTicks, xTicks }
}

export function Chart({ title, color, points, fmt, height = 180 }: { title: string; color: string; points: Point[]; fmt: (v: number) => string; height?: number }) {
  const width = 800
  const padLeft = 40, padRight = 16, padTop = 16, padBottom = 26
  const chart = buildChart(points, width, height, padLeft, padRight, padTop, padBottom, fmt)

  return (
    <div className="card" style={{ padding: '16px 16px 8px', marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h3>
      {!chart ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Not enough data yet.</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {chart.yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padLeft} x2={width - padRight} y1={t.y} y2={t.y} stroke="var(--border)" strokeWidth={1} />
              <text x={padLeft - 8} y={t.y + 4} fontSize="11" fill="var(--text-muted)" textAnchor="end">{t.label}</text>
            </g>
          ))}
          {chart.xTicks.map((t, i) => (
            <text key={i} x={t.x} y={height - 6} fontSize="11" fill="var(--text-muted)" textAnchor="middle">{t.label}</text>
          ))}
          <path d={chart.pathD} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
    </div>
  )
}
