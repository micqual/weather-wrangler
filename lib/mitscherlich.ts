// Mitscherlich yield curve
// Y = A × (1 - e^(-c(x + b)))
//
// Y = predicted yield (t/ha)
// A = maximum attainable yield (water-limited, t/ha)
// x = applied N (kg/ha)
// b = native soil N (kg/ha)
// c = efficiency constant (crop-specific, default 0.03 for dryland cereals)
//
// Reference: Mitscherlich (1909), adapted for Australian dryland cereals
// c values: wheat ~0.02-0.04, barley ~0.03-0.05
// Tune c per variety using actual yield response trials

export type MitscherlichPoint = {
  nApplied: number      // kg N/ha applied
  totalN: number        // x + b (applied + soil)
  predictedYield: number // t/ha
}

export type MitscherlichResult = {
  points: MitscherlichPoint[]
  currentYield: number | null
  optimalN: number | null      // N rate that gets within 95% of max yield
  maxYield: number             // A — water-limited ceiling
  soilN: number                // b — native soil N
  cFactor: number              // c — efficiency constant
  economicOptimalN: number | null // N rate where marginal return = grain price / N cost
}

export function calcMitscherlich(
  maxYieldTHa: number,        // A — from water-limited yield calc
  soilNKgHa: number,          // b — from soil test
  cFactor: number,            // c — from crop_types
  currentAppliedN: number,    // what's already been applied
  grainPricePerTonne?: number, // $ — for economic optimum
  nCostPerKg?: number          // $ per kg N — for economic optimum
): MitscherlichResult {
  const A = maxYieldTHa
  const b = soilNKgHa
  const c = cFactor

  // Generate curve from 0 to 200 kg N/ha in 5kg steps
  const points: MitscherlichPoint[] = []
  for (let x = 0; x <= 200; x += 5) {
    const totalN = x + b
    const predictedYield = A * (1 - Math.exp(-c * totalN))
    points.push({
      nApplied: x,
      totalN,
      predictedYield: Math.round(predictedYield * 100) / 100,
    })
  }

  // Current yield at current applied N
  const currentYield = A * (1 - Math.exp(-c * (currentAppliedN + b)))

  // Optimal N — point where 95% of max yield is achieved
  let optimalN: number | null = null
  for (const p of points) {
    if (p.predictedYield >= A * 0.95) {
      optimalN = p.nApplied
      break
    }
  }

  // Economic optimal N — where marginal revenue = marginal cost
  // dY/dx = A × c × e^(-c(x+b))
  // Set equal to cost ratio: nCost / (grainPrice × 1000) [converting t to kg]
  let economicOptimalN: number | null = null
  if (grainPricePerTonne && nCostPerKg) {
    const costRatio = nCostPerKg / grainPricePerTonne / 1000 // kg N per kg grain
    // A × c × e^(-c(x+b)) = costRatio
    // e^(-c(x+b)) = costRatio / (A × c)
    // -c(x+b) = ln(costRatio / (A × c))
    // x = -ln(costRatio / (A × c)) / c - b
    const ratio = costRatio / (A * c)
    if (ratio > 0 && ratio < 1) {
      const x = -Math.log(ratio) / c - b
      economicOptimalN = Math.max(0, Math.round(x))
    }
  }

  return {
    points,
    currentYield: Math.round(currentYield * 100) / 100,
    optimalN,
    maxYield: A,
    soilN: b,
    cFactor: c,
    economicOptimalN,
  }
}
