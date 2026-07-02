// Disease risk assessment for wheat and barley
// Thresholds based on GRDC published guidelines:
// - Stripe rust: GRDC Tips & Tactics, GRDC Update Papers 2025
// - Stem/leaf rust: Agriculture Victoria / Field Crop Diseases Victoria
// - Septoria tritici blotch: GRDC Update Papers 2023

export type DiseaseLevel = 'low' | 'moderate' | 'high'

export type DiseaseRisk = {
  name: string
  level: DiseaseLevel
  reason: string
}

export type DiseaseResult = {
  overall: DiseaseLevel
  icon: string
  label: string
  diseases: DiseaseRisk[]
  isCereal: boolean
}

function leafWetnessLikely(humidity: number | null, rainLast24h: number): boolean {
  // Proxy for leaf wetness: humidity ≥95% OR recent rain
  return (humidity != null && humidity >= 95) || rainLast24h > 0.5
}

export function assessDiseaseRisk(
  tempC: number | null,
  humidity: number | null,
  rainLast24h: number,
  cropName: string | null
): DiseaseResult {
  const crop = cropName?.toLowerCase() ?? ''
  const isCereal = /wheat|barley/.test(crop)

  if (!isCereal || tempC == null) {
    return { overall: 'low', icon: '🟢', label: 'Low', diseases: [], isCereal }
  }

  const diseases: DiseaseRisk[] = []
  const wetness = leafWetnessLikely(humidity, rainLast24h)

  // Stripe rust — cool + wet
  // Optimal 8–12°C, infects up to 20°C, needs ≥3h leaf wetness
  if (tempC >= 5 && tempC <= 20 && wetness) {
    const level: DiseaseLevel = (tempC >= 8 && tempC <= 15 && (humidity ?? 0) >= 95)
      ? 'high' : 'moderate'
    diseases.push({
      name: 'Stripe rust',
      level,
      reason: `${tempC.toFixed(1)}°C + leaf wetness — optimal infection range`,
    })
  }

  // Stem/leaf rust — warm + humid
  // Most rapid 15–30°C, favoured by high humidity and dew
  if (tempC >= 15 && tempC <= 30 && (humidity ?? 0) >= 80) {
    diseases.push({
      name: 'Stem/leaf rust',
      level: tempC >= 20 ? 'high' : 'moderate',
      reason: `${tempC.toFixed(1)}°C + ${humidity}% humidity — favourable for rust development`,
    })
  }

  // Septoria tritici blotch — wet mild conditions, rain splash
  if (tempC >= 10 && tempC <= 25 && rainLast24h > 1) {
    diseases.push({
      name: 'Septoria',
      level: rainLast24h > 5 ? 'high' : 'moderate',
      reason: `${rainLast24h.toFixed(1)}mm rain at ${tempC.toFixed(1)}°C — rain splash favours spread`,
    })
  }

  // Powdery mildew — moderate temps, high humidity, less rain
  if (tempC >= 15 && tempC <= 22 && (humidity ?? 0) >= 70 && rainLast24h < 2) {
    diseases.push({
      name: 'Powdery mildew',
      level: 'moderate',
      reason: `Warm humid conditions without heavy rain — favourable`,
    })
  }

  const overall: DiseaseLevel = diseases.some(d => d.level === 'high') ? 'high'
    : diseases.some(d => d.level === 'moderate') ? 'moderate'
    : 'low'

  const icon = overall === 'high' ? '🔴' : overall === 'moderate' ? '🟡' : '🟢'
  const label = overall === 'high' ? 'High risk' : overall === 'moderate' ? 'Moderate' : 'Low risk'

  return { overall, icon, label, diseases, isCereal }
}
