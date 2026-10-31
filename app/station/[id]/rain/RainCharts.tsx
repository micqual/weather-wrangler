'use client'

import { useState } from 'react'

type Day = { date: string; rain: number; manual: boolean }
type Monthly = { month: string; station: number; manual: number; bom: number | null }

const BLUE = '#60a5fa'
const GREEN = '#34d399'   // manual entries
const ORANGE = '#f2762a'

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 } as const
const heading = { fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 } as const
const tip = { position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap', zIndex: 10, marginBottom: 4 } as const
const hasManual = (ds: Day[]) => ds.some(d => d.manual && d.rain > 0)
const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

function Legend({ items }: { items: { color: string; label: string; opacity?: number }[] }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
      {items.map((it, i) => <span key={i}><span style={{ color: it.color, opacity: it.opacity ?? 1 }}>■</span> {it.label}</span>)}
    </div>
  )
}

function DailyBars({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...days.map(d => d.rain), 1)
  const h = 120
  return (
    <div>
      <div style={heading}>Daily rainfall — last 30 days</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: h }}>
        {days.map((d, i) => (
          <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', cursor: 'pointer', position: 'relative' }}>
            {hover === i && (
              <div style={tip}>
                <div style={{ fontWeight: 600 }}>{d.rain.toFixed(1)} mm{d.manual ? ' (manual entry)' : ''}</div>
                <div style={{ color: 'var(--text-muted)' }}>{fmtDay(d.date)}</div>
              </div>
            )}
            <div style={{ width: '100%', background: d.rain > 0 ? (d.manual ? GREEN : BLUE) : 'var(--border)', borderRadius: '2px 2px 0 0', height: `${(d.rain / max) * (h - 20)}px`, minHeight: d.rain > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>{fmtDay(days[0].date)}</span><span>{fmtDay(days[Math.floor(days.length / 2)].date)}</span><span>{fmtDay(days[days.length - 1].date)}</span>
      </div>
      {hasManual(days) && <Legend items={[{ color: BLUE, label: 'Station' }, { color: GREEN, label: 'Manual entry' }]} />}
    </div>
  )
}

function MonthlyCompare({ monthly }: { monthly: Monthly[] }) {
  const [hover, setHover] = useState<{ i: number; k: 'stack' | 'bom' } | null>(null)
  const max = Math.max(...monthly.flatMap(m => [m.station + m.manual, m.bom ?? 0]), 1)
  const h = 100
  const anyManual = monthly.some(m => m.manual > 0)
  const anyBom = monthly.some(m => m.bom != null)
  return (
    <div>
      <div style={heading}>Monthly rainfall{anyBom ? ' — station vs BOM' : ''}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {monthly.map((m, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 2, height: h }}>
              <div onMouseEnter={() => setHover({ i, k: 'stack' })} onMouseLeave={() => setHover(null)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: h, cursor: 'pointer', position: 'relative' }}>
                {hover?.i === i && hover.k === 'stack' && (
                  <div style={tip}>
                    {m.station > 0 && <div style={{ fontWeight: 600, color: BLUE }}>Station: {m.station.toFixed(1)} mm</div>}
                    {m.manual > 0 && <div style={{ fontWeight: 600, color: GREEN }}>Manual: {m.manual.toFixed(1)} mm</div>}
                    <div style={{ color: 'var(--text-muted)' }}>{m.month}</div>
                  </div>
                )}
                <div style={{ background: GREEN, height: (m.manual / max) * h, borderRadius: '2px 2px 0 0' }} />
                <div style={{ background: BLUE, height: (m.station / max) * h, borderRadius: m.manual > 0 ? 0 : '2px 2px 0 0' }} />
              </div>
              {m.bom != null && (
                <div onMouseEnter={() => setHover({ i, k: 'bom' })} onMouseLeave={() => setHover(null)}
                  style={{ flex: 1, background: 'var(--text-muted)', opacity: 0.4, borderRadius: '2px 2px 0 0', height: (m.bom / max) * h, cursor: 'pointer', position: 'relative' }}>
                  {hover?.i === i && hover.k === 'bom' && (
                    <div style={tip}><div style={{ fontWeight: 600 }}>BOM: {m.bom.toFixed(1)} mm</div><div style={{ color: 'var(--text-muted)' }}>{m.month}</div></div>
                  )}
                </div>
              )}
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.month}</div>
          </div>
        ))}
      </div>
      <Legend items={[{ color: BLUE, label: 'Station' }, ...(anyManual ? [{ color: GREEN, label: 'Manual entry' }] : []), ...(anyBom ? [{ color: '#9ca3af', label: 'BOM' }] : [])]} />
    </div>
  )
}

function YearOverYear({ allDays }: { allDays: Day[] }) {
  const now = new Date()
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth() - 2, 1).toLocaleDateString('en-CA'))
  const [to, setTo] = useState(now.toLocaleDateString('en-CA'))
  if (allDays.length === 0) return null

  const dayMap = new Map(allDays.map(d => [d.date, d]))
  const dates: string[] = []
  for (const cur = new Date(from + 'T12:00:00'), end = new Date(to + 'T12:00:00'); cur <= end; cur.setDate(cur.getDate() + 1)) dates.push(cur.toLocaleDateString('en-CA'))
  const thisYear = dates.map(d => dayMap.get(d))
  const lastYear = dates.map(d => { const ly = new Date(d + 'T12:00:00'); ly.setFullYear(ly.getFullYear() - 1); return dayMap.get(ly.toLocaleDateString('en-CA')) })
  const sum = (a: (Day | undefined)[]) => a.reduce((s, d) => s + (d?.rain ?? 0), 0)
  const max = Math.max(...[...thisYear, ...lastYear].map(d => d?.rain ?? 0), 1)
  const h = 120
  const anyManual = [...thisYear, ...lastYear].some(d => d?.manual && d.rain > 0)
  const input = { fontSize: 12, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' } as const

  return (
    <div>
      <div style={heading}>This year vs last year</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={input} /></div>
        <div><label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={input} /></div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', paddingBottom: 4, fontSize: 13 }}>
          <span><span style={{ color: BLUE, fontWeight: 600 }}>{sum(thisYear).toFixed(1)} mm</span> <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>this year</span></span>
          <span><span style={{ color: ORANGE, fontWeight: 600 }}>{sum(lastYear).toFixed(1)} mm</span> <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>last year</span></span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: h }}>
        {dates.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 0.5, height: '100%' }}>
            <div title={`${fmtDay(d)}: ${(thisYear[i]?.rain ?? 0).toFixed(1)} mm${thisYear[i]?.manual ? ' (manual)' : ''}`}
              style={{ flex: 1, background: thisYear[i]?.manual ? GREEN : BLUE, borderRadius: '1px 1px 0 0', height: `${((thisYear[i]?.rain ?? 0) / max) * h}px`, minHeight: (thisYear[i]?.rain ?? 0) > 0 ? 2 : 0 }} />
            <div title={`Last year: ${(lastYear[i]?.rain ?? 0).toFixed(1)} mm${lastYear[i]?.manual ? ' (manual)' : ''}`}
              style={{ flex: 1, background: lastYear[i]?.manual ? GREEN : ORANGE, opacity: 0.6, borderRadius: '1px 1px 0 0', height: `${((lastYear[i]?.rain ?? 0) / max) * h}px`, minHeight: (lastYear[i]?.rain ?? 0) > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
        <span>{fmtDay(dates[0])}</span><span>{fmtDay(dates[dates.length - 1])}</span>
      </div>
      <Legend items={[{ color: BLUE, label: 'This year (left bar)' }, { color: ORANGE, label: 'Last year (right bar)', opacity: 0.7 }, ...(anyManual ? [{ color: GREEN, label: 'Manual entry' }] : [])]} />
    </div>
  )
}

function Cumulative({ seasonDays }: { seasonDays: Day[] }) {
  if (seasonDays.length < 2) return null
  let run = 0
  const pts = seasonDays.map(d => { run += d.rain; return { v: run, manual: d.manual } })
  const max = Math.max(run, 1), w = 100, h = 120
  const xy = pts.map((p, i) => ({ x: (i / (pts.length - 1)) * w, y: h - (p.v / max) * h, manual: p.manual }))
  const area = `0,${h} ${xy.map(p => `${p.x},${p.y}`).join(' ')} ${w},${h}`
  return (
    <div>
      <div style={heading}>Cumulative season rainfall</div>
      <svg viewBox={`0 0 100 ${h}`} style={{ width: '100%', height: 'auto' }} preserveAspectRatio="none">
        <polygon points={area} fill={BLUE} fillOpacity="0.15" />
        {xy.slice(1).map((p, i) => (
          <line key={i} x1={xy[i].x} y1={xy[i].y} x2={p.x} y2={p.y} stroke={p.manual ? GREEN : BLUE} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
        <span>{fmtDay(seasonDays[0].date)}</span><span>{fmtDay(seasonDays[seasonDays.length - 1].date)}</span>
      </div>
      {hasManual(seasonDays) && <Legend items={[{ color: BLUE, label: 'Station' }, { color: GREEN, label: 'Manual entry' }]} />}
    </div>
  )
}

export default function RainCharts({ days, seasonDays, allDays, monthly, rainEvents }: {
  days: Day[]; seasonDays: Day[]; allDays: Day[]; monthly: Monthly[]; rainEvents: Day[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={card}><DailyBars days={days} /></div>
      {monthly.length > 0 && <div style={card}><MonthlyCompare monthly={monthly} /></div>}
      <div style={card}><YearOverYear allDays={allDays} /></div>
      {seasonDays.length > 1 && <div style={card}><Cumulative seasonDays={seasonDays} /></div>}
      {rainEvents.length > 0 && (
        <div style={card}>
          <div style={heading}>Recent rain events</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Date', 'Amount', 'Category'].map((t, i) => <th key={t} style={{ padding: '6px 0', textAlign: i === 0 ? 'left' : 'right', color: 'var(--text-muted)', fontWeight: 500 }}>{t}</th>)}
              </tr>
            </thead>
            <tbody>
              {rainEvents.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0' }}>{new Date(e.date + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: e.manual ? GREEN : BLUE }}>{e.rain.toFixed(1)} mm{e.manual ? ' ✎' : ''}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-muted)', fontSize: 11 }}>
                    {e.rain >= 25 ? '🔵 Heavy' : e.rain >= 10 ? '🟢 Moderate' : e.rain >= 5 ? '🟡 Light' : '⚪ Trace'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rainEvents.some(e => e.manual) && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>✎ manual entry</div>}
        </div>
      )}
    </div>
  )
}
