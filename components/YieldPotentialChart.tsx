'use client'

import { useMemo } from 'react'

type Point = {
  date: string
  waterLimitedTHa: number | null
  nLimitedTHa: number | null
}

export default function YieldPotentialChart({
  points,
  actualTHa,
  targetTHa,
}: {
  points: Point[]
  actualTHa: number | null
  targetTHa: number | null
}) {
  const width = 800
  const height = 220
  const padL = 40, padR = 16, padT = 16, padB = 30

  const chart = useMemo(() => {
    if (points.length < 2) return null

    const allVals = points.flatMap(p => [p.waterLimitedTHa, p.nLimitedTHa, actualTHa, targetTHa].filter((v): v is number => v != null))
    if (allVals.length === 0) return null

    const maxVal = Math.max(...allVals, 1)
    const minDate = new Date(points[0].date).getTime()
    const maxDate = new Date(points[points.length - 1].date).getTime()
    const dateRange = maxDate - minDate || 1

    const x = (d: string) => padL + ((new Date(d).getTime() - minDate) / dateRange) * (width - padL - padR)
    const y = (v: number) => padT + (1 - v / maxVal) * (height - padT - padB)

    const path = (key: 'waterLimitedTHa' | 'nLimitedTHa') => {
      const pts = points.filter(p => p[key] != null)
      return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.date).toFixed(1)} ${y(p[key] as number).toFixed(1)}`).join(' ')
    }

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
      x: padL + t * (width - padL - padR),
      label: new Date(minDate + t * dateRange).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    }))

    const yTicks = [0, 0.5, 1].map(t => ({
      y: padT + (1 - t) * (height - padT - padB),
      label: (t * maxVal).toFixed(1),
    }))

    // Horizontal lines for actual and target
    const actualY = actualTHa != null ? y(actualTHa) : null
    const targetY = targetTHa != null ? y(targetTHa) : null

    return { path, xTicks, yTicks, actualY, targetY, maxDate, minDate, x }
  }, [points, actualTHa, targetTHa])

  if (!chart) {
    return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '16px 0' }}>Set stored soil water to see yield potential chart.</div>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
        <span style={{ color: '#60a5fa' }}>● Water-limited yield</span>
        <span style={{ color: 'var(--orange)' }}>● N-limited yield</span>
        {targetTHa && <span style={{ color: 'var(--purple)' }}>– – Target yield</span>}
        {actualTHa && <span style={{ color: '#4ade80' }}>— Actual yield</span>}
        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic' }}>t/ha</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {chart.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={t.y} y2={t.y} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={t.y + 4} fontSize="11" fill="var(--text-muted)" textAnchor="end">{t.label}</text>
          </g>
        ))}
        {chart.xTicks.map((t, i) => (
          <text key={i} x={t.x} y={height - 8} fontSize="11" fill="var(--text-muted)" textAnchor="middle">{t.label}</text>
        ))}
        {/* Target yield line */}
        {chart.targetY != null && (
          <line x1={padL} x2={width - padR} y1={chart.targetY} y2={chart.targetY} stroke="var(--purple)" strokeWidth={1.5} strokeDasharray="6 3" />
        )}
        {/* Actual yield line */}
        {chart.actualY != null && (
          <line x1={padL} x2={width - padR} y1={chart.actualY} y2={chart.actualY} stroke="#4ade80" strokeWidth={2} />
        )}
        {/* Water-limited */}
        <path d={chart.path('waterLimitedTHa')} fill="none" stroke="#60a5fa" strokeWidth={2.5} strokeLinejoin="round" />
        {/* N-limited */}
        <path d={chart.path('nLimitedTHa')} fill="none" stroke="var(--orange)" strokeWidth={2.5} strokeLinejoin="round" />
      </svg>
    </div>
  )
}
