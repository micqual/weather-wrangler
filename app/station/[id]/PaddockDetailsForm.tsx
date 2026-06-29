'use client'

import { useActionState } from 'react'
import { updatePaddockDetails } from '@/lib/paddockActions'

type CropType = { id: number; crop_name: string | null; variety: string | null }

export default function PaddockDetailsForm({
  stationId,
  cropTypes,
  currentCropTypeId,
  currentPlantedDate,
  currentHectares,
  currentSoilType,
}: {
  stationId: string
  cropTypes: CropType[]
  currentCropTypeId: number | null
  currentPlantedDate: string | null
  currentHectares: number | null
  currentSoilType: string | null
}) {
  const [state, formAction, pending] = useActionState(updatePaddockDetails, null)

  return (
    <form action={formAction} className="card" style={{ padding: 20, marginBottom: 24 }}>
      <input type="hidden" name="station_id" value={stationId} />
      <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Paddock details
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
        <select className="input" name="crop_type_id" defaultValue={currentCropTypeId ?? ''}>
          <option value="">No crop type</option>
          {cropTypes.map(c => (
            <option key={c.id} value={c.id}>{c.crop_name} — {c.variety}</option>
          ))}
        </select>
        <input className="input" name="planted_date" type="date" defaultValue={currentPlantedDate ?? ''} />
        <input className="input" name="soil_type" placeholder="Soil type (e.g. loam)" defaultValue={currentSoilType ?? ''} />
        <input className="input" name="hectares" type="number" step="0.1" placeholder="Size (ha)" defaultValue={currentHectares ?? ''} />
      </div>

      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending} style={{ width: 'auto', padding: '8px 20px' }}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
