'use client'

import { useState } from 'react'

export default function NavMenu({ canPro, isAdmin }: { canPro: boolean; isAdmin: boolean }) {
  const [open, setOpen] = useState(false)

  const items = [
    { label: 'Forecast', href: '/forecast', color: 'var(--purple)', locked: false },
    { label: 'Nitrogen', href: '/nitrogen', color: 'var(--purple)', locked: !canPro },
    { label: 'Agronomy', href: '/agronomy', color: 'var(--orange)', locked: !canPro },
    { label: 'Report', href: '/report', color: 'var(--text-muted)', locked: false },
    { label: 'Guide', href: '/guide', color: 'var(--text-muted)', locked: false },
    { label: 'Methodology', href: '/methodology', color: 'var(--text-muted)', locked: false },
    ...(isAdmin ? [{ label: 'Admin', href: '/admin', color: 'var(--orange)', locked: false }] : []),
    { label: 'Sign out', href: '/api/auth/signout', color: 'var(--text-muted)', locked: false },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        Menu {open ? '▲' : '▼'}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '6px 0', minWidth: 180, boxShadow: '0 4px 24px rgba(0,0,0,0.3)', zIndex: 100 }}>
            {items.map((item, i) => (
              item.locked ? (
                <div key={i} style={{ padding: '10px 16px', fontSize: 14, color: 'var(--text-muted)', cursor: 'not-allowed', borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }} title="Requires Pro plan">
                  {item.label} 🔒
                </div>
              ) : (
                <a key={i} href={item.href} onClick={() => setOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: 14, color: item.color, textDecoration: 'none', fontWeight: 500, borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  {item.label}
                </a>
              )
            ))}
          </div>
        </>
      )}
    </div>
  )
}
