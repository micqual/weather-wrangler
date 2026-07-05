'use client'

import { useState } from 'react'
import { interpretSulphur, interpretChloride, calcLimeRequirement } from '@/lib/nutrientInterpretation'

export default function NutrientInterpretationPanel({
  sulphurMgKg,
  chlorideMgKg,
  currentPH,
  soilType,
  cropName,
  hectares,
}: {
  sulphurMgKg: number | null
  chlorideMgKg: number | null
  currentPH: number | null
  soilType: string | null
  cropName: string | null
  hectares: number | null
}) {
  const [limeNV, setLimeNV] = useState(88)
  const [targetPH, setTargetPH] = useState(5.8)

  const sulphur = sulphurMgKg != null ? interpretSulphur(sulphurMgKg, cropName) : null
  const chloride = chlorideMgKg != null ? interpretChloride(chlorideMgKg, soilType, cropName) : null
  const lime = currentPH != null ? calcLimeRequirement(currentPH, targetPH, soilType, limeNV, hectares) : null

  if (!sulphur && !chloride && !lime) return null

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, fontWeight: 600 }}>
        Nutrient interpretation
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>

        {/* Sulphur */}
        {sulphur && (
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Sulphur (KCl40)</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: sulphur.color }}>{sulphurMgKg} mg/kg</div>
            <div style={{ fontSize: 13, color: sulphur.color, fontWeight: 500, marginTop: 2 }}>{sulphur.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{sulphur.interpretation}</div>
            {sulphur.recommendationKgHa != null && (
              <div style={{ fontSize: 12, color: '#f97316', marginTop: 4 }}>
                Suggested: ~{sulphur.recommendationKgHa} kg S/ha
              </div>
            )}
          </div>
        )}

        {/* Chloride */}
        {chloride && (
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Chloride</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: chloride.color }}>{chlorideMgKg} mg/kg</div>
            <div style={{ fontSize: 13, color: chloride.color, fontWeight: 500, marginTop: 2 }}>{chloride.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{chloride.interpretation}</div>
          </div>
        )}

        {/* Lime calculator */}
        {lime != null && currentPH != null && (
          <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Lime calculator</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Target pH:
                <input
                  type="number" step="0.1" min="5.0" max="7.5"
                  value={targetPH}
                  onChange={e => setTargetPH(parseFloat(e.target.value))}
                  style={{ width: 60, marginLeft: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}
                />
              </label>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Lime NV%:
                <input
                  type="number" step="1" min="50" max="100"
                  value={limeNV}
                  onChange={e => setLimeNV(parseInt(e.target.value))}
                  style={{ width: 55, marginLeft: 6, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}
                />
              </label>
            </div>
            {lime.rateMin === 0 ? (
              <div style={{ fontSize: 13, color: '#4ade80' }}>No lime required</div>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f97316' }}>
                  {lime.rateMin}–{lime.rateMax} t/ha
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  To raise pH {currentPH} → {targetPH}
                </div>
                {lime.totalTonnesMin != null && (
                  <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 4 }}>
                    Total: {lime.totalTonnesMin}–{lime.totalTonnesMax} t for {hectares} ha
                  </div>
                )}
              </>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
              Estimate only — confirm with agronomist
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {[...(sulphur?.notes ?? []), ...(chloride?.notes ?? [])].length > 0 && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
          {[...(sulphur?.notes ?? []), ...(chloride?.notes ?? [])].slice(0, 4).map((n, i) => <div key={i}>· {n}</div>)}
        </div>
      )}
    </div>
  )
}
