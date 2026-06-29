'use client'

import { useActionState } from 'react'
import { resetPassword } from './actions'

type Farmer = { id: string; name: string | null; email: string | null }

export default function ResetPasswordForm({ farmers }: { farmers: Farmer[] }) {
  const [state, formAction, pending] = useActionState(resetPassword, null)

  return (
    <form action={formAction}>
      <select className="input" name="farmer_id" required style={{ marginBottom: 10 }}>
        <option value="">Select farmer…</option>
        {farmers.map(f => (
          <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
        ))}
      </select>
      <input className="input" name="new_password" placeholder="New password" required style={{ marginBottom: 10 }} />
      {state?.error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{state.error}</p>}
      {state?.success && <p style={{ color: 'var(--orange)', fontSize: 13, marginBottom: 10, wordBreak: 'break-word' }}>{state.success}</p>}
      <button className="btn-primary" type="submit" disabled={pending}>{pending ? 'Resetting…' : 'Reset password'}</button>
    </form>
  )
}
