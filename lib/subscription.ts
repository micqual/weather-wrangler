// Subscription tier system
// Base: $10/node/month — weather monitoring
// Mid:  $20/node/month — + crop, GDD, zones, disease risk
// Pro:  $50/node/month — + N budget, agronomy, soil tests, report

export type Tier = 'base' | 'mid' | 'pro'

export type SubscriptionStatus = {
  tier: Tier
  isActive: boolean
  isGrace: boolean  // expired but within 2 week grace period
  isExpired: boolean
  daysUntilExpiry: number | null
  daysOverdue: number | null
}

export const TIER_FEATURES = {
  base: {
    label: 'Base',
    price: '$10/node/month',
    features: [
      'Live weather readings',
      'Temperature, humidity, wind, rain',
      'Weather history (date range)',
      'ET, Delta T, spray window',
      'Frost risk, field trafficability',
      '7-day forecast',
      'Public QR station page',
      'Solar & battery monitoring',
    ],
  },
  mid: {
    label: 'Mid',
    price: '$20/node/month',
    features: [
      'Everything in Base',
      'Crop type & planted date',
      'GDD tracking with BOM gap-fill',
      'Estimated harvest date',
      'Disease risk indicator',
      'Heat stress alerts',
      'Zone management',
      'Paddock boundary maps',
    ],
  },
  pro: {
    label: 'Pro',
    price: '$50/node/month',
    features: [
      'Everything in Mid',
      'Nitrogen budget & applications',
      'Agronomy — Mitscherlich yield curve',
      'Yield potential (water & N limited)',
      'Soil tests — N, P, pH, S, Cl',
      'Lime calculator',
      'Irrigation log & historical rain',
      'Monthly farm report',
    ],
  },
}

export function getSubscriptionStatus(
  tier: string | null,
  expiresAt: Date | null
): SubscriptionStatus {
  const validTier: Tier = (tier === 'mid' || tier === 'pro') ? tier : 'base'
  
  if (!expiresAt) {
    // No expiry set — active indefinitely (manual management)
    return {
      tier: validTier,
      isActive: true,
      isGrace: false,
      isExpired: false,
      daysUntilExpiry: null,
      daysOverdue: null,
    }
  }

  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  const GRACE_DAYS = 14

  if (diffDays > 0) {
    return {
      tier: validTier,
      isActive: true,
      isGrace: false,
      isExpired: false,
      daysUntilExpiry: diffDays,
      daysOverdue: null,
    }
  }

  const overdueDays = Math.abs(diffDays)

  if (overdueDays <= GRACE_DAYS) {
    return {
      tier: validTier,
      isActive: true,
      isGrace: true,
      isExpired: false,
      daysUntilExpiry: null,
      daysOverdue: overdueDays,
    }
  }

  return {
    tier: validTier,
    isActive: false,
    isGrace: false,
    isExpired: true,
    daysUntilExpiry: null,
    daysOverdue: overdueDays,
  }
}

export function canAccessFeature(status: SubscriptionStatus, requiredTier: Tier): boolean {
  if (!status.isActive && !status.isGrace) return false
  const tierOrder: Tier[] = ['base', 'mid', 'pro']
  return tierOrder.indexOf(status.tier) >= tierOrder.indexOf(requiredTier)
}
