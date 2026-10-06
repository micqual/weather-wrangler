'use client'

import { useState } from 'react'

type DayRain = { date: string; rain: number }
type BomMonthly = { month: string; bom: number; station: number }

function BarChart({ data, color = '#60a5fa', label }: { data: { label: string; value: number }[]; color?: string; label: string }) {
  const [tooltip, setTooltip] = useState<{ i: number } | null>(null)
  if (data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const h = 120

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: h, position: 'relative' }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'pointer', position: 'relative' }}
            onMouseEnter={() => setTooltip({ i })}
            onMouseLeave={() => setTooltip(null)}
          >
            {tooltip?.i === i && (
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap', zIndex: 10, marginBottom: 4 }}>
                <div style={{ fontWeight: 600 }}>{d.value.toFixed(1)} mm</div>
                <div style={{ color: 'var(--text-muted)' }}>{d.label}</div>
              </div>
            )}
            <div style={{ width: '100%', background: d.value > 0 ? color : 'var(--border)', borderRadius: '2px 2px 0 0', height: `${(d.value / max) * (h - 20)}px`, minHeight: d.value > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}

export default function RainCharts({ days, seasonDays, bomMonthly, rainEvents }: {
  days: DayRain[]
  seasonDays: DayRain[]
  bomMonthly: BomMonthly[]
  rainEvents: DayRain[]
}) {
  const barData = days.map(d => ({
    label: new Date(d.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    value: d.rain,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* 30 day bar chart */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
        <BarChart data={barData} color='#60a5fa' label='Daily rainfall — last 30 days' />
      </div>

      {/* Monthly comparison */}
      {bomMonthly.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Monthly — station vs BOM</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
            {bomMonthly.map((m, i) => {
              const max = Math.max(...bomMonthly.flatMap(d => [d.bom, d.station]), 1)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 1, height: 100 }}>
                    <div style={{ flex: 1, background: '#60a5fa', borderRadius: '2px 2px 0 0', height: `${(m.station / max) * 100}%` }} title={`Station: ${m.station}mm`} />
                    <div style={{ flex: 1, background: 'var(--border)', borderRadius: '2px 2px 0 0', height: `${(m.bom / max) * 100}%` }} title={`BOM: ${m.bom}mm`} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.month}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span><span style={{ color: '#60a5fa' }}>■</span> Station</span>
            <span><span style={{ color: 'var(--text-muted)' }}>■</span> BOM</span>
          </div>
        </div>
      )}

      {/* Cumulative season chart */}
      {seasonDays.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cumulative season rainfall</div>
          {(() => {
            const cumulative: { label: string; value: number }[] = []
            let running = 0
            for (const d of seasonDays) {
              running += d.rain
              cumulative.push({
                label: new Date(d.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
                value: Math.round(running * 10) / 10,
              })
            }
            const max = Math.max(...cumulative.map(d => d.value), 1)
            const w = 100
            const h = 120
            const points = cumulative.map((d, i) => `${(i / (cumulative.length - 1)) * w},${h - (d.value / max) * h}`).join(' ')
            return (
              <svg viewBox={`0 0 100 ${h}`} style={{ width: '100%', height: 'auto' }} preserveAspectRatio="none">
                <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                <polygon points={`0,${h} ${points} ${w},${h}`} fill="#60a5fa" fillOpacity="0.15" />
              </svg>
            )
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
            <span>{seasonDays[0]?.date ? new Date(seasonDays[0].date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}</span>
            <span>{seasonDays[seasonDays.length - 1]?.date ? new Date(seasonDays[seasonDays.length - 1].date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : ''}</span>
          </div>
        </div>
      )}

      {/* Rain events table */}
      {rainEvents.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Recent rain events</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 0', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Date</th>
                <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Amount</th>
                <th style={{ padding: '6px 0', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Category</th>
              </tr>
            </thead>
            <tbody>
              {rainEvents.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0', color: 'var(--text)' }}>
                    {new Date(e.date).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: '#60a5fa' }}>{e.rain.toFixed(1)} mm</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                    {e.rain >= 25 ? '🔵 Heavy' : e.rain >= 10 ? '🟢 Moderate' : e.rain >= 5 ? '🟡 Light' : '⚪ Trace'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
