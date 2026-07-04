import { interpretPhosphorus, STATUS_CONFIG } from '@/lib/phosphorus'

type PTest = {
  tested_at: Date
  p_colwell_mg_kg: number | null
  pbi: number | null
  ph_cacl2: number | null
  zone_id: string | null
}

export default function PhosphorusPanel({
  tests,
  targetYieldTHa,
  hectares,
  cropName,
  zoneName,
}: {
  tests: PTest[]
  targetYieldTHa: number | null
  hectares: number | null
  cropName: string | null
  zoneName?: string
}) {
  const latest = tests[0]
  if (!latest) return null

  const result = interpretPhosphorus(
    latest.p_colwell_mg_kg,
    latest.pbi,
    targetYieldTHa,
    hectares,
    cropName
  )

  const statusCfg = result.colwellStatus ? STATUS_CONFIG[result.colwellStatus] : null

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 14 }}>
      {zoneName && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{zoneName}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 10 }}>
        {latest.p_colwell_mg_kg != null && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: statusCfg?.color ?? 'var(--text)' }}>
              {latest.p_colwell_mg_kg} mg/kg
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Colwell P</div>
          </div>
        )}
        {result.criticalColwellP != null && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{result.criticalColwellP} mg/kg</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Critical P</div>
          </div>
        )}
        {latest.pbi != null && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{latest.pbi}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>PBI · {result.pbiClass}</div>
          </div>
        )}
        {latest.ph_cacl2 != null && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{latest.ph_cacl2}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>pH (CaCl₂)</div>
          </div>
        )}
        {statusCfg && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: statusCfg.color }}>{statusCfg.icon} {statusCfg.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>P status</div>
          </div>
        )}
        {result.capitalPRequired != null && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: result.colwellStatus === 'deficient' || result.colwellStatus === 'marginal' ? '#f97316' : 'var(--text)' }}>
              {result.capitalPRequired} kg P/ha
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {result.colwellStatus === 'adequate' || result.colwellStatus === 'high' ? 'Maintenance P' : 'Capital P needed'}
            </div>
          </div>
        )}
        {result.capitalPFertiliser != null && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{result.capitalPFertiliser} kg/ha</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>DAP equiv.</div>
          </div>
        )}
      </div>

      {result.notes.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 4 }}>
          {result.notes.map((n, i) => <div key={i}>{n}</div>)}
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
        Tested: {new Date(latest.tested_at).toLocaleDateString('en-AU')}
        {result.buildUpFactor && ` · P export ~${result.buildUpFactor} kg P/t grain`}
      </div>
    </div>
  )
}
