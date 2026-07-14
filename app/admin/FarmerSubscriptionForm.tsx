'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { updateFarmerSubscription } from './actions'

type Farmer = {
  id: string
  name: string | null
  email: string | null
  tier: string | null
  subscription_expires_at?: Date | null
  subscription_notes?: string | null
}

export default function FarmerSubscriptionForm({ farmers }: { farmers: Farmer[] }) {
  const [selectedId, setSelectedId] = useState('')
  const [state, formAction, pending] = useActionState(updateFarmerSubscription, null)

  const selected = farmers.find(f => f.id === selectedId)

  return (
    <div>
      <select
        className="input"
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <option value="">Select farmer…</option>
        {farmers.map(f => (
          <option key={f.id} value={f.id}>
            {f.name ?? f.email} — {f.tier ?? 'base'}
            {(f as any).subscription_expires_at
              ? ` (expires ${new Date((f as any).subscription_expires_at).toLocaleDateString('en-AU')})`
              : ' (no expiry)'}
          </option>
        ))}
      </select>

      {selected && (
        <form action={formAction}>
          <input type="hidden" name="farmer_id" value={selected.id} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Tier</label>
              <select className="input" name="tier" defaultValue={selected.tier ?? 'base'}>
                <option value="base">Base — $10/node/month</option>
                <option value="mid">Mid — $20/node/month</option>
                <option value="pro">Pro — $50/node/month</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Expires</label>
              <input
                className="input"
                name="expires_at"
                type="date"
                defaultValue={(selected as any).subscription_expires_at
                  ? new Date((selected as any).subscription_expires_at).toLocaleDateString('en-CA')
                  : ''}
              />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Notes (payment reference, invoice number etc)</label>
            <input
              className="input"
              name="notes"
              placeholder="e.g. Paid via bank transfer, ref #1234"
              defaultValue={(selected as any).subscription_notes ?? ''}
            />
          </div>
          {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{state.error}</p>}
          {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 8 }}>{state.success}</p>}
          <button className="btn-primary" type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Update subscription'}
          </button>
        </form>
      )}
    </div>
  )
}
