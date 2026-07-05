import { deleteNitrogenTest, deletePhosphorusTest } from '@/lib/soilTestActions'
import AddNitrogenTestForm from './AddNitrogenTestForm'
import AddPhosphorusTestForm from './AddPhosphorusTestForm'
import PhosphorusPanel from './PhosphorusPanel'
import PHPanel from './PHPanel'
import NutrientInterpretationPanel from './NutrientInterpretationPanel'

type Zone = { id: string; name: string }
type NTest = {
  id: number
  zone_id: string | null
  tested_at: Date
  no3_n_kg_ha: number
  nh4_n_kg_ha: number | null
  sulphur_mg_kg: number | null
  chloride_mg_kg: number | null
}
type PTest = {
  id: number
  zone_id: string | null
  tested_at: Date
  p_colwell_mg_kg: number | null
  pbi: number | null
  ph_cacl2: number | null
}

function levelLabel(zoneId: string | null, zones: Zone[]) {
  if (!zoneId) return 'Whole paddock'
  return zones.find(z => z.id === zoneId)?.name ?? 'Unknown zone'
}

export default function SoilTestsSection({
  stationId,
  zones,
  nitrogenTests,
  phosphorusTests,
  targetYieldTHa,
  hectares,
  cropName,
  soilType,
}: {
  stationId: string
  zones: Zone[]
  nitrogenTests: NTest[]
  phosphorusTests: PTest[]
  targetYieldTHa?: number | null
  hectares?: number | null
  cropName?: string | null
  soilType?: string | null
}) {
  return (
    <div>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)', margin: '0 0 8px' }}>Nitrogen</h4>
      {nitrogenTests.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>No nitrogen tests yet.</p>}
      {nitrogenTests.map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
          <span>
            {new Date(t.tested_at).toLocaleDateString('en-AU')} · {levelLabel(t.zone_id, zones)} · NO3 {t.no3_n_kg_ha} kg/ha
            {t.nh4_n_kg_ha != null ? ` · NH4 ${t.nh4_n_kg_ha} kg/ha` : ''}
            {t.sulphur_mg_kg != null ? ` · S ${t.sulphur_mg_kg} mg/kg` : ''}
            {t.chloride_mg_kg != null ? ` · Cl ${t.chloride_mg_kg} mg/kg` : ''}
          </span>
          <form action={deleteNitrogenTest}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="station_id" value={stationId} />
            <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
          </form>
        </div>
      ))}
      {nitrogenTests.filter(t => !t.zone_id).length > 0 && (() => {
        const latest = nitrogenTests.filter(t => !t.zone_id)[0]
        return (
          <NutrientInterpretationPanel
            sulphurMgKg={latest.sulphur_mg_kg ?? null}
            chlorideMgKg={latest.chloride_mg_kg ?? null}
            currentPH={phosphorusTests.filter(t => !t.zone_id)[0]?.ph_cacl2 ?? null}
            soilType={soilType ?? null}
            cropName={cropName ?? null}
            hectares={hectares ?? null}
          />
        )
      })()}
      <AddNitrogenTestForm stationId={stationId} zones={zones} />

      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', margin: '20px 0 8px' }}>Phosphorus</h4>
      {phosphorusTests.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>No phosphorus tests yet.</p>}
      {phosphorusTests.map(t => (
        <div key={t.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>
              {new Date(t.tested_at).toLocaleDateString('en-AU')} · {levelLabel(t.zone_id, zones)}
              {t.p_colwell_mg_kg != null ? ` · P (Colwell) ${t.p_colwell_mg_kg} mg/kg` : ''}
              {t.pbi != null ? ` · PBI ${t.pbi}` : ''}
              {t.ph_cacl2 != null ? ` · pH ${t.ph_cacl2}` : ''}
            </span>
            <form action={deletePhosphorusTest}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="station_id" value={stationId} />
              <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
            </form>
          </div>
        </div>
      ))}

      {/* P interpretation for paddock-level tests */}
      {phosphorusTests.filter(t => !t.zone_id).length > 0 && (
        <PhosphorusPanel
          tests={phosphorusTests.filter(t => !t.zone_id)}
          targetYieldTHa={targetYieldTHa ?? null}
          hectares={hectares ?? null}
          cropName={cropName ?? null}
        />
      )}

      {/* P interpretation per zone */}
      {zones.map(z => {
        const zoneTests = phosphorusTests.filter(t => t.zone_id === z.id)
        if (zoneTests.length === 0) return null
        return (
          <PhosphorusPanel
            key={z.id}
            tests={zoneTests}
            targetYieldTHa={targetYieldTHa ?? null}
            hectares={hectares ?? null}
            cropName={cropName ?? null}
            zoneName={z.name}
          />
        )
      })}

      {/* pH tracking — from phosphorus tests that have ph_cacl2 */}
      {phosphorusTests.filter(t => !t.zone_id && t.ph_cacl2 != null).length > 0 && (
        <PHPanel
          readings={phosphorusTests.filter(t => !t.zone_id && t.ph_cacl2 != null).map(t => ({ tested_at: t.tested_at, ph_cacl2: t.ph_cacl2 as number, zone_id: t.zone_id }))}
          cropName={cropName ?? null}
          soilType={soilType ?? null}
        />
      )}

      {zones.map(z => {
        const zPhTests = phosphorusTests.filter(t => t.zone_id === z.id && t.ph_cacl2 != null)
        if (zPhTests.length === 0) return null
        return (
          <PHPanel
            key={z.id}
            readings={zPhTests.map(t => ({ tested_at: t.tested_at, ph_cacl2: t.ph_cacl2 as number, zone_id: t.zone_id }))}
            cropName={cropName ?? null}
            soilType={soilType ?? null}
            zoneName={z.name}
          />
        )
      })}

      <AddPhosphorusTestForm stationId={stationId} zones={zones} />

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
        Critical Colwell P calculated from PBI using Moody (2007) formula. Capital P estimates are indicative — confirm with your agronomist.
      </div>
    </div>
  )
}
