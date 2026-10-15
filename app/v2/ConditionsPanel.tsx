'use client'
import { useCallback, useEffect, useState } from 'react'
import { getConditions } from './conditions'
import type { Conditions } from './types'

const card: React.CSSProperties = { border: '1px solid #e6e6df', borderRadius: 16, padding: 18, marginBottom: 14, background: '#fff' }
const muted = '#6b6f68'

const STATUS = {
  go: { bg: '#e9f5ea', fg: '#2e7d32', dot: '#43a047', label: 'Good to spray' },
  caution: { bg: '#fff6e0', fg: '#a35f00', dot: '#f2a900', label: 'Spray with caution' },
  stop: { bg: '#fdecea', fg: '#c62828', dot: '#e53935', label: 'Not suitable to spray' },
}

const num = (n: number | null, dp: number, unit: string) => (n == null ? '—' : n.toFixed(dp) + unit)

function ago(iso: string | null) {
  if (!iso) return { text: 'unknown', stale: true }
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  const text = mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago' : mins < 1440 ? Math.round(mins / 60) + ' h ago' : Math.round(mins / 1440) + ' d ago'
  return { text, stale: mins > 60 }
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#f7f7f3', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, color: muted }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default function ConditionsPanel({ stationId, compact = false }: { stationId: string; compact?: boolean }) {
  const [data, setData] = useState<Conditions | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getConditions(stationId)
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [stationId])

  useEffect(() => { load() }, [load])

  if (loading && !data) return <div style={{ ...card, color: muted, fontSize: 14 }}>Loading conditions…</div>
  if (!data || !data.hasData) return <div style={{ ...card, color: muted, fontSize: 14 }}>No readings from this paddock&apos;s station yet.</div>

  const st = STATUS[data.sprayOverall] ?? STATUS.stop
  const age = ago(data.readingAt)
  const wind = data.windKmh == null ? '—' : data.windKmh.toFixed(0) + ' km/h'

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: age.stale ? '#c4561a' : muted, marginTop: 12 }}>
      <span>
        {age.stale ? 'Last reading ' : 'Updated '}{age.text}
        {data.borrowedFrom ? ' · from borrowed station ' + data.borrowedFrom : ''}
      </span>
      <button onClick={load} disabled={loading} style={{ background: 'none', border: 'none', color: '#c4561a', cursor: 'pointer', font: 'inherit', fontSize: 12, fontWeight: 600 }}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  )

  if (compact) {
    return (
      <div style={card}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: st.bg, color: st.fg, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: st.dot }} />{st.label}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Tile label="Temp" value={num(data.tempC, 1, '°')} />
          <Tile label="Wind" value={wind} sub={data.windDir ?? undefined} />
          <Tile label="Rain since 9am" value={num(data.rainToday, 1, ' mm')} />
          <Tile label="Delta T" value={num(data.deltaT, 1, '°')} />
        </div>
        {footer}
      </div>
    )
  }

  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: st.bg, color: st.fg, fontWeight: 600, marginBottom: 12 }}>
          <span style={{ width: 10, height: 10, borderRadius: 5, background: st.dot }} />{st.label}
        </div>
        {data.sprayConditions.map((c, i) => {
          const cs = STATUS[c.status] ?? STATUS.stop
          return (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i ? '1px solid #f0f0ea' : 'none' }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: cs.dot, marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{c.label}</span><span>{c.value}</span>
                </div>
                {c.reason && <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{c.reason}</div>}
              </div>
            </div>
          )
        })}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Current readings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Tile label="Temperature" value={num(data.tempC, 1, '°C')} />
          <Tile label="Humidity" value={num(data.humidity, 0, '%')} />
          <Tile label="Wind" value={wind} sub={data.windDir ?? undefined} />
          <Tile label="Gusts" value={data.gustKmh == null ? '—' : data.gustKmh.toFixed(0) + ' km/h'} />
          <Tile label="Delta T" value={num(data.deltaT, 1, '°C')} />
          <Tile label="UV index" value={num(data.uvi, 1, '')} />
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Rain <span style={{ fontWeight: 400, fontSize: 12, color: muted }}>· 9am to 9am</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Tile label="Since 9am" value={num(data.rainToday, 1, '')} sub="mm" />
          <Tile label="Yesterday" value={num(data.rainYesterday, 1, '')} sub="mm" />
          <Tile label="Last 7 days" value={num(data.rain7d, 1, '')} sub="mm" />
        </div>
        {footer}
      </div>
    </>
  )
}
