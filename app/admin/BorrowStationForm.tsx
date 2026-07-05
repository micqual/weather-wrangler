'use client'

import { useActionState } from 'react'
import { assignBorrowedStation } from './actions'

type Station = { id: string; paddock_name: string | null; latitude: number | null; longitude: number | null; borrowed_station_id?: string | null }

export default function BorrowStationForm({ stations }: { stations: Station[] }) {
  const [state, formAction, pending] = useActionState(assignBorrowedStation, null)
  return (
    <form action={formAction}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Paddock without its own station</label>
      <select className="input" name="station_id" required style={{ marginBottom: 10 }}>
        <option value="">Select paddock…</option>
        {stations.map(s => (
          <option key={s.id} value={s.id}>
            {s.paddock_name ?? s.id}
            {(s as any).borrowed_station_id ? ` (borrows from ${(s as any).borrowed_station_id})` : ''}
          </option>
        ))}
      </select>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Borrow weather from (within 5 km)</label>
      <select className="input" name="borrowed_station_id" style={{ marginBottom: 10 }}>
        <option value="">None — remove borrowing</option>
        {stations.map(s => (
          <option key={s.id} value={s.id}>{s.paddock_name ?? s.id}</option>
        ))}
      </select>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Assign'}
      </button>
    </form>
  )
}
