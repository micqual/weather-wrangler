// Sulphur, Chloride interpretation and Lime calculator
// for Australian dryland cereals
//
// Sulphur thresholds: Agriculture Victoria / GRDC (KCl40 method)
// Chloride thresholds: GRDC Southern Region / SA PIRSA guidelines
// Lime calculator: GRDC lime management guidelines

export type NutrientStatus = 'deficient' | 'marginal' | 'adequate' | 'high' | 'toxic'

export type SulphurResult = {
  status: NutrientStatus
  color: string
  label: string
  interpretation: string
  recommendationKgHa: number | null
  notes: string[]
}

export type ChlorideResult = {
  status: NutrientStatus
  color: string
  label: string
  interpretation: string
  notes: string[]
}

export type LimeResult = {
  rateMin: number
  rateMax: number
  totalTonnesMin: number | null
  totalTonnesMax: number | null
  notes: string[]
}

// ── Sulphur ─────────────────────────────────────────────────────────────
// KCl40 method thresholds (Agriculture Victoria / GRDC)
// Cereal critical: ~8 mg/kg; Canola: ~10 mg/kg (higher requirement)

export function interpretSulphur(
  sulphurMgKg: number,
  cropName: string | null
): SulphurResult {
  const notes: string[] = []
  const isCanola = /canola|rape/i.test(cropName ?? '')

  const threshold = isCanola ? 10 : 8
  if (isCanola) notes.push('Canola has a higher sulphur requirement than cereals')
  notes.push(`KCl40 method — critical level ~${threshold} mg/kg for ${isCanola ? 'canola' : 'cereals'}`)

  // Recommendation: ~10 kg S/ha per unit below threshold (rough guide)
  const deficit = Math.max(0, threshold - sulphurMgKg)
  const recKgHa = deficit > 0 ? Math.round(deficit * 1.5) : null

  if (sulphurMgKg < 4) {
    return {
      status: 'deficient', color: '#ef4444', label: 'Deficient',
      interpretation: 'Sulphur deficiency likely — response to S fertiliser expected',
      recommendationKgHa: recKgHa,
      notes: [...notes, 'Consider gypsum (14% S) or ammonium sulphate (24% S) at seeding'],
    }
  }
  if (sulphurMgKg < threshold) {
    return {
      status: 'marginal', color: '#f97316', label: 'Marginal',
      interpretation: 'Below critical level — yield response to S fertiliser possible',
      recommendationKgHa: recKgHa,
      notes: [...notes, 'Monitor crop — apply S if deficiency symptoms appear'],
    }
  }
  if (sulphurMgKg <= 20) {
    return {
      status: 'adequate', color: '#4ade80', label: 'Adequate',
      interpretation: 'Sulphur sufficient — no response to added S expected',
      recommendationKgHa: null,
      notes,
    }
  }
  return {
    status: 'high', color: '#60a5fa', label: 'High',
    interpretation: 'High sulphur — no additional S required',
    recommendationKgHa: null,
    notes: [...notes, 'High S soils can indicate past gypsum application or sodic subsoils'],
  }
}

// ── Chloride ─────────────────────────────────────────────────────────────
// Chloride in Australian dryland soils — primarily a toxicity/salinity concern
// GRDC / SA PIRSA guidelines:
//   <60 mg/kg: not a concern
//   60–120 mg/kg: monitor, can limit yield on sensitive crops/soils
//   >120 mg/kg: elevated — consider soil salinity risk
//   >200 mg/kg: toxic range for most cereals

export function interpretChloride(
  chlorideMgKg: number,
  soilType: string | null,
  cropName: string | null
): ChlorideResult {
  const notes: string[] = []
  const isSandy = /sand|loamy sand/i.test(soilType ?? '')
  const isBarley = /barley/i.test(cropName ?? '')

  if (isBarley) notes.push('Barley is more tolerant of chloride than wheat or canola')
  if (isSandy) notes.push('Sandy soils — chloride leaches more readily, less accumulation risk')
  notes.push('Chloride is primarily a salinity/toxicity indicator in dryland soils — not a deficiency nutrient')

  if (chlorideMgKg < 60) {
    return {
      status: 'adequate', color: '#4ade80', label: 'Low — no concern',
      interpretation: 'Chloride at background levels — not a yield-limiting factor',
      notes,
    }
  }
  if (chlorideMgKg < 120) {
    return {
      status: 'marginal', color: '#facc15', label: 'Moderate — monitor',
      interpretation: 'Elevated chloride — monitor for salinity symptoms especially in dry years',
      notes: [...notes, 'Consider subsoil chloride testing to assess leaching depth'],
    }
  }
  if (chlorideMgKg < 200) {
    return {
      status: 'high', color: '#f97316', label: 'High — yield risk',
      interpretation: 'High chloride — potential yield limitation on sensitive crops',
      notes: [...notes,
        'Check deeper soil layers — subsoil Cl accumulation more damaging than surface',
        'Consider more tolerant varieties if Cl persists',
      ],
    }
  }
  return {
    status: 'toxic', color: '#ef4444', label: 'Very high — toxic risk',
    interpretation: 'Very high chloride — significant salinity stress likely',
    notes: [...notes,
      'Seek agronomist advice on variety selection and management',
      'Test subsoil layers to full root depth',
    ],
  }
}

// ── Lime calculator ───────────────────────────────────────────────────────
// Expanded from phInterpretation.ts to include NV and total paddock tonnes
// GRDC lime management guidelines for southern Australia
//
// Rule of thumb: 1 t/ha of pure CaCO3 (NV 100) raises pH ~0.1–0.2 units
// adjusted for soil type and buffering capacity

export function calcLimeRequirement(
  currentPH: number,
  targetPH: number,
  soilType: string | null,
  limeNV: number,       // Neutralising Value of lime (%) — ag lime typically 80–95
  hectares: number | null
): LimeResult {
  const notes: string[] = []
  const phIncrease = Math.max(0, targetPH - currentPH)

  if (phIncrease <= 0) {
    return { rateMin: 0, rateMax: 0, totalTonnesMin: null, totalTonnesMax: null, notes: ['pH already at or above target — no lime required'] }
  }

  // pH units needing correction × soil buffering factor × NV adjustment
  const soil = soilType?.toLowerCase() ?? ''
  let bufferFactor = 1.5 // t/ha per pH unit for loam (default)
  if (/sand|loamy sand/.test(soil)) {
    bufferFactor = 0.8
    notes.push('Sandy soil — lower buffering capacity, less lime needed per pH unit')
  } else if (/clay/.test(soil)) {
    bufferFactor = 2.5
    notes.push('Clay soil — high buffering capacity, more lime needed per pH unit')
  }

  // Adjust for lime NV (pure CaCO3 = NV 100)
  const nvFactor = 100 / Math.max(limeNV, 50) // prevent divide by zero
  const baseRate = phIncrease * bufferFactor * nvFactor

  const rateMin = Math.round(baseRate * 0.8 * 10) / 10
  const rateMax = Math.round(baseRate * 1.2 * 10) / 10

  notes.push(`Lime NV ${limeNV}% — rates adjusted accordingly`)
  notes.push(`Apply in 2–3 split applications for best results`)
  notes.push(`Incorporate if possible — surface-applied lime takes 2–4 years to reach subsoil`)
  notes.push(`Re-test pH in 12–18 months after application`)

  const totalMin = hectares ? Math.round(rateMin * hectares * 10) / 10 : null
  const totalMax = hectares ? Math.round(rateMax * hectares * 10) / 10 : null

  return { rateMin, rateMax, totalTonnesMin: totalMin, totalTonnesMax: totalMax, notes }
}
