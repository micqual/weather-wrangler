import { deletePolygon } from '@/lib/polygonActions'
import PolygonUploadForm from './PolygonUploadForm'
import PaddockMap from '@/components/PaddockMap'
import type { PolygonLayer } from '@/components/PaddockMap'

type Zone = { id: string; name: string }
type Polygon = {
  id: string
  name: string | null
  geojson: any
  zone_id: string | null
}

export default function PolygonSection({
  stationId,
  zones,
  polygons,
  stationLat,
  stationLng,
}: {
  stationId: string
  zones: Zone[]
  polygons: Polygon[]
  stationLat: number | null
  stationLng: number | null
}) {
  const layers: PolygonLayer[] = polygons.map(p => ({
    id: p.id,
    name: p.name ?? 'Area',
    geojson: p.geojson,
    zoneId: p.zone_id,
    zoneName: p.zone_id ? zones.find(z => z.id === p.zone_id)?.name ?? null : null,
  }))

  return (
    <div>
      {layers.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <PaddockMap polygons={layers} stationLat={stationLat} stationLng={stationLng} />
        </div>
      )}

      {polygons.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {polygons.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span>
                {p.name ?? 'Area'}
                {p.zone_id && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>· {zones.find(z => z.id === p.zone_id)?.name ?? 'zone'}</span>}
              </span>
              <form action={deletePolygon}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="station_id" value={stationId} />
                <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
              </form>
            </div>
          ))}
        </div>
      )}

      {polygons.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
          No boundaries imported yet. Upload a KML or GeoJSON file from Google Earth, FarmMap, or similar.
        </p>
      )}

      <PolygonUploadForm stationId={stationId} zones={zones} />
    </div>
  )
}
