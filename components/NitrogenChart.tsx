'use client'

import { useMemo } from 'react'

type DataPoint = {
  date: string
  leaching: number
  volatilization: number
  cropUsage: number
  total: number
}

export default function NitrogenChart({ points }: { points: DataPoint[] }) {
  const width = 800
  const height = 200
  const padL = 45, padR = 16, padT = 16, padB = 30

  const chartPoints = useMemo(() => {
    if (points.length < 2) return null

    const maxVal = Math.max(...points.map(p => p.total), 1)
    const minDate = new Date(points[0].date).getTime()
    const maxDate = new Date(points[points.length - 1].date).getTime()
    const dateRange = maxDate - minDate || 1

    const x = (d: string) => padL + ((new Date(d).getTime() - minDate) / dateRange) * (width - padL - padR)
    const y = (v: number) => padT + (1 - v / maxVal) * (height - padT - padB)

    const path = (key: keyof DataPoint) =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.date).toFixed(1)} ${y(p[key] as number).toFixed(1)}`).join(' ')

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
      x: padL + t * (width - padL - padR),
      label: new Date(minDate + t * dateRange).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    }))

    const yTicks = [0, 0.5, 1].map(t => ({
      y: padT + (1 - t) * (height - padT - padB),
      label: (t * maxVal).toFixed(0),
    }))

    return { path, xTicks, yTicks }
  }, [points])

  if (!chartPoints) {
    return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Not enough data yet.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12 }}>
        <span style={{ color: '#60a5fa' }}>● Leaching</span>
        <span style={{ color: '#f97316' }}>● Volatilization</span>
        <span style={{ color: '#4ade80' }}>● Crop usage</span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic' }}>Cumulative kg N/ha lost</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {chartPoints.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={t.y} y2={t.y} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={t.y + 4} fontSize="11" fill="var(--text-muted)" textAnchor="end">{t.label}</text>
          </g>
        ))}
        {chartPoints.xTicks.map((t, i) => (
          <text key={i} x={t.x} y={height - 8} fontSize="11" fill="var(--text-muted)" textAnchor="middle">{t.label}</text>
        ))}
        <path d={chartPoints.path('leaching')} fill="none" stroke="#60a5fa" strokeWidth={2} strokeLinejoin="round" />
        <path d={chartPoints.path('volatilization')} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" />
        <path d={chartPoints.path('cropUsage')} fill="none" stroke="#4ade80" strokeWidth={2} strokeLinejoin="round" />
        <path d={chartPoints.path('total')} fill="none" stroke="var(--text-muted)" strokeWidth={1.5} strokeDasharray="4 3" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
