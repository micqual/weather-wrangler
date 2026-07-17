'use client'

import { useMemo } from 'react'

type Event = {
  date: Date
  type: 'soil_test' | 'application' | 'loss'
  label: string
  value: number // positive = addition, negative = loss
}

export type NBalancePoint = {
  date: Date
  balance: number
  event?: string
}

export default function NBalanceChart({ points }: { points: NBalancePoint[] }) {
  const chart = useMemo(() => {
    if (points.length < 2) return null
    const width = 800
    const height = 200
    const padL = 50, padR = 20, padT = 16, padB = 36

    const minT = points[0].date.getTime()
    const maxT = points[points.length - 1].date.getTime()
    const vals = points.map(p => p.balance)
    const minV = Math.min(0, ...vals)
    const maxV = Math.max(...vals)
    const rangeV = maxV - minV || 1

    const x = (d: Date) => padL + ((d.getTime() - minT) / (maxT - minT)) * (width - padL - padR)
    const y = (v: number) => padT + (1 - (v - minV) / rangeV) * (height - padT - padB)

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.date).toFixed(1)} ${y(p.balance).toFixed(1)}`).join(' ')

    // Event markers (applications)
    const markers = points.filter(p => p.event)

    // X ticks
    const tickCount = 5
    const step = Math.floor(points.length / tickCount)
    const xTicks = points.filter((_, i) => i % step === 0).map(p => ({
      x: x(p.date),
      label: p.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    }))

    // Y ticks
    const yTicks = [minV, minV + rangeV * 0.5, maxV].map(v => ({ y: y(v), label: `${Math.round(v)}` }))

    return { pathD, markers, xTicks, yTicks, x, y, width, height, padL, padR, padT, padB }
  }, [points])

  if (!chart) return null

  return (
    <div>
      <div style={{ fontSize: 11, color: '#888', fontFamily: 'sans-serif', marginBottom: 6 }}>
        kg N/ha available — soil test N + applications − estimated losses
      </div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid */}
        {chart.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={chart.padL} x2={chart.width - chart.padR} y1={t.y} y2={t.y} stroke="#eee" strokeWidth={1} />
            <text x={chart.padL - 6} y={t.y + 4} fontSize="11" fill="#999" textAnchor="end">{t.label}</text>
          </g>
        ))}
        {chart.xTicks.map((t, i) => (
          <text key={i} x={t.x} y={chart.height - 6} fontSize="10" fill="#999" textAnchor="middle">{t.label}</text>
        ))}

        {/* Main balance line */}
        <path d={chart.pathD} fill="none" stroke="#7c5cbf" strokeWidth={2} strokeLinejoin="round" />

        {/* Event markers */}
        {chart.markers.map((p, i) => (
          <g key={i}>
            <line x1={chart.x(p.date)} x2={chart.x(p.date)} y1={chart.padT} y2={chart.height - chart.padB} stroke="#f2762a" strokeWidth={1} strokeDasharray="3,3" />
            <circle cx={chart.x(p.date)} cy={chart.y(p.balance)} r={4} fill="#f2762a" />
            <text x={chart.x(p.date)} y={chart.padT - 2} fontSize="9" fill="#f2762a" textAnchor="middle">{p.event}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
