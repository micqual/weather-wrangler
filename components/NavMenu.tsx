'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NavMenu({ canPro, isAdmin }: { canPro: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const items = [
    { label: 'Forecast', href: '/forecast', color: 'var(--purple)' },
    { label: canPro ? 'Nitrogen' : 'Nitrogen 🔒', href: canPro ? '/nitrogen' : null, color: 'var(--purple)' },
    { label: canPro ? 'Agronomy' : 'Agronomy 🔒', href: canPro ? '/agronomy' : null, color: 'var(--orange)' },
    { label: 'Report', href: '/report', color: 'var(--text-muted)' },
    { label: 'Guide', href: '/guide', color: 'var(--text-muted)' },
    { label: 'Methodology', href: '/methodology', color: 'var(--text-muted)' },
    { label: 'Sign out', href: '/api/auth/signout', color: 'var(--text-muted)' },
    ...(isAdmin ? [{ label: 'Admin', href: '/admin', color: 'var(--orange)' }] : []),
  ]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          border: '1px solid var(--border)', background: 'var(--surface)',
          color: 'var(--text)', borderRadius: 8, padding: '8px 16px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        Menu {open ? '▲' : '▼'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: 6,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '6px 0', minWidth: 180,
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 100,
        }}>
          {items.map((item, i) => (
            item.href ? (
              
                key={i}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{
                  display: 'block', padding: '10px 16px', fontSize: 14,
                  color: item.color, textDecoration: 'none', fontWeight: 500,
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {item.label}
              </a>
            ) : (
              <div
                key={i}
                style={{
                  display: 'block', padding: '10px 16px', fontSize: 14,
                  color: 'var(--text-muted)', fontWeight: 500, cursor: 'not-allowed',
                  borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                title="Requires Pro plan — contact info@weatherwrangler.net"
              >
                {item.label}
              </div>
            )
          ))}
        </div>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        />
      )}
    </div>
  )
}
