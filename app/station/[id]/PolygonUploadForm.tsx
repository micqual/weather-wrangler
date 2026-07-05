'use client'

import { useActionState } from 'react'
import { uploadPolygons } from '@/lib/polygonActions'

type Zone = { id: string; name: string }

export default function PolygonUploadForm({ stationId, zones }: { stationId: string; zones: Zone[] }) {
  const [state, formAction, pending] = useActionState(uploadPolygons, null)

  return (
    <form action={formAction} style={{ marginTop: 12 }}>
      <input type="hidden" name="station_id" value={stationId} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end', marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Applies to</label>
          <select className="input" name="zone_id">
            <option value="">Whole paddock</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>File (KML or GeoJSON)</label>
          <input className="input" name="file" type="file" accept=".kml,.geojson,.json" required />
        </div>
        <button className="btn-primary" type="submit" disabled={pending} style={{ whiteSpace: 'nowrap' }}>
          {pending ? 'Importing…' : 'Import'}
        </button>
      </div>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13 }}>{state.success}</p>}
    </form>
  )
}
