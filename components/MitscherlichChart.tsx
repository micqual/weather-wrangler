'use client'

import { useState, useMemo } from 'react'
import type { MitscherlichPoint } from '@/lib/mitscherlich'

export default function MitscherlichChart({
  points,
  currentAppliedN,
  currentYield,
  optimalN,
  maxYield,
  economicOptimalN,
  targetYield,
  soilN,
  cFactor,
}: {
  points: MitscherlichPoint[]
  currentAppliedN: number
  currentYield: number | null
  optimalN: number | null
  maxYield: number
  economicOptimalN: number | null
  targetYield: number | null
  soilN: number
  cFactor: number
}) {
  const [sliderN, setSliderN] = useState(Math.round(currentAppliedN))

  const sliderYield = useMemo(() => {
    const totalN = sliderN + soilN
    return maxYield * (1 - Math.exp(-cFactor * totalN))
  }, [sliderN, soilN, maxYield, cFactor])

  const width = 800
  const height = 260
  const padL = 50, padR = 20, padT = 20, padB = 40

  const chart = useMemo(() => {
    if (points.length < 2) return null
    const maxX = 200
    const maxY = maxYield * 1.1
    const x = (n: number) => padL + (n / maxX) * (width - padL - padR)
    const y = (v: number) => padT + (1 - v / maxY) * (height - padT - padB)
    const pathD = points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${x(p.nApplied).toFixed(1)} ${y(p.predictedYield).toFixed(1)}`
    ).join(' ')
    const xTicks = [0, 50, 100, 150, 200]
    const yTicks = [0, maxYield * 0.5, maxYield].map(v => ({ y: y(v), label: `${v.toFixed(1)}t` }))
    return { pathD, x, y, xTicks, yTicks }
  }, [points, maxYield])

  if (!chart) return null

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8, fontSize: 12 }}>
        <span style={{ color: 'var(--orange)' }}>— Yield curve</span>
        <span style={{ color: '#4ade80' }}>| Current N</span>
        <span style={{ color: 'var(--purple)' }}>| Estimate</span>
        {optimalN != null && <span style={{ color: 'var(--purple)', opacity: 0.6 }}>– – 95% max</span>}
        {economicOptimalN != null && <span style={{ color: 'var(--amber)' }}>· · · Economic optimum</span>}
        {targetYield != null && <span style={{ color: '#60a5fa' }}>— Target</span>}
        <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic' }}>t/ha</span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid */}
        {chart.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={t.y} y2={t.y} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 6} y={t.y + 4} fontSize="11" fill="var(--text-muted)" textAnchor="end">{t.label}</text>
          </g>
        ))}
        {[0, 50, 100, 150, 200].map((xv, i) => (
          <text key={i} x={chart.x(xv)} y={height - 8} fontSize="11" fill="var(--text-muted)" textAnchor="middle">{xv}</text>
        ))}
        <text x={width / 2} y={height - 2} fontSize="11" fill="var(--text-muted)" textAnchor="middle">kg N/ha applied</text>

        {/* Max yield ceiling */}
        <line x1={padL} x2={width - padR} y1={chart.y(maxYield)} y2={chart.y(maxYield)} stroke="var(--border)" strokeWidth={1} strokeDasharray="2 4" />

        {/* Target yield */}
        {targetYield != null && (
          <line x1={padL} x2={width - padR} y1={chart.y(targetYield)} y2={chart.y(targetYield)} stroke="#60a5fa" strokeWidth={1.5} />
        )}

        {/* 95% optimal N */}
        {optimalN != null && (
          <line x1={chart.x(optimalN)} x2={chart.x(optimalN)} y1={padT} y2={height - padB} stroke="var(--purple)" strokeWidth={1} strokeDasharray="6 3" opacity={0.6} />
        )}

        {/* Economic optimal N */}
        {economicOptimalN != null && (
          <line x1={chart.x(economicOptimalN)} x2={chart.x(economicOptimalN)} y1={padT} y2={height - padB} stroke="var(--amber)" strokeWidth={1.5} strokeDasharray="2 4" />
        )}

        {/* Yield curve */}
        <path d={chart.pathD} fill="none" stroke="var(--orange)" strokeWidth={2.5} strokeLinejoin="round" />

        {/* Current N marker */}
        <line x1={chart.x(currentAppliedN)} x2={chart.x(currentAppliedN)} y1={padT} y2={height - padB} stroke="#4ade80" strokeWidth={2} />
        {currentYield != null && (
          <circle cx={chart.x(currentAppliedN)} cy={chart.y(currentYield)} r={5} fill="#4ade80" />
        )}

        {/* Slider estimate marker */}
        <line x1={chart.x(sliderN)} x2={chart.x(sliderN)} y1={padT} y2={height - padB} stroke="var(--purple)" strokeWidth={2} />
        <circle cx={chart.x(sliderN)} cy={chart.y(sliderYield)} r={6} fill="var(--purple)" />
        <text x={chart.x(sliderN) + 8} y={chart.y(sliderYield) - 8} fontSize="11" fill="var(--purple)" fontWeight="bold">
          {sliderYield.toFixed(2)}t
        </text>
      </svg>

      {/* Slider */}
      <div style={{ marginTop: 16, padding: '16px 20px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)' }}>
            N application estimate
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>
            {sliderN} kg N/ha → {sliderYield.toFixed(2)} t/ha
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={200}
          step={1}
          value={sliderN}
          onChange={e => setSliderN(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--orange)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          <span>0 kg N/ha</span>
          <span>
            {sliderN > currentAppliedN
              ? `+${(sliderN - currentAppliedN).toFixed(0)} kg/ha more needed (≈ ${((sliderN - currentAppliedN) / 0.46).toFixed(0)} kg Urea/ha)`
              : sliderN < currentAppliedN
              ? `${(currentAppliedN - sliderN).toFixed(0)} kg/ha already applied`
              : 'Matches current application'}
          </span>
          <span>200 kg N/ha</span>
        </div>
        {sliderYield > (currentYield ?? 0) && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#4ade80' }}>
            📈 +{(sliderYield - (currentYield ?? 0)).toFixed(2)} t/ha gain vs current N
          </div>
        )}
      </div>
    </div>
  )
}
