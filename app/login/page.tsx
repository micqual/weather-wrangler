'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await signIn('credentials', { email, password, redirect: false })
    if (res?.error) {
      setError('Invalid email or password')
      return
    }
    router.push('/')
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: 40, maxWidth: 320 }}>
      <h1>Weather Wrangler</h1>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 10, padding: 8 }} />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" style={{ padding: 8, width: '100%' }}>Sign in</button>
    </form>
  )
}
