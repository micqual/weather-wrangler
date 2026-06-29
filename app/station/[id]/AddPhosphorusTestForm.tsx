'use client'

import { useActionState } from 'react'
import { createPhosphorusTest } from '@/lib/soilTestActions'

type Zone = { id: string; name: string }

export default function AddPhosphorusTestForm({ stationId, zones }: { stationId: string; zones: Zone[] }) {
  const [state, formAction, pending] = useActionState(createPhosphorusTest, null)

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
        <input className="input" name="tested_at" type="date" />
        <input className="input" name="p_colwell_mg_kg" type="number" step="0.1" placeholder="Phosphorus, Colwell (mg/kg)" />
        <input className="input" name="pbi" type="number" step="0.1" placeholder="Phosphorus Buffer Index" />
        <input className="input" name="ph_cacl2" type="number" step="0.1" placeholder="pH (1:5 CaCl2)" />
      </div>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending} style={{ width: 'auto', padding: '8px 20px' }}>
        {pending ? 'Adding…' : 'Add phosphorus test'}
      </button>
    </form>
  )
}
