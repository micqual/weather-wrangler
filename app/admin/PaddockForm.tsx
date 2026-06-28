'use client'

import { useActionState } from 'react'
import { createPaddock } from './actions'

type Station = { id: string; farm_id: string | null }
type Farm = { id: string; name: string; farmers: { name: string | null } }

export default function PaddockForm({ stations, farms }: { stations: Station[]; farms: Farm[] }) {
  const [state, formAction, pending] = useActionState(createPaddock, null)

  return (
    <form action={formAction}>
      <select className="input" name="station_id" required style={{ marginBottom: 10 }}>
        <option value="">Select station…</option>
        {stations.map(s => (
          <option key={s.id} value={s.id}>{s.id}{s.farm_id ? ' — already assigned' : ''}</option>
        ))}
      </select>
      <select className="input" name="farm_id" required style={{ marginBottom: 10 }}>
        <option value="">Select farm…</option>
        {farms.map(f => (
          <option key={f.id} value={f.id}>{f.name} — {f.farmers.name}</option>
        ))}
      </select>
      <input className="input" name="paddock_name" placeholder="Paddock name (e.g. North Block)" style={{ marginBottom: 10 }} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        <input type="checkbox" name="confirm_reassign" />
        Confirm reassignment (only needed if the station is already assigned elsewhere)
      </label>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add paddock'}</button>
    </form>
  )
}
