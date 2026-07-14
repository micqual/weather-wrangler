export default function SubscriptionBanner({
  daysUntilExpiry,
  daysOverdue,
  isGrace,
  tier,
}: {
  daysUntilExpiry: number | null
  daysOverdue: number | null
  isGrace: boolean
  tier: string
}) {
  if (!daysUntilExpiry && !isGrace) return null

  if (isGrace) {
    return (
      <div style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid #ef4444',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 16,
        fontSize: 13,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: '#ef4444' }}>
          ⚠️ Subscription expired {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} ago — {14 - (daysOverdue ?? 0)} days remaining in grace period
        </span>
        <a href="mailto:info@weatherwrangler.net" style={{ color: '#ef4444', fontSize: 12, textDecoration: 'none', border: '1px solid #ef4444', borderRadius: 6, padding: '4px 10px', whiteSpace: 'nowrap' }}>
          Renew now
        </a>
      </div>
    )
  }

  if (daysUntilExpiry != null && daysUntilExpiry <= 14) {
    return (
      <div style={{
        background: 'rgba(250,204,21,0.08)',
        border: '1px solid rgba(250,204,21,0.4)',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 16,
        fontSize: 13,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: '#facc15' }}>
          ⚠️ Subscription expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}
        </span>
        <a href="mailto:info@weatherwrangler.net" style={{ color: '#facc15', fontSize: 12, textDecoration: 'none', border: '1px solid rgba(250,204,21,0.4)', borderRadius: 6, padding: '4px 10px', whiteSpace: 'nowrap' }}>
          Renew now
        </a>
      </div>
    )
  }

  return null
}
