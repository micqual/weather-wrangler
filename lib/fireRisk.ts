// Fire risk indicator for harvest period
// Shows when crop is near maturity AND weather conditions are dangerous
// Based on: temp ≥35°C + humidity ≤20% + wind ≥25 km/h

export type FireRiskLevel = 'high' | 'elevated' | 'low' | null

export type FireRiskResult = {
  level: FireRiskLevel
  label: string
  color: string
  detail: string
  show: boolean // only show when crop is near harvest
}

export function assessFireRisk(
  tempC: number | null,
  humidityPct: number | null,
  windKmh: number | null,
  gddProgress: number | null // 0-1, fraction of target GDD reached
): FireRiskResult {
  // Only show when crop is within 90% of target GDD
  if (gddProgress == null || gddProgress < 0.9) {
    return { level: null, label: '', color: '', detail: '', show: false }
  }

  const hotEnough = tempC != null && tempC >= 35
  const dryEnough = humidityPct != null && humidityPct <= 20
  const windyEnough = windKmh != null && windKmh >= 25

  const conditionsMet = [hotEnough, dryEnough, windyEnough].filter(Boolean).length

  const details: string[] = []
  if (hotEnough) details.push(`${tempC?.toFixed(1)}°C`)
  if (dryEnough) details.push(`${humidityPct}% humidity`)
  if (windyEnough) details.push(`${windKmh?.toFixed(0)} km/h wind`)

  if (conditionsMet === 3) {
    return {
      level: 'high',
      label: 'High fire risk',
      color: '#ef4444',
      detail: details.join(' · '),
      show: true,
    }
  }

  if (conditionsMet === 2) {
    return {
      level: 'elevated',
      label: 'Elevated fire risk',
      color: '#f97316',
      detail: details.join(' · ') + ' — monitor conditions',
      show: true,
    }
  }

  return {
    level: 'low',
    label: 'Low fire risk',
    color: '#4ade80',
    detail: 'Harvest conditions safe',
    show: true,
  }
}
