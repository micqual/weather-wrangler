'use client'

import { useState } from 'react'

export type RainfallMonth = {
  month: number
  year: number
  label: string
  rainfallMm: number
  source: 'station' | 'bom-historical' | 'bom-forecast' | 'bom-climate'
  efficiency: number
  availableMm: number
  period: 'fallow' | 'growing' | 'remaining'
}

export default function RainfallBudget({
  months,
  totalFallowMm,
  totalGrowingMm,
  totalRemainingMm,
  storedSoilWaterMm,
  evapCoeff,
  totalAvailableMm,
  waterLimitedYield,
}: {
  months: RainfallMonth[]
  totalFallowMm: number
  totalGrowingMm: number
  totalRemainingMm: number
  storedSoilWaterMm: number | null
  evapCoeff: number
  totalAvailableMm: number
  waterLimitedYield: number | null
}) {
  const [falllowEff, setFallowEff] = useState(25)
  const [growingEff, setGrowingEff] = useState(80)
  const [seasonAdj, setSeasonAdj] = useState(0)

  const adjFallow = Math.round(totalFallowMm * falllowEff / 100)
  const adjGrowing = Math.round(totalGrowingMm * growingEff / 100 * (1 + seasonAdj / 100))
  const adjRemaining = Math.round(totalRemainingMm * growingEff / 100 * (1 + seasonAdj / 100))
  const stored = storedSoilWaterMm ?? adjFallow
  const totalWater = Math.max(0, stored + adjGrowing + adjRemaining - evapCoeff)

  const sourceColor = (s: string) => {
    if (s === 'station') return '#4ade80'
    if (s === 'bom-historical') return '#60a5fa'
    if (s === 'bom-forecast') return '#facc15'
    return '#a896c0'
  }

  const sourceLabel = (s: string) => {
    if (s === 'station') return 'WW'
    if (s === 'bom-historical') return 'BOM'
    if (s === 'bom-forecast') return '7d fcst'
    return 'avg'
  }

  return (
    <div>
      {/* Efficiency sliders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>Fallow efficiency</span>
            <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{falllowEff}%</span>
          </div>
          <input type="range" min={5} max={50} step={5} value={falllowEff} onChange={e => setFallowEff(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--orange)' }} />
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Nov → planting (summer fallow)</div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>Growing season efficiency</span>
            <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{growingEff}%</span>
          </div>
          <input type="range" min={50} max={100} step={5} value={growingEff} onChange={e => setGrowingEff(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--orange)' }} />
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Planting → harvest</div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            <span>Season adjustment</span>
            <span style={{ color: seasonAdj > 0 ? '#4ade80' : seasonAdj < 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>{seasonAdj > 0 ? '+' : ''}{seasonAdj}%</span>
          </div>
          <input type="range" min={-30} max={30} step={5} value={seasonAdj} onChange={e => setSeasonAdj(parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--purple)' }} />
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Adjust future rainfall outlook</div>
        </div>
      </div>

      {/* Monthly table */}
      <div style={{ overflowX: 'auto', marginBottom: 16 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Month', 'Rainfall', 'Source', 'Period', 'Efficiency', 'Available'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: m.period === 'fallow' ? 'rgba(239,68,68,0.03)' : m.period === 'remaining' ? 'rgba(161,134,192,0.05)' : 'transparent' }}>
                <td style={{ padding: '7px 10px', fontWeight: 500 }}>{m.label}</td>
                <td style={{ padding: '7px 10px' }}>{m.rainfallMm.toFixed(1)} mm</td>
                <td style={{ padding: '7px 10px' }}>
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: sourceColor(m.source) + '22', color: sourceColor(m.source) }}>
                    {sourceLabel(m.source)}
                  </span>
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)', fontSize: 11 }}>
                  {m.period === 'fallow' ? 'Fallow' : m.period === 'remaining' ? 'Forecast' : 'Growing'}
                </td>
                <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>
                  {m.period === 'fallow' ? `${falllowEff}%` : `${growingEff}%`}
                </td>
                <td style={{ padding: '7px 10px', fontWeight: 500, color: m.period === 'fallow' ? '#60a5fa' : m.period === 'remaining' ? '#a896c0' : '#4ade80' }}>
                  {m.period === 'fallow'
                    ? (m.rainfallMm * falllowEff / 100).toFixed(1)
                    : (m.rainfallMm * growingEff / 100 * (1 + seasonAdj / 100)).toFixed(1)} mm
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, padding: '14px 0', borderTop: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#60a5fa' }}>{adjFallow} mm</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Stored soil water</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#4ade80' }}>{adjGrowing} mm</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Growing season (actual)</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a896c0' }}>{adjRemaining} mm</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Remaining forecast</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Less evaporation</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>−{evapCoeff} mm</div>
        </div>
        <div style={{ borderLeft: '2px solid var(--orange)', paddingLeft: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>{totalWater} mm</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total available water</div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>
        Sources: 🟢 WS90 actual · 🔵 BOM ERA5 historical · 🟡 BOM 7-day forecast · ⚪ 10-year monthly average
      </div>
    </div>
  )
}
