'use client'

import { useMemo, useEffect, useRef } from 'react'

type Point = { t: number; v: number }

function HistoryChart({
  points,
  label,
  color,
  fmt,
  barChart,
  chartRef,
}: {
  points: Point[]
  label: string
  color: string
  fmt: (v: number) => string
  barChart?: boolean
  chartRef?: React.RefObject<HTMLDivElement>
}) {
  const chart = useMemo(() => {
    if (points.length < 2) return null
    const width = 800
    const height = 200
    const padL = 50, padR = 20, padT = 16, padB = 36
    const minT = points[0].t
    const maxT = points[points.length - 1].t
    const vals = points.map(p => p.v)
    const minV = Math.min(...vals)
    const maxV = Math.max(...vals)
    const rangeV = maxV - minV || 1
    const x = (t: number) => padL + ((t - minT) / (maxT - minT)) * (width - padL - padR)
    const y = (v: number) => padT + (1 - (v - minV) / rangeV) * (height - padT - padB)
    const tickCount = 6
    const tickStep = Math.max(1, Math.floor(points.length / tickCount))
    const xTicks = points.filter((_, i) => i % tickStep === 0).map(p => ({
      x: x(p.t),
      label: new Date(p.t).toLocaleString('en-AU', {
        timeZone: 'Australia/Melbourne',
        day: 'numeric', month: 'short',
        hour: points.length > 200 ? undefined : '2-digit',
        minute: points.length > 200 ? undefined : '2-digit',
        hour12: false,
      }),
    }))
    const yTicks = [minV, minV + rangeV * 0.5, maxV].map(v => ({ y: y(v), label: fmt(v) }))
    if (barChart) {
      const barWidth = Math.max(1, (width - padL - padR) / points.length - 0.5)
      return { xTicks, yTicks, barWidth, x, y, width, height, padL, padR, padT, padB }
    }
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
    return { pathD, xTicks, yTicks, x, y, width, height, padL, padR, padT, padB }
  }, [points])

  if (!chart) return null

  return (
    <div ref={chartRef} className="card" style={{ padding: 16, marginBottom: 16, scrollMarginTop: 20 }}>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: 500 }}>{label}</div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {chart.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={chart.padL} x2={chart.width - chart.padR} y1={t.y} y2={t.y} stroke="var(--border)" strokeWidth={1} />
            <text x={chart.padL - 6} y={t.y + 4} fontSize="11" fill="var(--text-muted)" textAnchor="end">{t.label}</text>
          </g>
        ))}
        {chart.xTicks.map((t, i) => (
          <text key={i} x={t.x} y={chart.height - 6} fontSize="10" fill="var(--text-muted)" textAnchor="middle">{t.label}</text>
        ))}
        {barChart ? (
          points.map((p, i) => {
            const bx = chart.x!(p.t)
            const by = chart.y!(p.v)
            const bh = chart.height - chart.padB - by
            return bh > 0 ? (
              <rect key={i} x={bx - (chart as any).barWidth / 2} y={by} width={(chart as any).barWidth} height={bh} fill={color} opacity={0.8} />
            ) : null
          })
        ) : (
          <path d={(chart as any).pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
        )}
      </svg>
    </div>
  )
}

export default function HistoryCharts({
  tempData,
  humidityData,
  windData,
  rainData,
  scrollTo,
}: {
  tempData: Point[]
  humidityData: Point[]
  windData: Point[]
  rainData: Point[]
  scrollTo?: string
}) {
  const tempRef = useRef<HTMLDivElement>(null)
  const humidityRef = useRef<HTMLDivElement>(null)
  const windRef = useRef<HTMLDivElement>(null)
  const rainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollTo) return
    const refs: Record<string, React.RefObject<HTMLDivElement>> = {
      temp: tempRef,
      humidity: humidityRef,
      wind: windRef,
      rain: rainRef,
    }
    const ref = refs[scrollTo]
    if (ref?.current) {
      setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    }
  }, [scrollTo])

  return (
    <div>
      <HistoryChart points={tempData} label="Temperature (°C)" color="var(--orange)" fmt={v => `${v.toFixed(1)}°`} chartRef={tempRef} />
      <HistoryChart points={humidityData} label="Humidity (%)" color="var(--purple)" fmt={v => `${v.toFixed(0)}%`} chartRef={humidityRef} />
      <HistoryChart points={windData} label="Wind speed (km/h)" color="#60a5fa" fmt={v => `${v.toFixed(0)}`} chartRef={windRef} />
      <HistoryChart points={rainData} label="Rainfall (mm)" color="#4ade80" fmt={v => `${v.toFixed(1)}`} barChart chartRef={rainRef} />
    </div>
  )
}
