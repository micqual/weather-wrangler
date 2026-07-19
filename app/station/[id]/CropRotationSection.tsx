'use client'

import { useActionState } from 'react'
import { addCropRotation, deleteCropRotation } from '@/lib/cropRotationActions'

type RotationEntry = {
  id: string
  crop_name: string
  variety: string | null
  planted_date: Date | null
  harvest_date: Date | null
  yield_t_ha: number | null
  notes: string | null
}

export default function CropRotationSection({
  stationId,
  entries,
}: {
  stationId: string
  entries: RotationEntry[]
}) {
  const [addState, addAction, addPending] = useActionState(addCropRotation, null)
  const [deleteState, deleteAction] = useActionState(deleteCropRotation, null)

  return (
    <div>
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--purple)', margin: '0 0 12px' }}>Crop rotation history</h4>

      {entries.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>No rotation history recorded yet.</p>
      )}

      {entries.map(e => (
        <div key={e.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: 13 }}>
          <div>
            <span style={{ fontWeight: 600 }}>{e.crop_name}{e.variety ? ` (${e.variety})` : ''}</span>
            {e.planted_date && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>planted {new Date(e.planted_date).toLocaleDateString('en-AU')}</span>}
            {e.harvest_date && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>harvested {new Date(e.harvest_date).toLocaleDateString('en-AU')}</span>}
            {e.yield_t_ha != null && <span style={{ color: 'var(--orange)', marginLeft: 8 }}>{e.yield_t_ha} t/ha</span>}
            {e.notes && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{e.notes}</div>}
          </div>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="station_id" value={stationId} />
            <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
          </form>
        </div>
      ))}

      <form action={addAction} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="hidden" name="station_id" value={stationId} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <input className="input" name="crop_name" placeholder="Crop (e.g. Wheat)" required />
          <input className="input" name="variety" placeholder="Variety (e.g. Scepter)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <input className="input" name="planted_date" type="date" placeholder="Planted date" />
          <input className="input" name="harvest_date" type="date" placeholder="Harvest date" />
          <input className="input" name="yield_t_ha" type="number" step="0.01" placeholder="Yield (t/ha)" />
        </div>
        <input className="input" name="notes" placeholder="Notes (optional)" />
        {addState?.error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{addState.error}</p>}
        {addState?.success && <p style={{ color: 'var(--orange)', fontSize: 13 }}>{addState.success}</p>}
        <button className="btn-primary" type="submit" disabled={addPending} style={{ alignSelf: 'flex-start' }}>
          {addPending ? 'Adding…' : 'Add season'}
        </button>
      </form>
    </div>
  )
}
