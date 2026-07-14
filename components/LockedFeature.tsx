'use client'

export default function LockedFeature({
  requiredTier,
  currentTier,
}: {
  requiredTier: 'mid' | 'pro'
  currentTier: string
}) {
  const labels = { mid: 'Mid', pro: 'Pro' }
  const prices = { mid: '$20/node/month', pro: '$50/node/month' }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      background: 'rgba(250,204,21,0.1)',
      border: '1px solid rgba(250,204,21,0.3)',
      borderRadius: 20,
      fontSize: 11,
      color: '#facc15',
      cursor: 'pointer',
    }}
      title={`Requires ${labels[requiredTier]} plan (${prices[requiredTier]}) — contact info@weatherwrangler.net or +61 422 490 254 to upgrade`}
    >
      🔒 {labels[requiredTier]}
    </div>
  )
}
