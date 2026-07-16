'use client'

import { useMemo } from 'react'

export type DecileBar = {
  label: string
  rainfallMm: number
  waterLimitedTHa: number
  nLimitedTHa: number
  recommendedNKgHa: number
}

export default function DecileYieldChart({ bars }: { bars: DecileBar[] }) {
  const maxYield = useMemo(() => Math.max(...bars.map(b => b.waterLimitedTHa), 1), [bars])

  return (
    <div>


      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 220, padding: '0 8px' }}>
        {bars.map((bar, i) => {
          const totalHeight = 180
          const waterHeight = (bar.waterLimitedTHa / maxYield) * totalHeight
          const nHeight = (bar.nLimitedTHa / maxYield) * totalHeight

          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {/* Bar container */}
              <div style={{ width: '100%', position: 'relative', height: totalHeight, display: 'flex', alignItems: 'flex-end' }}>
                {/* Water-limited bar (dark) */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '100%',
                  height: waterHeight,
                  background: '#92400e',
                  borderRadius: '4px 4px 0 0',
                }} />
                {/* N-limited bar (light) */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '100%',
                  height: nHeight,
                  background: '#f2762a',
                  borderRadius: '4px 4px 0 0',
                }} />
                {/* Yield label */}
                <div style={{
                  position: 'absolute',
                  bottom: nHeight + 4,
                  width: '100%',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                }}>
                  {bar.waterLimitedTHa.toFixed(1)}t
                </div>
              </div>

              {/* Bottom info */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', textAlign: 'center' }}>
                {bar.nLimitedTHa.toFixed(1)} t/ha
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                if {bar.recommendedNKgHa} kgN/ha
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                {bar.rainfallMm} mm
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3, marginTop: 4 }}>
                {bar.label}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
        Yield potential (t/ha) across growing season rainfall scenarios
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, marginTop: 12, justifyContent: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#92400e', display: 'inline-block', borderRadius: 2 }} />
          Yield with unlimited N
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: '#f2762a', display: 'inline-block', borderRadius: 2 }} />
          Yield with current N
        </span>
      </div>
    </div>
  )
}
