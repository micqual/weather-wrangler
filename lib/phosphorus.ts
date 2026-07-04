// Phosphorus interpretation for Australian dryland cereals
// Based on GRDC published guidelines:
// - Critical Colwell P formula: Moody (2007) via GRDC Update Papers 2020, 2022
// - PBI classes: GRDC Crop Nutrition community / DPIRD
// - P build-up factor: standard P export × grain yield approach
// - Capital P: P required to reach critical level given PBI
//
// All values are for wheat/barley. Canola critical P is ~60% of wheat.
// These are 90% of maximum yield critical values — site-specific calibration
// is always preferable.

export type PBIClass = 'very very low' | 'very low' | 'low' | 'moderate' | 'high' | 'very high'

export type PhosphorusResult = {
  pbiClass: PBIClass | null
  criticalColwellP: number | null       // mg P/kg — 90% max yield threshold
  colwellStatus: 'deficient' | 'marginal' | 'adequate' | 'high' | null
  buildUpFactor: number | null          // kg P per t grain exported
  capitalPRequired: number | null       // kg P/ha to reach critical level
  capitalPFertiliser: number | null     // kg DAP/ha equivalent (at 18% P)
  notes: string[]
}

export function getPBIClass(pbi: number): PBIClass {
  if (pbi < 35) return 'very very low'
  if (pbi < 70) return 'very low'
  if (pbi < 140) return 'low'
  if (pbi < 280) return 'moderate'
  if (pbi < 840) return 'high'
  return 'very high'
}

export function getCriticalColwellP(pbi: number): number {
  // Moody (2007): Critical Colwell P = 4.6 × PBI^0.393
  // Confirmed by GRDC Update Papers 2020 & 2022
  return Math.round(4.6 * Math.pow(pbi, 0.393))
}

export function interpretPhosphorus(
  colwellP: number | null,
  pbi: number | null,
  targetYieldTHa: number | null,
  hectares: number | null,
  cropName: string | null
): PhosphorusResult {
  const notes: string[] = []

  if (pbi == null && colwellP == null) {
    return { pbiClass: null, criticalColwellP: null, colwellStatus: null, buildUpFactor: null, capitalPRequired: null, capitalPFertiliser: null, notes: ['No phosphorus test data available'] }
  }

  // PBI class
  const pbiClass = pbi != null ? getPBIClass(pbi) : null

  // Critical Colwell P from PBI
  let criticalColwellP: number | null = null
  if (pbi != null) {
    criticalColwellP = getCriticalColwellP(pbi)
    // Canola critical P is ~60% of wheat
    if (cropName?.toLowerCase().includes('canola')) {
      criticalColwellP = Math.round(criticalColwellP * 0.6)
      notes.push('Critical P adjusted for canola (60% of wheat value)')
    }
    notes.push(`Critical Colwell P for this soil (PBI ${pbi}): ${criticalColwellP} mg/kg`)
  }

  // Colwell P status
  let colwellStatus: PhosphorusResult['colwellStatus'] = null
  if (colwellP != null && criticalColwellP != null) {
    const ratio = colwellP / criticalColwellP
    if (ratio < 0.7) colwellStatus = 'deficient'
    else if (ratio < 0.9) colwellStatus = 'marginal'
    else if (ratio <= 1.5) colwellStatus = 'adequate'
    else colwellStatus = 'high'
  } else if (colwellP != null) {
    // No PBI — use simple thresholds (Southern Australia loam default ~PBI 100)
    if (colwellP < 20) colwellStatus = 'deficient'
    else if (colwellP < 30) colwellStatus = 'marginal'
    else if (colwellP < 60) colwellStatus = 'adequate'
    else colwellStatus = 'high'
    notes.push('No PBI data — using default thresholds (test PBI for accurate interpretation)')
  }

  // P build-up factor (P exported in grain)
  // Wheat/barley: ~2.7–3.6 kg P per tonne grain (use 3.0 as midpoint)
  // Canola: ~4.0–6.5 kg P per tonne (use 5.0 as midpoint)
  const pExportKgPerTonne = cropName?.toLowerCase().includes('canola') ? 5.0 : 3.0
  const buildUpFactor = pExportKgPerTonne

  // Capital P required to reach critical level
  let capitalPRequired: number | null = null
  let capitalPFertiliser: number | null = null
  if (colwellP != null && criticalColwellP != null && colwellP < criticalColwellP) {
    const deficit = criticalColwellP - colwellP
    // Rule of thumb: ~1 kg P/ha raises Colwell P by ~1 mg/kg in a 0-10cm layer
    // Adjusted for PBI: higher PBI = more P needed per unit change
    const pbiMultiplier = pbi != null ? Math.max(1, pbi / 100) : 1
    capitalPRequired = Math.round(deficit * pbiMultiplier)
    // DAP is 18% P
    capitalPFertiliser = Math.round(capitalPRequired / 0.18)
    notes.push(`${deficit} mg/kg Colwell P deficit — estimated ${capitalPRequired} kg P/ha needed`)
    if (hectares) {
      notes.push(`Total for paddock (${hectares} ha): ${Math.round(capitalPRequired * hectares)} kg P, ~${Math.round(capitalPFertiliser * hectares)} kg DAP`)
    }
  } else if (colwellP != null && criticalColwellP != null && colwellP >= criticalColwellP) {
    notes.push(`Colwell P (${colwellP}) is at or above critical (${criticalColwellP}) — maintenance rates only`)
    // Maintenance = P exported in grain
    if (targetYieldTHa) {
      const maintenanceP = Math.round(targetYieldTHa * pExportKgPerTonne)
      capitalPRequired = maintenanceP
      capitalPFertiliser = Math.round(maintenanceP / 0.18)
      notes.push(`Maintenance P for ${targetYieldTHa} t/ha target: ${maintenanceP} kg P/ha (~${capitalPFertiliser} kg DAP/ha)`)
    }
  }

  return {
    pbiClass,
    criticalColwellP,
    colwellStatus,
    buildUpFactor,
    capitalPRequired,
    capitalPFertiliser,
    notes,
  }
}

export const STATUS_CONFIG = {
  deficient: { color: '#ef4444', icon: '🔴', label: 'Deficient' },
  marginal: { color: '#f97316', icon: '🟡', label: 'Marginal' },
  adequate: { color: '#4ade80', icon: '🟢', label: 'Adequate' },
  high: { color: '#60a5fa', icon: '🔵', label: 'High' },
}
