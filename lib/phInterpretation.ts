// Soil pH interpretation for Australian dryland cereals
// Based on GRDC Soil Acidification guidelines and DPIRD pH management
// All values for pH in CaCl2 (which reads ~0.7 units lower than water pH)

export type PHStatus = 'very acid' | 'acid' | 'slightly acid' | 'optimal' | 'alkaline' | 'very alkaline'

export type PHResult = {
  status: PHStatus
  color: string
  label: string
  interpretation: string
  limeRequired: boolean
  notes: string[]
}

export function interpretPH(phCaCl2: number, cropName: string | null): PHResult {
  const notes: string[] = []
  const crop = cropName?.toLowerCase() ?? ''

  // Optimal ranges by crop (pH CaCl2)
  // Wheat/barley: 5.5–7.0 optimal, <4.8 severe aluminium toxicity
  // Canola: 5.8–7.5 optimal, sensitive to low pH
  // Legumes: 6.0–7.0 optimal

  let optimalMin = 5.5
  let optimalMax = 7.0

  if (crop.includes('canola')) {
    optimalMin = 5.8
    optimalMax = 7.5
    notes.push('Canola is sensitive to low pH — aluminium toxicity risk below 5.0')
  } else if (crop.includes('lupin') || crop.includes('legume')) {
    optimalMin = 6.0
    optimalMax = 7.0
    notes.push('Legumes require higher pH for rhizobium activity')
  } else if (crop.includes('wheat') || crop.includes('barley') || crop.includes('oat')) {
    notes.push('Cereals tolerate moderate acidity but aluminium toxicity risk below 4.8')
  }

  // Nutrient availability notes
  if (phCaCl2 < 4.5) {
    notes.push('Severe aluminium and manganese toxicity likely')
    notes.push('Phosphorus, calcium, magnesium availability severely reduced')
    notes.push('Urgent lime application required')
  } else if (phCaCl2 < 5.0) {
    notes.push('Aluminium toxicity risk — root damage likely in susceptible crops')
    notes.push('Phosphorus availability reduced')
  } else if (phCaCl2 < optimalMin) {
    notes.push('Below optimal — consider lime application')
    notes.push('Phosphorus and molybdenum availability reduced')
  } else if (phCaCl2 > 8.0) {
    notes.push('Iron, manganese, zinc and boron deficiency likely')
    notes.push('Phosphorus availability reduced at high pH')
  } else if (phCaCl2 > 7.5) {
    notes.push('Micronutrient deficiencies possible — monitor iron and zinc')
  }

  // Classify
  if (phCaCl2 < 4.5) return { status: 'very acid', color: '#ef4444', label: 'Very acid', interpretation: 'Severe acidity — urgent lime required', limeRequired: true, notes }
  if (phCaCl2 < optimalMin) return { status: 'acid', color: '#f97316', label: 'Acid', interpretation: `Below optimal range (${optimalMin}–${optimalMax})`, limeRequired: phCaCl2 < 5.5, notes }
  if (phCaCl2 <= optimalMax) return { status: 'optimal', color: '#4ade80', label: 'Optimal', interpretation: `Within optimal range (${optimalMin}–${optimalMax})`, limeRequired: false, notes }
  if (phCaCl2 <= 8.0) return { status: 'alkaline', color: '#facc15', label: 'Alkaline', interpretation: 'Above optimal — micronutrient deficiency risk', limeRequired: false, notes }
  return { status: 'very alkaline', color: '#ef4444', label: 'Very alkaline', interpretation: 'Very high pH — significant micronutrient deficiency risk', limeRequired: false, notes }
}

// Lime requirement estimate (tonnes/ha) to raise pH to target
// Based on GRDC lime calculator guidelines for southern Australia
// Actual rate depends on lime quality (NV), soil type and buffering capacity
export function estimateLimeRate(
  currentPH: number,
  targetPH: number,
  soilType: string | null
): { rateMin: number; rateMax: number; notes: string } {
  const phIncrease = Math.max(0, targetPH - currentPH)
  if (phIncrease <= 0) return { rateMin: 0, rateMax: 0, notes: 'pH already at or above target' }

  // Sandy soils need less lime, clay soils more
  const soil = soilType?.toLowerCase() ?? ''
  let multiplier = 1.5 // loam default (t/ha per pH unit)
  if (/sand|loamy sand/.test(soil)) multiplier = 0.8
  else if (/clay/.test(soil)) multiplier = 2.5

  const base = phIncrease * multiplier
  return {
    rateMin: Math.round(base * 0.8 * 10) / 10,
    rateMax: Math.round(base * 1.2 * 10) / 10,
    notes: `Estimate for agricultural lime (NV ~90%). Apply in split doses and re-test in 12–18 months.`,
  }
}
