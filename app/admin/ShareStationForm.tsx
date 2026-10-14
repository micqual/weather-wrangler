'use client'

import { useActionState } from 'react'
import { shareStation } from './actions'

type Paddock = { id: string; paddock_name: string; farm_name: string }
type Station = { id: string; paddock_name: string | null }

export default function ShareStationForm({ paddocks, stations }: { paddocks: Paddock[]; stations: Station[] }) {
  const [state, formAction, pending] = useActionState(shareStation, null)

  return (
    <form action={formAction}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        Let a paddock use weather data from a nearby physical station.
      </p>
      <select className="input" name="paddock_id" required style={{ marginBottom: 10 }}>
        <option value="">Select paddock to share into…</option>
        {paddocks.map(p => (
          <option key={p.id} value={p.id}>{p.paddock_name} — {p.farm_name}</option>
        ))}
      </select>
      <select className="input" name="source_station_id" required style={{ marginBottom: 10 }}>
        <option value="">Select source station…</option>
        {stations.map(s => (
          <option key={s.id} value={s.id}>{s.id}{s.paddock_name ? ` — ${s.paddock_name}` : ''}</option>
        ))}
      </select>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Sharing…' : 'Share station data'}</button>
    </form>
  )
}
