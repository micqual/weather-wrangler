'use client'

import { useMemo } from 'react'
import { interpretPH, estimateLimeRate } from '@/lib/phInterpretation'

type PHReading = {
  tested_at: Date
  ph_cacl2: number
  zone_id: string | null
}

export default function PHPanel({
  readings,
  cropName,
  soilType,
  zoneName,
}: {
  readings: PHReading[]
  cropName: string | null
  soilType: string | null
  zoneName?: string
}) {
  const latest = readings[readings.length - 1]
  if (!latest) return null

  const result = interpretPH(latest.ph_cacl2, cropName)
  const targetPH = 5.8 // Standard target for southern Australian cereals
  const lime = result.limeRequired ? estimateLimeRate(latest.ph_cacl2, targetPH, soilType) : null

  // Trend
  const trend = readings.length > 1
    ? latest.ph_cacl2 - readings[0].ph_cacl2
    : null
  const trendLabel = trend == null ? null
    : trend > 0.1 ? `↑ +${trend.toFixed(1)} since first test`
    : trend < -0.1 ? `↓ ${trend.toFixed(1)} — acidifying`
    : '→ Stable'
  const trendColor = trend == null ? 'var(--text-muted)'
    : trend < -0.1 ? '#ef4444'
    : trend > 0.1 ? '#4ade80'
    : 'var(--text-muted)'

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      {zoneName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{zoneName}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: result.color }}>{latest.ph_cacl2}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>pH (CaCl₂)</div>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: result.color }}>{result.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</div>
        </div>
        {trendLabel && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: trendColor }}>{trendLabel}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trend ({readings.length} tests)</div>
          </div>
        )}
        {lime && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#f97316' }}>{lime.rateMin}–{lime.rateMax} t/ha</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Lime to reach pH {targetPH}</div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 6 }}>
        {result.interpretation}
      </div>

      {result.notes.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {result.notes.map((n, i) => <div key={i}>· {n}</div>)}
        </div>
      )}

      {lime && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
          {lime.notes}
        </div>
      )}

      {/* pH history timeline */}
      {readings.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>pH history</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {readings.map((r, i) => {
              const res = interpretPH(r.ph_cacl2, cropName)
              return (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: res.color }}>{r.ph_cacl2}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(r.tested_at).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        Latest test: {new Date(latest.tested_at).toLocaleDateString('en-AU')}
      </div>
    </div>
  )
}
