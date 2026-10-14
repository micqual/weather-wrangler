'use client'

import { useActionState } from 'react'
import { linkStationToPaddock } from './actions'

type Paddock = { id: string; paddock_name: string; farm_name: string }
type Station = { id: string; paddock_name: string | null; farm_id: string | null }

export default function LinkStationForm({ paddocks, stations }: { paddocks: Paddock[]; stations: Station[] }) {
  const [state, formAction, pending] = useActionState(linkStationToPaddock, null)

  return (
    <form action={formAction}>
      <select className="input" name="paddock_id" required style={{ marginBottom: 10 }}>
        <option value="">Select paddock…</option>
        {paddocks.map(p => (
          <option key={p.id} value={p.id}>{p.paddock_name} — {p.farm_name}</option>
        ))}
      </select>
      <select className="input" name="station_id" required style={{ marginBottom: 10 }}>
        <option value="">Select station…</option>
        {stations.map(s => (
          <option key={s.id} value={s.id}>{s.id}{s.paddock_name ? ` (${s.paddock_name})` : ''}{s.farm_id ? ' — assigned' : ' — unassigned'}</option>
        ))}
      </select>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Linking…' : 'Link station to paddock'}</button>
    </form>
  )
}
