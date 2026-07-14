'use client'

import { useState } from 'react'

export default function AdminTabs({ children }: { children: React.ReactNode[] }) {
  const [active, setActive] = useState(0)
  const tabs = ['Setup', 'Farmers', 'Prices']

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActive(i)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: active === i ? '2px solid var(--orange)' : '2px solid transparent',
              color: active === i ? 'var(--orange)' : 'var(--text-muted)',
              fontSize: 14,
              fontWeight: active === i ? 600 : 400,
              padding: '8px 16px',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab}
          </button>
        ))}
      </div>
      {children[active]}
    </div>
  )
}
