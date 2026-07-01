'use client'

import { useActionState } from 'react'
import { createNitrogenApplication } from '@/lib/nitrogenActions'

type Zone = { id: string; name: string }
type Product = { id: number; name: string; n_percent: number }

export default function AddNitrogenApplicationForm({
  stationId,
  zones,
  products,
}: {
  stationId: string
  zones: Zone[]
  products: Product[]
}) {
  const [state, formAction, pending] = useActionState(createNitrogenApplication, null)

  return (
    <form action={formAction} style={{ marginTop: 10 }}>
      <input type="hidden" name="station_id" value={stationId} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
        <select className="input" name="zone_id">
          <option value="">Whole paddock</option>
          {zones.map(z => (
            <option key={z.id} value={z.id}>{z.name}</option>
          ))}
        </select>
        <select className="input" name="product_id" required>
          <option value="">Select product…</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.n_percent}% N)</option>
          ))}
        </select>
        <input className="input" name="rate_kg_ha" type="number" step="0.1" placeholder="Rate (kg product/ha)" required />
        <input className="input" name="applied_at" type="date" />
        <select className="input" name="method">
          <option value="broadcast">Broadcast</option>
          <option value="banded">Banded</option>
          <option value="foliar">Foliar</option>
          <option value="fertigation">Fertigation</option>
          <option value="seed">Seed placed</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}>
          <input type="checkbox" name="incorporated" />
          Incorporated
        </label>
      </div>
      <input className="input" name="notes" placeholder="Notes (optional)" style={{ marginBottom: 10 }} />
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? 'Recording…' : 'Record application'}
      </button>
    </form>
  )
}
