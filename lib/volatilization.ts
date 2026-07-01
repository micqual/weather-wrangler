// N loss estimation — volatilization and leaching
// Based on Australian dryland cropping extension guidelines
// Volatilization: surface-applied urea ammonia loss to atmosphere
// Leaching: nitrate movement below root zone with excess rainfall
//
// These are practical estimates, not full mechanistic models.
// Flagged clearly in the methodology tab.

export type NLossResult = {
  volatilizationPct: number
  volatilizationKgNHa: number
  leachingPct: number
  leachingKgNHa: number
  totalLossKgNHa: number
  retainedKgNHa: number
  notes: string[]
}

export function estimateNLosses(
  nKgHa: number,
  incorporated: boolean,
  avgTempC: number | null,
  avgHumidity: number | null,
  daysToRain: number | null,
  rainSinceApplication: number | null,
  soilType: string | null,
  product: string
): NLossResult {
  const notes: string[] = []

  // ── Volatilization ──────────────────────────────────────────────
  const isUreaBased = /urea|uan/i.test(product)
  let volatPct = 0

  if (!isUreaBased) {
    notes.push(`${product}: minimal volatilization risk`)
  } else if (incorporated) {
    volatPct = 2
    notes.push('Incorporated — minimal volatilization')
  } else {
    // Base rate from temperature
    let basePct = 15
    if (avgTempC == null) {
      notes.push('No temp data — using moderate volatilization estimate')
    } else if (avgTempC < 10) {
      basePct = 5
      notes.push(`Low temp (${avgTempC.toFixed(1)}°C) — slow hydrolysis`)
    } else if (avgTempC < 15) {
      basePct = 10
    } else if (avgTempC < 20) {
      basePct = 18
    } else if (avgTempC < 25) {
      basePct = 25
      notes.push(`Warm temp (${avgTempC.toFixed(1)}°C) — elevated loss risk`)
    } else {
      basePct = 35
      notes.push(`Hot temp (${avgTempC.toFixed(1)}°C) — high volatilization risk`)
    }

    // Rain modifier — rain within 4 days cuts loss significantly
    if (daysToRain != null) {
      if (daysToRain <= 1) {
        basePct *= 0.2
        notes.push('Rain within 24h — low volatilization')
      } else if (daysToRain <= 4) {
        basePct *= 0.5
        notes.push(`Rain within ${daysToRain} days — reduced volatilization`)
      } else if (daysToRain > 10) {
        basePct *= 1.3
        notes.push(`No rain for ${daysToRain}+ days — extended exposure`)
      }
    } else {
      notes.push('Days to rain unknown — using base estimate')
    }

    // Humidity modifier
    if (avgHumidity != null && avgHumidity < 40) {
      basePct *= 1.2
      notes.push(`Low humidity (${avgHumidity}%) — increased volatilization`)
    }

    volatPct = Math.min(basePct, 50)
  }

  // ── Leaching ────────────────────────────────────────────────────
  // Nitrate (NO3) is mobile — leaching risk depends on rainfall and soil type
  // Sandy soils leach more than clay; high rainfall events push N below root zone
  let leachPct = 0

  const sandySoil = soilType ? /sand|loamy sand|sandy loam/i.test(soilType) : false
  const claySoil = soilType ? /clay|heavy|cracking/i.test(soilType) : false

  if (rainSinceApplication != null) {
    if (rainSinceApplication > 100) {
      leachPct = sandySoil ? 25 : claySoil ? 5 : 12
      notes.push(`High rainfall (${rainSinceApplication.toFixed(0)}mm) — significant leaching risk`)
    } else if (rainSinceApplication > 50) {
      leachPct = sandySoil ? 12 : claySoil ? 2 : 6
      notes.push(`Moderate rainfall (${rainSinceApplication.toFixed(0)}mm) — some leaching risk`)
    } else if (rainSinceApplication > 25) {
      leachPct = sandySoil ? 5 : 0
      if (sandySoil) notes.push('Sandy soil with rain — minor leaching possible')
    }
  } else {
    notes.push('Rainfall since application unknown — leaching not estimated')
  }

  const volatKgNHa = nKgHa * (volatPct / 100)
  const leachKgNHa = nKgHa * (leachPct / 100)
  const totalLoss = volatKgNHa + leachKgNHa
  const retained = Math.max(0, nKgHa - totalLoss)

  return {
    volatilizationPct: Math.round(volatPct * 10) / 10,
    volatilizationKgNHa: Math.round(volatKgNHa * 10) / 10,
    leachingPct: Math.round(leachPct * 10) / 10,
    leachingKgNHa: Math.round(leachKgNHa * 10) / 10,
    totalLossKgNHa: Math.round(totalLoss * 10) / 10,
    retainedKgNHa: Math.round(retained * 10) / 10,
    notes,
  }
}
