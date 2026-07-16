// Yield potential calculator based on Sadras & Angus (2006) / French & Schultz framework
// Used in Yield Prophet Lite (BCG/CSIRO)
//
// Water-limited yield = (Stored Soil Water + Growing Season Rainfall) × WUE
// Nitrogen-limited yield = based on available N and crop N requirement
//
// WUE default: 17 kg grain/mm (typical for Mallee wheat/barley)
// Evaporation coefficient: ~60mm (updated for southern Australia, modern varieties)
// Sadras & Angus 2006, Harries et al. 2022 — reduced from original French-Schultz 110mm

export type YieldPotentialResult = {
  waterLimitedTHa: number | null
  nLimitedTHa: number | null
  actualTHa: number | null
  targetTHa: number | null
  growingSeasonRainfallMm: number
  storedSoilWaterMm: number | null
  totalWaterMm: number | null
  availableNKgHa: number
  nReqKgPerTonne: number
  wue: number
  notes: string[]
}

export function calcYieldPotential(
  storedSoilWaterMm: number | null,
  growingSeasonRainfallMm: number,
  organicCarbonPct: number | null,
  availableNKgHa: number,
  nReqKgPerTonne: number | null | any,
  wueKgPerMm: number | null | any,
  targetYieldTHa: number | null,
  actualYieldTHa: number | null
): YieldPotentialResult {
  const notes: string[] = []
  const nReq = nReqKgPerTonne != null ? parseFloat(String(nReqKgPerTonne)) : 40
  const wue = wueKgPerMm != null ? parseFloat(String(wueKgPerMm)) : 17
  const evapCoeff = 60 // mm lost to evaporation — southern Australia modern varieties (Harries et al. 2022)

  // Soil organic carbon contributes ~20 kg N/ha per 1% OC (Mallee estimate)
  const ocN = organicCarbonPct != null ? parseFloat(String(organicCarbonPct)) * 20 : 0
  if (organicCarbonPct != null) notes.push(`OC contribution: ~${ocN.toFixed(0)} kg N/ha`)

  const totalN = availableNKgHa + ocN

  // Water-limited yield
  let waterLimitedTHa: number | null = null
  let totalWaterMm: number | null = null
  if (storedSoilWaterMm != null) {
    totalWaterMm = storedSoilWaterMm + growingSeasonRainfallMm - evapCoeff
    if (totalWaterMm < 0) totalWaterMm = 0
    waterLimitedTHa = Math.round((totalWaterMm * wue) / 100) / 10 // convert kg/ha to t/ha
    notes.push(`Water available: ${totalWaterMm.toFixed(0)}mm (${storedSoilWaterMm}mm stored + ${growingSeasonRainfallMm.toFixed(0)}mm rain - ${evapCoeff}mm evap)`)
  } else {
    notes.push('Stored soil water not set — water-limited yield unavailable')
  }

  // Nitrogen-limited yield
  const nLimitedKgHa = totalN / nReq * 1000
  const nLimitedTHa = Math.round(nLimitedKgHa) / 1000 * 10 / 10
  notes.push(`N available: ${totalN.toFixed(0)} kg N/ha → supports ${nLimitedTHa.toFixed(1)} t/ha`)

  // Cap N-limited at water-limited if both available
  const effectiveNLimited = waterLimitedTHa != null
    ? Math.min(nLimitedTHa, waterLimitedTHa)
    : nLimitedTHa

  return {
    waterLimitedTHa,
    nLimitedTHa: effectiveNLimited,
    actualTHa: actualYieldTHa,
    targetTHa: targetYieldTHa,
    growingSeasonRainfallMm,
    storedSoilWaterMm,
    totalWaterMm,
    availableNKgHa: totalN,
    nReqKgPerTonne: nReq,
    wue,
    notes,
  }
}

// Build a chart showing how yield potential changes as rainfall accumulates
export type YieldChartPoint = {
  date: string
  rainfallMm: number
  waterLimitedTHa: number | null
  nLimitedTHa: number | null
}

export function buildYieldChart(
  dailyRainReadings: { date: string; rainMm: number }[],
  storedSoilWaterMm: number | null,
  organicCarbonPct: number | null,
  availableNKgHa: number,
  nReqKgPerTonne: number | null | any,
  wueKgPerMm: number | null | any
): YieldChartPoint[] {
  const nReq = nReqKgPerTonne != null ? parseFloat(String(nReqKgPerTonne)) : 40
  const wue = wueKgPerMm != null ? parseFloat(String(wueKgPerMm)) : 17
  const evapCoeff = 60 // southern Australia modern varieties
  const ocN = organicCarbonPct != null ? parseFloat(String(organicCarbonPct)) * 20 : 0
  const totalN = availableNKgHa + ocN

  let cumulRain = 0
  const points: YieldChartPoint[] = []

  for (const r of dailyRainReadings) {
    cumulRain += r.rainMm

    const totalWater = storedSoilWaterMm != null
      ? Math.max(0, storedSoilWaterMm + cumulRain - evapCoeff)
      : null

    const waterLimited = totalWater != null
      ? Math.round((totalWater * wue) / 100) / 10
      : null

    const nLimited = Math.round((totalN / nReq * 1000)) / 1000
    const effectiveNLimited = waterLimited != null ? Math.min(nLimited, waterLimited) : nLimited

    points.push({
      date: r.date,
      rainfallMm: Math.round(cumulRain * 10) / 10,
      waterLimitedTHa: waterLimited,
      nLimitedTHa: Math.round(effectiveNLimited * 10) / 10,
    })
  }

  return points
}
