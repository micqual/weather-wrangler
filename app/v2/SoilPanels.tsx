'use client'
import { useEffect, useState } from 'react'
import { getSoilAndN } from './soil'
import type { SoilData } from './soilTypes'

const card: React.CSSProperties = { border: '1px solid #e6e6df', borderRadius: 16, padding: 18, marginBottom: 14, background: '#fff' }
const muted = '#6b6f68'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
const n1 = (v: number | null | undefined, unit = '') => (v == null ? '—' : v.toFixed(1) + unit)
const n0 = (v: number | null | undefined, unit = '') => (v == null ? '—' : Math.round(v) + unit)

function useSoil(stationId: string) {
  const [data, setData] = useState<SoilData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getSoilAndN(stationId).then(setData).catch(() => setData(null)).finally(() => setLoading(false))
  }, [stationId])
  return { data, loading }
}

function Chip({ text, color }: { text: string; color?: string }) {
  const c = color && color.startsWith('#') ? color : '#6b6f68'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: c + '1a', color: c, fontSize: 12, fontWeight: 600 }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: c }} />{text}
    </span>
  )
}

function Notes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null
  return (
    <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: muted, lineHeight: 1.5 }}>
      {notes.map((n, i) => <li key={i}>{n}</li>)}
    </ul>
  )
}

function Head({ title, value, unit }: { title: string; value: string; unit?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
      <span style={{ fontWeight: 600 }}>{title}</span>
      <span style={{ fontSize: 22, fontWeight: 600 }}>{value}{unit && <span style={{ fontSize: 13, fontWeight: 400, color: muted }}> {unit}</span>}</span>
    </div>
  )
}

const Msg = ({ text }: { text: string }) => <div style={{ ...card, color: muted, fontSize: 14 }}>{text}</div>

export function SoilPanel({ stationId }: { stationId: string }) {
  const { data, loading } = useSoil(stationId)
  if (loading) return <Msg text="Loading soil tests…" />
  if (!data) return <Msg text="Could not load soil data." />
  if (!data.pTest && !data.nTest) return <Msg text="No soil tests recorded yet. Add them on the full paddock page." />

  const P = data.phosphorus
  const pStatusColour: Record<string, string> = { deficient: '#e53935', marginal: '#f2a900', adequate: '#43a047', high: '#1e88e5' }

  return (
    <>
      {data.ph && (
        <div style={card}>
          <Head title="pH (CaCl₂)" value={n1(data.pTest?.ph)} />
          <Chip text={data.ph.label} color={data.ph.color} />
          <div style={{ fontSize: 14, marginTop: 10 }}>{data.ph.interpretation}</div>
          {data.lime && data.lime.rateMax > 0 && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: '#f7f7f3', fontSize: 14 }}>
              <div style={{ fontWeight: 600 }}>Lime: {n1(data.lime.rateMin)}–{n1(data.lime.rateMax)} t/ha</div>
              {data.lime.totalTonnesMax != null && <div style={{ color: muted, fontSize: 13 }}>{n0(data.lime.totalTonnesMin)}–{n0(data.lime.totalTonnesMax)} t for the paddock</div>}
              <div style={{ color: muted, fontSize: 12, marginTop: 4 }}>To reach pH 5.5 using ag lime at 90% NV</div>
            </div>
          )}
          <Notes notes={data.ph.notes} />
        </div>
      )}

      {P && (
        <div style={card}>
          <Head title="Phosphorus (Colwell)" value={n0(data.pTest?.colwell)} unit="mg/kg" />
          {P.colwellStatus && <Chip text={P.colwellStatus} color={pStatusColour[P.colwellStatus]} />}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, fontSize: 13 }}>
            <div><span style={{ color: muted }}>PBI</span><br /><b>{n0(data.pTest?.pbi)}</b>{P.pbiClass ? ' · ' + P.pbiClass : ''}</div>
            <div><span style={{ color: muted }}>Critical Colwell P</span><br /><b>{n0(P.criticalColwellP, ' mg/kg')}</b></div>
            {P.capitalPRequired != null && P.capitalPRequired > 0 && (
              <div><span style={{ color: muted }}>Capital P needed</span><br /><b>{n0(P.capitalPRequired, ' kg P/ha')}</b></div>
            )}
            {P.capitalPFertiliser != null && P.capitalPFertiliser > 0 && (
              <div><span style={{ color: muted }}>As DAP</span><br /><b>{n0(P.capitalPFertiliser, ' kg/ha')}</b></div>
            )}
          </div>
          <Notes notes={P.notes} />
        </div>
      )}

      {data.sulphur && (
        <div style={card}>
          <Head title="Sulphur" value={n1(data.nTest?.sulphur)} unit="mg/kg" />
          <Chip text={data.sulphur.label} color={data.sulphur.color} />
          <div style={{ fontSize: 14, marginTop: 10 }}>{data.sulphur.interpretation}</div>
          {data.sulphur.recommendationKgHa != null && data.sulphur.recommendationKgHa > 0 && (
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>Apply about {n0(data.sulphur.recommendationKgHa)} kg S/ha</div>
          )}
          <Notes notes={data.sulphur.notes} />
        </div>
      )}

      {data.chloride && (
        <div style={card}>
          <Head title="Chloride" value={n0(data.nTest?.chloride)} unit="mg/kg" />
          <Chip text={data.chloride.label} color={data.chloride.color} />
          <div style={{ fontSize: 14, marginTop: 10 }}>{data.chloride.interpretation}</div>
          <Notes notes={data.chloride.notes} />
        </div>
      )}

      <div style={{ fontSize: 12, color: muted, margin: '0 4px 14px' }}>
        {data.pTest && <div>pH & P test: {fmtDate(data.pTest.testedAt)} · 0–{data.pTest.depthCm} cm</div>}
        {data.nTest && <div>N, S & Cl test: {fmtDate(data.nTest.testedAt)} · 0–{data.nTest.depthCm} cm</div>}
      </div>
    </>
  )
}

export function NitrogenPanel({ stationId }: { stationId: string }) {
  const { data, loading } = useSoil(stationId)
  if (loading) return <Msg text="Loading nitrogen…" />
  if (!data) return <Msg text="Could not load nitrogen data." />

  const b = data.budget
  const row = (label: string, v: number) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f0f0ea', fontSize: 14 }}>
      <span style={{ color: muted }}>{label}</span><span style={{ fontWeight: 600 }}>{n0(v, ' kg/ha')}</span>
    </div>
  )

  return (
    <>
      <div style={card}>
        <Head title="Available N" value={n0(b.totalAvailable)} unit="kg N/ha" />
        {row('Soil test N', b.soilTestN)}
        {b.ocN > 0 && row('From organic carbon', b.ocN)}
        {row('Applied N retained', b.appliedNRetained)}
        <div style={{ fontSize: 12, color: muted, marginTop: 8 }}>
          {data.nTest ? 'Soil test ' + fmtDate(data.nTest.testedAt) + ' · 0–' + data.nTest.depthCm + ' cm' : 'No N soil test recorded'}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Applications</div>
        <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>{data.seasonFrom ? 'Since planting, ' + fmtDate(data.seasonFrom) : 'All recorded'}</div>
        {data.applications.length === 0 ? (
          <div style={{ fontSize: 14, color: muted }}>No N applications recorded.</div>
        ) : data.applications.map((a) => (
          <div key={a.id} style={{ padding: '10px 0', borderTop: '1px solid #f0f0ea' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ fontWeight: 600 }}>{a.product}</span>
              <span style={{ fontWeight: 600 }}>{n0(a.nKgHa, ' kg N/ha')}</span>
            </div>
            <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
              {fmtDate(a.appliedAt)} · {n0(a.rateKgHa, ' kg/ha')} · {a.method ?? 'broadcast'}{a.incorporated ? ', incorporated' : ''}
              {a.lossKg != null && a.lossKg > 0 ? ' · est. loss ' + n1(a.lossKg, ' kg') : ''}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
