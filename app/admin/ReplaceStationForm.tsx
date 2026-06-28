'use client'

import { useActionState } from 'react'
import { replaceStation } from './actions'

type Station = { id: string; paddock_name: string | null }

export default function ReplaceStationForm({ assigned, unassigned }: { assigned: Station[]; unassigned: Station[] }) {
  const [state, formAction, pending] = useActionState(replaceStation, null)

  return (
    <form action={formAction}>
      <select className="input" name="old_station_id" required style={{ marginBottom: 10 }}>
        <option value="">Broken / stolen station…</option>
        {assigned.map(s => (
          <option key={s.id} value={s.id}>{s.id} ({s.paddock_name ?? 'no name'})</option>
        ))}
      </select>
      <select className="input" name="new_station_id" required style={{ marginBottom: 10 }}>
        <option value="">Replacement station…</option>
        {unassigned.map(s => (
          <option key={s.id} value={s.id}>{s.id}</option>
        ))}
      </select>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Replacing…' : 'Replace station'}</button>
    </form>
  )
}
