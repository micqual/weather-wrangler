'use client'

import { useState } from 'react'

export default function CollapsibleCard({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="card">
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          color: 'var(--text)',
          textAlign: 'left',
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          {hint && !open && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 16, transition: 'transform 0.2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0, marginLeft: 12 }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
