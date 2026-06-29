import { deleteNitrogenTest, deletePhosphorusTest } from '@/lib/soilTestActions'
import AddNitrogenTestForm from './AddNitrogenTestForm'
import AddPhosphorusTestForm from './AddPhosphorusTestForm'

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
}: {
  stationId: string
  zones: Zone[]
  nitrogenTests: NTest[]
  phosphorusTests: PTest[]
}) {
  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Soil Tests
      </h3>

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
      <AddNitrogenTestForm stationId={stationId} zones={zones} />

      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', margin: '20px 0 8px' }}>Phosphorus</h4>
      {phosphorusTests.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px' }}>No phosphorus tests yet.</p>}
      {phosphorusTests.map(t => (
        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
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
      ))}
      <AddPhosphorusTestForm stationId={stationId} zones={zones} />
    </div>
  )
}
