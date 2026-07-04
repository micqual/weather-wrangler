'use client'

import { useActionState } from 'react'
import { updateSettings, updateCropPrice } from './actions'

type CropType = { id: number; crop_name: string | null; variety: string | null; grain_price_per_tonne: any }

export default function SettingsForm({
  nCost,
  cropTypes,
}: {
  nCost: number
  cropTypes: CropType[]
}) {
  const [settingsState, settingsAction, settingsPending] = useActionState(updateSettings, null)
  const [cropState, cropAction, cropPending] = useActionState(updateCropPrice, null)

  return (
    <div>
      {/* N cost */}
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
        Fertiliser cost
      </h4>
      <form action={settingsAction} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            className="input"
            name="n_cost_per_kg_n"
            type="number"
            step="0.01"
            placeholder="$ per kg N"
            defaultValue={nCost}
            style={{ maxWidth: 160 }}
          />
          <button className="btn-primary" type="submit" disabled={settingsPending} style={{ whiteSpace: 'nowrap' }}>
            {settingsPending ? 'Saving…' : 'Update N cost'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          e.g. Urea at $600/t ÷ 46% N = $1.30/kg N
        </div>
        {settingsState?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 6 }}>{settingsState.error}</p>}
        {settingsState?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginTop: 6 }}>{settingsState.success}</p>}
      </form>

      {/* Grain prices per crop */}
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 8px' }}>
        Grain prices
      </h4>
      <form action={cropAction}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <select className="input" name="id" required>
            <option value="">Select crop…</option>
            {cropTypes.map(c => (
              <option key={c.id} value={c.id}>
                {c.crop_name} — {c.variety} (currently ${c.grain_price_per_tonne ? parseFloat(String(c.grain_price_per_tonne)).toFixed(0) : '280'}/t)
              </option>
            ))}
          </select>
          <input
            className="input"
            name="grain_price_per_tonne"
            type="number"
            step="1"
            placeholder="$ per tonne"
          />
          <button className="btn-primary" type="submit" disabled={cropPending} style={{ whiteSpace: 'nowrap' }}>
            {cropPending ? 'Saving…' : 'Update price'}
          </button>
        </div>
        {cropState?.error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{cropState.error}</p>}
        {cropState?.success && <p style={{ color: 'var(--orange)', fontSize: 13 }}>{cropState.success}</p>}
      </form>
    </div>
  )
}
