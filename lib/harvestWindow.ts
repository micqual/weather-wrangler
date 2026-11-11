// Harvest window: fire danger (CFA/VFF Voluntary Grain Harvesting Guide) + grain dampness
// GFDI = Mk4 grassland formula, 100% cured, 4.5 t/ha fuel load (matches CFA ready reckoner)

export type HarvestStatus = 'go' | 'caution' | 'stop'
export type HarvestCondition = { label: string; value: string; status: HarvestStatus; reason: string }
export type HarvestWindow = { overall: HarvestStatus; gfdi: number | null; wind10mKmh: number | null; conditions: HarvestCondition[]; note: string }

// WS90 mounting height and open-farmland surface roughness
export const SENSOR_HEIGHT_M = 1.5
const ROUGHNESS_M = 0.03

// Log wind profile: scale wind measured at sensorHeight up to the 10 m standard the GFDI expects
export function windTo10m(windKmh: number, sensorHeightM = SENSOR_HEIGHT_M): number {
  if (sensorHeightM >= 10) return windKmh
  return windKmh * Math.log(10 / ROUGHNESS_M) / Math.log(sensorHeightM / ROUGHNESS_M)
}

export function calcGFDI(tempC: number, rh: number, wind10mKmh: number, fuelLoad = 4.5, curing = 100): number {
  return Math.exp(
    -1.523 + 1.027 * Math.log(fuelLoad) - 0.009432 * Math.pow(100 - curing, 1.536)
    + 0.02764 * tempC - 0.2205 * Math.sqrt(rh) + 0.6422 * Math.sqrt(wind10mKmh)
  )
}

export function getHarvestWindow(
  tempC: number | null,
  rh: number | null,
  windAvgMs: number | null,
  rainLast24h: number | null,
  sensorHeightM = SENSOR_HEIGHT_M,
): HarvestWindow {
  const conditions: HarvestCondition[] = []
  let gfdi: number | null = null
  let wind10mKmh: number | null = null

  if (tempC != null && rh != null && windAvgMs != null) {
    wind10mKmh = windTo10m(windAvgMs * 3.6, sensorHeightM)
    gfdi = calcGFDI(tempC, rh, wind10mKmh)
    const status: HarvestStatus = gfdi > 35 ? 'stop' : gfdi > 30 ? 'caution' : 'go'
    conditions.push({
      label: 'Fire danger (GFDI)', value: gfdi.toFixed(0), status,
      reason: status === 'stop' ? 'Above 35 — stop harvest' : status === 'caution' ? 'Approaching 35 — monitor closely' : 'Below 35',
    })
  }

  if (rh != null) {
    const status: HarvestStatus = rh >= 70 ? 'stop' : rh >= 60 ? 'caution' : 'go'
    conditions.push({
      label: 'Humidity', value: `${Math.round(rh)}%`, status,
      reason: status === 'stop' ? 'Grain likely tough' : status === 'caution' ? 'Check grain moisture' : 'Dry enough',
    })
  }

  if (rainLast24h != null) {
    const status: HarvestStatus = rainLast24h >= 5 ? 'stop' : rainLast24h >= 1 ? 'caution' : 'go'
    conditions.push({
      label: 'Rain last 24h', value: `${rainLast24h.toFixed(1)} mm`, status,
      reason: status === 'stop' ? 'Crop too wet' : status === 'caution' ? 'Check grain moisture' : 'No recent rain',
    })
  }

  const overall: HarvestStatus = conditions.some(c => c.status === 'stop') ? 'stop'
    : conditions.some(c => c.status === 'caution') ? 'caution' : 'go'

  const note = `Fire danger uses the CFA/VFF Voluntary Grain Harvesting Guide (stop above GFDI 35). `
    + `Wind is measured at ${sensorHeightM} m and scaled up to the 10 m standard`
    + (wind10mKmh != null ? ` (${(windAvgMs! * 3.6).toFixed(0)} → ${wind10mKmh.toFixed(0)} km/h)` : '')
    + `. This is a guide only — always check the CFA fire danger rating, total fire bans and your own grain moisture readings.`

  return { overall, gfdi, wind10mKmh, conditions, note }
}
