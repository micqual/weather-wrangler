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
  currentTargetYield,
  currentActualYield,
  currentStoredSoilWater,
  currentOrganicCarbon,
  ws90Serial,
  latitude,
  longitude,
}: {
  stationId: string
  cropTypes: CropType[]
  currentCropTypeId: number | null
  currentPlantedDate: string | null
  currentHectares: number | null
  currentSoilType: string | null
  currentTargetYield: number | null
  currentActualYield: number | null
  currentStoredSoilWater: number | null
  currentOrganicCarbon: number | null
  ws90Serial: string | null
  latitude: number | null
  longitude: number | null
}) {
  const [state, formAction, pending] = useActionState(updatePaddockDetails, null)

  return (
    <form action={formAction}>
      <input type="hidden" name="station_id" value={stationId} />

      {(ws90Serial || latitude) && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {ws90Serial && <span>S/N: <span style={{ color: 'var(--text)' }}>{ws90Serial}</span></span>}
          {ws90Serial && latitude && <span> · </span>}
          {latitude && longitude && <span>GPS: <span style={{ color: 'var(--text)' }}>{latitude.toFixed(5)}, {longitude.toFixed(5)}</span></span>}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
        <select className="input" name="crop_type_id" defaultValue={currentCropTypeId ?? ''}>
          <option value="">No crop type</option>
          {cropTypes.map(c => (
            <option key={c.id} value={c.id}>{c.crop_name} — {c.variety}</option>
          ))}
        </select>
        <input className="input" name="planted_date" type="date" defaultValue={currentPlantedDate ?? ''} />
        <input className="input" name="soil_type" placeholder="Soil type" defaultValue={currentSoilType ?? ''} />
        <input className="input" name="hectares" type="number" step="0.1" placeholder="Size (ha)" defaultValue={currentHectares ?? ''} />
        <input className="input" name="target_yield_t_ha" type="number" step="0.01" placeholder="Target yield (t/ha)" defaultValue={currentTargetYield ?? ''} />
        <input className="input" name="actual_yield_t_ha" type="number" step="0.01" placeholder="Actual yield (t/ha)" defaultValue={currentActualYield ?? ''} />
        <input className="input" name="stored_soil_water_mm" type="number" step="1" placeholder="Stored soil water (mm)" defaultValue={currentStoredSoilWater ?? ''} />
        <input className="input" name="organic_carbon_pct" type="number" step="0.01" placeholder="Organic carbon (%)" defaultValue={currentOrganicCarbon ?? ''} />
      </div>

      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10 }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending} style={{ width: 'auto', padding: '8px 20px' }}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}
