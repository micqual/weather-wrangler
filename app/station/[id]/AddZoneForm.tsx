'use client'

import { useActionState } from 'react'
import { createZone } from '@/lib/zoneActions'

type CropType = { id: number; crop_name: string | null; variety: string | null }

export default function AddZoneForm({ stationId, cropTypes }: { stationId: string; cropTypes: CropType[] }) {
  const [state, formAction, pending] = useActionState(createZone, null)

  return (
    <form action={formAction} style={{ marginTop: 10 }}>
      <input type="hidden" name="station_id" value={stationId} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
        <input className="input" name="name" placeholder="Zone name (e.g. Zone 1)" />
        <select className="input" name="crop_type_id">
          <option value="">No crop type</option>
          {cropTypes.map(c => (
            <option key={c.id} value={c.id}>{c.crop_name} — {c.variety}</option>
          ))}
        </select>
        <input className="input" name="planted_date" type="date" />
        <input className="input" name="soil_type" placeholder="Soil type" />
        <input className="input" name="hectares" type="number" step="0.1" placeholder="Size (ha)" />
        <input className="input" name="target_yield_t_ha" type="number" step="0.01" placeholder="Target yield (t/ha)" />
        <input className="input" name="actual_yield_t_ha" type="number" step="0.01" placeholder="Actual yield (t/ha)" />
        <input className="input" name="growth_stage" placeholder="Growth stage (e.g. Tillering, Flowering)" />
      </div>
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending} style={{ width: 'auto', padding: '8px 20px' }}>
        {pending ? 'Adding…' : 'Add zone'}
      </button>
    </form>
  )
}
