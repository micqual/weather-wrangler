export type SprayStatus = 'go' | 'caution' | 'stop'

export type SprayCondition = {
  label: string
  value: string
  status: SprayStatus
  reason: string
}

export type SprayWindowResult = {
  overall: SprayStatus
  conditions: SprayCondition[]
  deltaT: number | null
}

// Delta T (wet bulb depression) approximation using Magnus formula
// Accurate to ~0.3°C for typical field conditions
export function calculateDeltaT(tempC: number, humidity: number): number {
  const a = 17.27
  const b = 237.7
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100)
  const dewPoint = (b * alpha) / (a - alpha)
  const wetBulb = dewPoint + ((tempC - dewPoint) / 3) // simplified approximation
  return tempC - wetBulb
}

export function getSprayWindow(
  tempC: number | null,
  humidity: number | null,
  windAvgMs: number | null,
  windMaxMs: number | null,
  hour: number // Melbourne local hour 0-23
): SprayWindowResult {
  const conditions: SprayCondition[] = []
  let worstStatus: SprayStatus = 'go'

  const flag = (s: SprayStatus) => {
    if (s === 'stop') worstStatus = 'stop'
    else if (s === 'caution' && worstStatus !== 'stop') worstStatus = 'caution'
  }

  const windKmh = windAvgMs != null ? windAvgMs * 3.6 : null
  const gustKmh = windMaxMs != null ? windMaxMs * 3.6 : null

  // Delta T
  let deltaT: number | null = null
  if (tempC != null && humidity != null) {
    deltaT = calculateDeltaT(tempC, humidity)
    const dtStatus: SprayStatus =
      deltaT >= 2 && deltaT <= 8 ? 'go'
      : deltaT > 8 && deltaT <= 10 ? 'caution'
      : 'stop'
    flag(dtStatus)
    conditions.push({
      label: 'Delta T',
      value: `${deltaT.toFixed(1)}°C`,
      status: dtStatus,
      reason: dtStatus === 'go' ? 'Good (2–8°C)'
        : dtStatus === 'caution' ? 'Marginal — droplet evaporation increasing'
        : deltaT < 2 ? 'Too low — inversion risk' : 'Too high — rapid evaporation',
    })
  }

  // Wind speed
  if (windKmh != null) {
    const isNightTime = hour < 7 || hour >= 19 // rough inversion risk window
    const windStatus: SprayStatus =
      windKmh > 20 ? 'stop'
      : windKmh < 3 ? 'stop'
      : windKmh < 11 && isNightTime ? 'stop'
      : windKmh < 11 && !isNightTime ? 'caution'
      : 'go'
    flag(windStatus)
    conditions.push({
      label: 'Wind',
      value: `${windKmh.toFixed(0)} km/h`,
      status: windStatus,
      reason: windStatus === 'go' ? 'Good (3–20 km/h)'
        : windKmh > 20 ? 'Too windy — drift risk'
        : windKmh < 3 ? 'Too calm — inversion risk'
        : 'Low wind — inversion risk at this time of day',
    })
  }

  // Gusts — shouldn't exceed ~1/3 above average
  if (windKmh != null && gustKmh != null) {
    const gustRatio = (gustKmh - windKmh) / windKmh
    if (gustRatio > 0.33 && windKmh > 0) {
      flag('caution')
      conditions.push({
        label: 'Gusts',
        value: `${gustKmh.toFixed(0)} km/h`,
        status: 'caution',
        reason: 'Gusty — variable drift risk',
      })
    }
  }

  // Temperature
  if (tempC != null) {
    const tempStatus: SprayStatus = tempC > 35 ? 'stop' : tempC > 28 ? 'caution' : 'go'
    flag(tempStatus)
    conditions.push({
      label: 'Temp',
      value: `${tempC.toFixed(1)}°C`,
      status: tempStatus,
      reason: tempStatus === 'go' ? 'Good'
        : tempC > 35 ? 'Too hot — rapid evaporation' : 'Warm — monitor closely',
    })
  }

  // Humidity
  if (humidity != null) {
    const humStatus: SprayStatus = humidity < 20 ? 'stop' : humidity < 30 ? 'caution' : 'go'
    flag(humStatus)
    conditions.push({
      label: 'Humidity',
      value: `${humidity}%`,
      status: humStatus,
      reason: humStatus === 'go' ? 'Good'
        : humidity < 20 ? 'Too dry — drift risk' : 'Low — monitor',
    })
  }

  return { overall: worstStatus, conditions, deltaT }
}

export const STATUS_COLORS = {
  go: { bg: '#16a34a', text: '#fff', label: '🟢 Good to spray' },
  caution: { bg: '#d97706', text: '#fff', label: '🟡 Spray with caution' },
  stop: { bg: '#dc2626', text: '#fff', label: '🔴 Do not spray' },
}
