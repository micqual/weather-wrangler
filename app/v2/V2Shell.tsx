'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import FarmMap, { MapShape, Basemap } from './FarmMap'

type Paddock = { id: string; name: string; crop: string | null }
type Polygon = { id: string; stationId: string; geojson: any }

const ACCENT = '#f2762a'
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

const CROP_COLOURS: Record<string, string> = {
  wheat: '#d4a62a', barley: '#4f8fe0', canola: '#e3cf2f', lupins: '#9b6bd6', lupin: '#9b6bd6',
  oats: '#5fb36b', oat: '#5fb36b', faba: '#3fa39a', beans: '#3fa39a', lentils: '#c7713a', pasture: '#6ab04c',
}
const FALLBACK = ['#e07b5f', '#5f9ee0', '#b05fe0', '#5fe0b4', '#e0c35f']
function colourFor(crop: string | null) {
  if (!crop) return '#9aa39a'
  const key = crop.toLowerCase()
  for (const k of Object.keys(CROP_COLOURS)) if (key.includes(k)) return CROP_COLOURS[k]
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return FALLBACK[h % FALLBACK.length]
}

const R = 6378137
const rad = (d: number) => (d * Math.PI) / 180
function ringArea(c: number[][]) {
  if (c.length < 3) return 0
  let a = 0
  for (let i = 0; i < c.length; i++) {
    const [x1, y1] = c[i]
    const [x2, y2] = c[(i + 1) % c.length]
    a += rad(x2 - x1) * (2 + Math.sin(rad(y1)) + Math.sin(rad(y2)))
  }
  return Math.abs((a * R * R) / 2)
}
function polyArea(rings: number[][][]) {
  if (!rings?.length) return 0
  let a = ringArea(rings[0])
  for (let i = 1; i < rings.length; i++) a -= ringArea(rings[i])
  return a
}
function geomArea(g: any): number {
  if (!g) return 0
  switch (g.type) {
    case 'FeatureCollection': return g.features.reduce((s: number, f: any) => s + geomArea(f), 0)
    case 'Feature': return geomArea(g.geometry)
    case 'GeometryCollection': return g.geometries.reduce((s: number, x: any) => s + geomArea(x), 0)
    case 'Polygon': return polyArea(g.coordinates)
    case 'MultiPolygon': return g.coordinates.reduce((s: number, p: any) => s + polyArea(p), 0)
    default: return 0
  }
}

const TABS = ['Overview', 'Conditions', 'Soil', 'Nitrogen', 'History'] as const
type Tab = (typeof TABS)[number]

const pillBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
  font: 'inherit', fontSize: 14, color: '#1d211c', whiteSpace: 'nowrap',
}
const card: React.CSSProperties = { border: '1px solid #e6e6df', borderRadius: 16, padding: 18, marginBottom: 14, background: '#fff' }

export default function V2Shell({ paddocks, polygons }: { paddocks: Paddock[]; polygons: Polygon[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [basemap, setBasemap] = useState<Basemap>('satellite')
  const [locateTick, setLocateTick] = useState(0)
  const [listOpen, setListOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('Overview')

  const byId = useMemo(() => Object.fromEntries(paddocks.map((p) => [p.id, p])), [paddocks])

  const hectares = useMemo(() => {
    const out: Record<string, number> = {}
    for (const p of polygons) out[p.stationId] = (out[p.stationId] ?? 0) + geomArea(p.geojson) / 10000
    return out
  }, [polygons])

  const shapes: MapShape[] = useMemo(() => polygons.map((p) => {
    const pad = byId[p.stationId]
    return { polyId: p.id, stationId: p.stationId, label: pad?.name ?? p.stationId, sublabel: pad?.crop ?? null, color: colourFor(pad?.crop ?? null), geojson: p.geojson }
  }), [polygons, byId])

  const selected = selectedId ? byId[selectedId] : null
  const select = (id: string) => { setSelectedId(id); setTab('Overview'); setListOpen(false) }
  const ha = (id: string) => (hectares[id] ? hectares[id].toFixed(1) + ' ha' : 'No boundary')

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f4f4ef', color: '#1d211c', fontFamily: FONT }}>
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <FarmMap shapes={shapes} selectedId={selectedId} onSelect={select} basemap={basemap} locateTick={locateTick} />

        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1001, display: 'flex', gap: 2, padding: 4, background: '#fff', borderRadius: 999, boxShadow: '0 2px 10px rgba(0,0,0,.15)' }}>
          <button style={{ ...pillBtn, background: listOpen ? '#f4f4ef' : 'none' }} onClick={() => setListOpen(!listOpen)}>Paddocks ▾</button>
          <button style={pillBtn} onClick={() => setBasemap(basemap === 'satellite' ? 'map' : 'satellite')}>
            {basemap === 'satellite' ? 'Map view' : 'Satellite view'}
          </button>
          <button style={pillBtn} onClick={() => setLocateTick((t) => t + 1)}>My location</button>
          <Link href="/" style={{ ...pillBtn, textDecoration: 'none', color: '#6b6f68' }}>Classic view</Link>
        </div>

        {listOpen && (
          <div style={{ position: 'absolute', top: 68, left: 16, zIndex: 1001, width: 300, maxHeight: '60vh', overflowY: 'auto', background: '#fff', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,.18)', padding: 8 }}>
            {paddocks.map((p) => (
              <button key={p.id} onClick={() => select(p.id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 12px',
                border: 'none', borderRadius: 10, cursor: 'pointer', font: 'inherit', color: 'inherit',
                background: p.id === selectedId ? '#fff3ea' : 'transparent',
              }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: colourFor(p.crop), flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#6b6f68' }}>{(p.crop ?? 'No crop set') + ' · ' + ha(p.id)}</div>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <aside style={{ width: 420, flexShrink: 0, background: '#fff', borderLeft: '1px solid #e6e6df', overflowY: 'auto', padding: '24px 24px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 600 }}>{selected.name}</div>
              <div style={{ fontSize: 14, color: '#6b6f68', marginTop: 2 }}>{(selected.crop ?? 'No crop set') + ' · ' + ha(selected.id)}</div>
            </div>
            <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', fontSize: 26, lineHeight: 1, color: '#6b6f68', cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ display: 'flex', gap: 6, margin: '20px 0', overflowX: 'auto', paddingBottom: 4 }}>
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{
                ...pillBtn, fontSize: 13, padding: '7px 14px',
                border: '1px solid ' + (t === tab ? ACCENT : '#e6e6df'),
                background: t === tab ? '#fff3ea' : '#fff', color: t === tab ? '#c4561a' : '#1d211c', fontWeight: t === tab ? 600 : 400,
              }}>{t}</button>
            ))}
          </div>

          {tab === 'Overview' ? (
            <>
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: colourFor(selected.crop) }} />
                  <span style={{ fontWeight: 600 }}>{selected.crop ?? 'No crop set'}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{hectares[selected.id] ? hectares[selected.id].toFixed(1) : '—'} <span style={{ fontSize: 14, fontWeight: 400, color: '#6b6f68' }}>ha</span></div>
              </div>
              <div style={{ ...card, color: '#6b6f68', fontSize: 14 }}>
                <div style={{ fontWeight: 600, color: '#1d211c', marginBottom: 6 }}>Live conditions</div>
                Temperature, rain, wind, Delta T and the spray window from this paddock&apos;s station will show here.
              </div>
            </>
          ) : (
            <div style={{ ...card, color: '#6b6f68', fontSize: 14 }}>
              <div style={{ fontWeight: 600, color: '#1d211c', marginBottom: 6 }}>{tab}</div>
              Coming to this panel soon. For now it&apos;s on the full paddock page.
            </div>
          )}

          <Link href={'/station/' + selected.id} style={{ display: 'block', padding: '13px 16px', borderRadius: 12, background: ACCENT, color: '#fff', textAlign: 'center', fontWeight: 600, textDecoration: 'none', marginTop: 6 }}>
            Open full paddock page →
          </Link>
        </aside>
      )}
    </div>
  )
}
