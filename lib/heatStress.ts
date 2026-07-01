export type HeatLevel = 'none' | 'watch' | 'stress' | 'severe'

export type HeatResult = {
  level: HeatLevel
  label: string
  color: string
  reason: string
}

export function getHeatStress(
  tempC: number | null,
  growthStage: string | null
): HeatResult {
  if (tempC == null) {
    return { level: 'none', label: 'No data', color: 'var(--text-muted)', reason: '' }
  }

  const criticalStage = growthStage
    ? /flower|anthes|head|boot|grain|fill|dough|milk/i.test(growthStage)
    : false

  if (tempC >= 35) {
    return {
      level: 'severe',
      label: '🔥 Severe heat stress',
      color: '#ef4444',
      reason: `${tempC.toFixed(1)}°C — severe stress${criticalStage ? ', critical growth stage' : ''}`,
    }
  }

  if (tempC >= 31) {
    return {
      level: 'stress',
      label: '♨️ Heat stress',
      color: '#f97316',
      reason: `${tempC.toFixed(1)}°C — sterility risk in cereals${criticalStage ? ' · critical growth stage' : ''}`,
    }
  }

  if (tempC >= 28) {
    return {
      level: 'watch',
      label: '🌤️ Heat watch',
      color: 'var(--amber)',
      reason: `${tempC.toFixed(1)}°C — elevated${criticalStage ? ' · monitor closely at this growth stage' : ''}`,
    }
  }

  return { level: 'none', label: '', color: '', reason: '' }
}
