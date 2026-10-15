'use client'

import { useActionState, useState } from 'react'
import { updatePaddock } from './actions'

type Paddock = {
  id: string
  paddock_name: string
  farm_name: string
  latitude: number | null
  longitude: number | null
  hectares: number | null
  soil_type: string | null
  elevation_m: number | null
}

export default function EditPaddockForm({ paddocks }: { paddocks: Paddock[] }) {
  const [state, formAction, pending] = useActionState(updatePaddock, null)
  const [selected, setSelected] = useState<Paddock | null>(null)

  return (
    <div>
      <select
        className="input"
        style={{ marginBottom: 12 }}
        onChange={e => {
          const p = paddocks.find(p => p.id === e.target.value) ?? null
          setSelected(p)
        }}
        defaultValue=""
      >
        <option value="">Select paddock to edit…</option>
        {paddocks.map(p => (
          <option key={p.id} value={p.id}>{p.paddock_name} — {p.farm_name}</option>
        ))}
      </select>

      {selected && (
        <form action={formAction}>
          <input type="hidden" name="id" value={selected.id} />
          <input className="input" name="paddock_name" defaultValue={selected.paddock_name} placeholder="Paddock name" required style={{ marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input className="input" name="latitude" type="number" step="0.000001" defaultValue={selected.latitude ?? ''} placeholder="Latitude" />
            <input className="input" name="longitude" type="number" step="0.000001" defaultValue={selected.longitude ?? ''} placeholder="Longitude" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <input className="input" name="hectares" type="number" step="0.1" defaultValue={selected.hectares ?? ''} placeholder="Size (ha)" />
            <input className="input" name="soil_type" defaultValue={selected.soil_type ?? ''} placeholder="Soil type" />
            <input className="input" name="elevation_m" type="number" defaultValue={selected.elevation_m ?? ''} placeholder="Elevation (m)" />
          </div>
          {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
          {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
          <button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
        </form>
      )}
    </div>
  )
}
