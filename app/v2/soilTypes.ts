import type { PHResult } from '@/lib/phInterpretation'
import type { PhosphorusResult } from '@/lib/phosphorus'
import type { SulphurResult, ChlorideResult, LimeResult } from '@/lib/nutrientInterpretation'
import type { NBudget } from '@/lib/nBudget'

export type SoilData = {
  pTest: { testedAt: string; depthCm: number; ph: number | null; colwell: number | null; pbi: number | null } | null
  nTest: { testedAt: string; depthCm: number; no3: number; nh4: number | null; sulphur: number | null; chloride: number | null } | null
  ph: PHResult | null
  phosphorus: PhosphorusResult | null
  sulphur: SulphurResult | null
  chloride: ChlorideResult | null
  lime: LimeResult | null
  applications: { id: number; appliedAt: string; product: string; rateKgHa: number; nKgHa: number; method: string | null; lossKg: number | null; incorporated: boolean | null }[]
  budget: NBudget
  seasonFrom: string | null
}
