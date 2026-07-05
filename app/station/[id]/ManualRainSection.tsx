'use client'

import { useActionState } from 'react'
import { createManualRain, deleteManualRain } from '@/lib/waterActions'

type Entry = {
  id: string
  rain_date: Date
  amount_mm: any
  notes: string | null
}

export default function ManualRainSection({
  stationId,
  entries,
}: {
  stationId: string
  entries: Entry[]
}) {
  const [state, formAction, pending] = useActionState(createManualRain, null)
  const total = entries.reduce((sum, e) => sum + parseFloat(String(e.amount_mm)), 0)

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontStyle: 'italic' }}>
        Use this to record rainfall that occurred before the station was installed, or during any data gaps.
        These entries are used in GDD and N budget calculations.
      </p>

      {entries.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>No manual rain entries yet.</p>}

      {entries.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600, marginBottom: 8 }}>
            Total recorded: {total.toFixed(0)} mm
          </div>
          {entries.map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {new Date(e.rain_date).toLocaleDateString('en-AU')}
                {' · '}<span style={{ color: 'var(--text)', fontWeight: 500 }}>{parseFloat(String(e.amount_mm)).toFixed(1)} mm</span>
                {e.notes ? ` · ${e.notes}` : ''}
              </span>
              <form action={deleteManualRain}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="station_id" value={stationId} />
                <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form action={formAction}>
        <input type="hidden" name="station_id" value={stationId} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <input className="input" name="rain_date" type="date" required />
          <input className="input" name="amount_mm" type="number" step="0.1" placeholder="Rainfall (mm)" required />
        </div>
        <input className="input" name="notes" placeholder="Notes e.g. BOM gauge, neighbour's station" style={{ marginBottom: 10 }} />
        {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{state.error}</p>}
        {state?.success && <p style={{ color: '#60a5fa', fontSize: 13, marginBottom: 8 }}>{state.success}</p>}
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add rain entry'}
        </button>
      </form>
    </div>
  )
}
