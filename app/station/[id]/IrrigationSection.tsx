'use client'

import { useActionState } from 'react'
import { createIrrigationLog, deleteIrrigationLog } from '@/lib/waterActions'

type Zone = { id: string; name: string }
type Log = {
  id: string
  zone_id: string | null
  irrigated_at: Date
  amount_mm: any
  method: string | null
  notes: string | null
}

function levelLabel(zoneId: string | null, zones: Zone[]) {
  if (!zoneId) return 'Whole paddock'
  return zones.find(z => z.id === zoneId)?.name ?? 'Unknown zone'
}

export default function IrrigationSection({
  stationId,
  zones,
  logs,
}: {
  stationId: string
  zones: Zone[]
  logs: Log[]
}) {
  const [state, formAction, pending] = useActionState(createIrrigationLog, null)
  const total = logs.reduce((sum, l) => sum + parseFloat(String(l.amount_mm)), 0)

  return (
    <div>
      {logs.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>No irrigation recorded yet.</p>}

      {logs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--orange)', fontWeight: 600, marginBottom: 8 }}>
            Total: {total.toFixed(0)} mm across {logs.length} event{logs.length !== 1 ? 's' : ''}
          </div>
          {logs.map(l => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>
                {new Date(l.irrigated_at).toLocaleDateString('en-AU')}
                {' · '}<span style={{ color: 'var(--text)', fontWeight: 500 }}>{parseFloat(String(l.amount_mm)).toFixed(0)} mm</span>
                {' · '}{levelLabel(l.zone_id, zones)}
                {l.method ? ` · ${l.method}` : ''}
                {l.notes ? ` · ${l.notes}` : ''}
              </span>
              <form action={deleteIrrigationLog}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="station_id" value={stationId} />
                <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <form action={formAction} style={{ marginTop: 8 }}>
        <input type="hidden" name="station_id" value={stationId} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 10 }}>
          <select className="input" name="zone_id">
            <option value="">Whole paddock</option>
            {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <input className="input" name="irrigated_at" type="date" />
          <input className="input" name="amount_mm" type="number" step="0.1" placeholder="Amount (mm)" required />
          <select className="input" name="method">
            <option value="flood">Flood</option>
            <option value="spray">Spray</option>
            <option value="drip">Drip</option>
            <option value="centre pivot">Centre pivot</option>
            <option value="furrow">Furrow</option>
          </select>
        </div>
        <input className="input" name="notes" placeholder="Notes (optional)" style={{ marginBottom: 10 }} />
        {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{state.error}</p>}
        {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 8 }}>{state.success}</p>}
        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? 'Recording…' : 'Record irrigation'}
        </button>
      </form>
    </div>
  )
}
