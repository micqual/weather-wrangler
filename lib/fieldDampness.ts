// Field dampness / trafficability indicator
// Based on: recent rainfall, soil type, ET drying rate, days since rain
//
// Soil drainage categories:
//   Fast: sand, loamy sand, sandy loam
//   Medium: loam, silt loam, clay loam
//   Slow: clay, heavy clay, cracking clay

export type DampnessLevel = 'dry' | 'damp' | 'wet' | 'unknown'

export type DampnessResult = {
  level: DampnessLevel
  icon: string
  label: string
  color: string
  reason: string
}

function drainageRate(soilType: string | null): 'fast' | 'medium' | 'slow' {
  if (!soilType) return 'medium'
  const s = soilType.toLowerCase()
  if (/sand|loamy sand|sandy loam/.test(s)) return 'fast'
  if (/clay/.test(s)) return 'slow'
  return 'medium'
}

export function assessFieldDampness(
  rainLast24h: number,
  rainLast72h: number,
  daysSinceLastRain: number | null,
  avgEToMmDay: number | null,
  soilType: string | null,
  avgTempC: number | null
): DampnessResult {
  const drainage = drainageRate(soilType)
  const et = avgEToMmDay ?? 1.5 // default modest drying

  // Drying coefficient per day based on soil type and ET
  const dryingRate = drainage === 'fast' ? et * 1.5
    : drainage === 'slow' ? et * 0.5
    : et

  // Estimate soil moisture index (0 = bone dry, 100 = saturated)
  // Start from recent rain, subtract estimated drying
  const days = daysSinceLastRain ?? 0
  const recentRain = Math.max(rainLast24h, rainLast72h)
  const estimatedMoisture = Math.max(0, recentRain - (dryingRate * days))

  // Thresholds vary by soil type
  const wetThreshold = drainage === 'fast' ? 20 : drainage === 'slow' ? 8 : 12
  const dampThreshold = drainage === 'fast' ? 8 : drainage === 'slow' ? 3 : 5

  if (recentRain === 0 && (daysSinceLastRain == null || daysSinceLastRain > 7)) {
    return {
      level: 'dry',
      icon: '🟢',
      label: 'Dry — safe to drive',
      color: '#4ade80',
      reason: 'No significant rain recently',
    }
  }

  if (estimatedMoisture >= wetThreshold) {
    return {
      level: 'wet',
      icon: '🔴',
      label: 'Wet — do not drive',
      color: '#ef4444',
      reason: `${recentRain.toFixed(0)}mm rain${days > 0 ? `, ${days}d ago` : ''} — ${soilType ?? 'soil'} still saturated`,
    }
  }

  if (estimatedMoisture >= dampThreshold) {
    return {
      level: 'damp',
      icon: '🟡',
      label: 'Damp — proceed with caution',
      color: 'var(--amber)',
      reason: `${recentRain.toFixed(0)}mm rain${days > 0 ? `, ${days}d ago` : ''} — drying but not trafficable`,
    }
  }

  return {
    level: 'dry',
    icon: '🟢',
    label: 'Dry — safe to drive',
    color: '#4ade80',
    reason: `Rain has dried sufficiently (ET ${et.toFixed(1)} mm/day, ${drainage} draining soil)`,
  }
}
