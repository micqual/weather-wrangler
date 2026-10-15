'use client'
import { useState } from 'react'
import Link from 'next/link'
import FarmMap, { Poly } from './FarmMap'

type Paddock = { id: string; name: string }

export default function V2Shell({ paddocks, polygons }: { paddocks: Paddock[]; polygons: Poly[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = paddocks.find((p) => p.id === selectedId) ?? null
  const hasBoundary = new Set(polygons.map((p) => p.stationId))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '300px 1fr 340px' : '300px 1fr', height: '100vh' }}>
      <aside style={{ borderRight: '1px solid #3f2c57', overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>My paddocks</div>
        {paddocks.map((p) => (
          <button key={p.id} onClick={() => setSelectedId(p.id)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '12px 14px', marginBottom: 8,
            borderRadius: 10, cursor: 'pointer', color: 'inherit', font: 'inherit',
            background: p.id === selectedId ? '#3f2c57' : '#271b38',
            border: p.id === selectedId ? '1px solid #f2762a' : '1px solid transparent',
          }}>
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            {!hasBoundary.has(p.id) && <div style={{ fontSize: 11, color: '#a896c0', marginTop: 2 }}>No boundary drawn</div>}
          </button>
        ))}
        <Link href="/" style={{ display: 'block', marginTop: 24, fontSize: 12, color: '#a896c0' }}>Back to classic view</Link>
      </aside>

      <main style={{ position: 'relative', minHeight: 0 }}>
        <FarmMap polygons={polygons} selectedId={selectedId} onSelect={setSelectedId} />
      </main>

      {selected && (
        <section style={{ borderLeft: '1px solid #3f2c57', overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{selected.name}</div>
            <button onClick={() => setSelectedId(null)} style={{ background: 'none', border: 'none', color: '#a896c0', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: 16, borderRadius: 10, background: '#271b38', color: '#a896c0', fontSize: 13, marginBottom: 16 }}>
            Conditions, jobs and spray history will appear here.
          </div>
          <Link href={'/station/' + selected.id} style={{ display: 'block', padding: '12px 14px', borderRadius: 10, background: '#f2762a', color: '#fff', textAlign: 'center', fontWeight: 600, textDecoration: 'none' }}>
            Open full paddock page →
          </Link>
        </section>
      )}
    </div>
  )
}
