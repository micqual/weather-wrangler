'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { updateStation } from './actions'

type Station = {
  id: string
  paddock_name: string | null
  latitude: number | null
  longitude: number | null
  elevation_m: number | null
  ws90_serial?: string | null
}

export default function EditStationForm({ stations }: { stations: Station[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [state, formAction, pending] = useActionState(updateStation, null)

  const selected = stations.find(s => s.id === selectedId)

  return (
    <div>
      <select
        className="input"
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <option value="">Select station to edit…</option>
        {stations.map(s => (
          <option key={s.id} value={s.id}>{s.paddock_name ?? s.id}</option>
        ))}
      </select>

      {selected && (
        <form action={formAction}>
          <input type="hidden" name="id" value={selected.id} />
          <input className="input" name="paddock_name" placeholder="Paddock name" defaultValue={selected.paddock_name ?? ''} style={{ marginBottom: 10 }} />
          <input className="input" name="ws90_serial" placeholder="WS90 serial number" defaultValue={(selected as any).ws90_serial ?? ''} style={{ marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input className="input" name="latitude" type="number" step="0.000001" placeholder="Latitude" defaultValue={selected.latitude ?? ''} />
            <input className="input" name="longitude" type="number" step="0.000001" placeholder="Longitude" defaultValue={selected.longitude ?? ''} />
            <input className="input" name="elevation_m" type="number" step="1" placeholder="Elevation (m)" defaultValue={selected.elevation_m ?? ''} />
          </div>
          {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
          {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
    </div>
  )
}
