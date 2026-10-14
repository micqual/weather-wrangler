'use client'

import { useActionState } from 'react'
import { createPaddockOnly } from './actions'

type Farm = { id: string; name: string; farmers: { name: string | null } }

export default function CreatePaddockForm({ farms }: { farms: Farm[] }) {
  const [state, formAction, pending] = useActionState(createPaddockOnly, null)

  return (
    <form action={formAction}>
      <select className="input" name="farm_id" required style={{ marginBottom: 10 }}>
        <option value="">Select farm…</option>
        {farms.map(f => (
          <option key={f.id} value={f.id}>{f.name} — {f.farmers.name}</option>
        ))}
      </select>
      <input className="input" name="paddock_name" placeholder="Paddock name (e.g. North Block)" required style={{ marginBottom: 10 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input className="input" name="latitude" type="number" step="0.000001" placeholder="Latitude (e.g. -35.336)" />
        <input className="input" name="longitude" type="number" step="0.000001" placeholder="Longitude (e.g. 143.550)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
        <input className="input" name="hectares" type="number" step="0.1" placeholder="Size (ha)" />
        <input className="input" name="soil_type" placeholder="Soil type" />
        <input className="input" name="elevation_m" type="number" placeholder="Elevation (m)" />
      </div>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create paddock'}</button>
    </form>
  )
}
