import { deleteZone } from '@/lib/zoneActions'
import AddZoneForm from './AddZoneForm'

type Zone = {
  id: string
  name: string
  crop_type_id: number | null
  planted_date: Date | null
  soil_type: string | null
  hectares: any
}
type CropType = { id: number; crop_name: string | null; variety: string | null }

export default function ZonesSection({ stationId, zones, cropTypes }: { stationId: string; zones: Zone[]; cropTypes: CropType[] }) {
  const cropById = new Map(cropTypes.map(c => [c.id, c]))

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Zones
      </h3>

      {zones.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>No zones yet.</p>}

      {zones.map(z => {
        const crop = z.crop_type_id ? cropById.get(z.crop_type_id) : null
        return (
          <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
            <div style={{ fontSize: 13 }}>
              <strong>{z.name}</strong>
              <span style={{ color: 'var(--text-muted)' }}>
                {crop ? ` · ${crop.crop_name} (${crop.variety})` : ''}
                {z.soil_type ? ` · ${z.soil_type}` : ''}
                {z.hectares ? ` · ${z.hectares} ha` : ''}
                {z.planted_date ? ` · planted ${new Date(z.planted_date).toLocaleDateString('en-AU')}` : ''}
              </span>
            </div>
            <form action={deleteZone}>
              <input type="hidden" name="zone_id" value={z.id} />
              <input type="hidden" name="station_id" value={stationId} />
              <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
            </form>
          </div>
        )
      })}

      <div style={{ borderTop: zones.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: zones.length > 0 ? 14 : 0, marginTop: zones.length > 0 ? 14 : 0 }}>
        <AddZoneForm stationId={stationId} cropTypes={cropTypes} />
      </div>
    </div>
  )
}
