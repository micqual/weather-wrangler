'use server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { interpretPH } from '@/lib/phInterpretation'
import { interpretPhosphorus } from '@/lib/phosphorus'
import { interpretSulphur, interpretChloride, calcLimeRequirement } from '@/lib/nutrientInterpretation'
import { calcNBudget } from '@/lib/nBudget'
import type { SoilData } from './soilTypes'

const day = (d: Date) => d.toISOString().slice(0, 10)

export async function getSoilAndN(stationId: string): Promise<SoilData | null> {
  const session = await auth()
  if (!session?.user) return null

  const station = await prisma.stations.findFirst({
    where: { id: stationId, farmer_id: (session.user as any).id },
    include: { crop_types: true },
  })
  if (!station) return null

  const crop: string | null = (station as any).crop_types?.crop_name ?? null
  const soilType: string | null = (station as any).soil_type ?? null
  const hectares: number | null = (station as any).hectares ?? null
  const planted: Date | null = (station as any).planted_date ?? null

  const [pTest, nTest, apps] = await Promise.all([
    prisma.phosphorus_soil_tests.findFirst({ where: { station_id: stationId }, orderBy: { tested_at: 'desc' } }),
    prisma.nitrogen_soil_tests.findFirst({ where: { station_id: stationId }, orderBy: { tested_at: 'desc' } }),
    prisma.nitrogen_applications.findMany({
      where: { station_id: stationId, ...(planted ? { applied_at: { gte: planted } } : {}) },
      orderBy: { applied_at: 'desc' },
    }),
  ])

  const phVal = pTest?.ph_cacl2 ?? null
  const ph = phVal != null ? interpretPH(phVal, crop) : null
  const phosphorus = pTest && (pTest.p_colwell_mg_kg != null || pTest.pbi != null)
    ? interpretPhosphorus(pTest.p_colwell_mg_kg, pTest.pbi, null, hectares, crop)
    : null
  const sVal = nTest?.sulphur_mg_kg ?? null
  const clVal = nTest?.chloride_mg_kg ?? null
  const sulphur = sVal != null ? interpretSulphur(sVal, crop) : null
  const chloride = clVal != null ? interpretChloride(clVal, soilType, crop) : null
  const lime = ph?.limeRequired && phVal != null ? calcLimeRequirement(phVal, 5.5, soilType, 90, hectares) : null

  const budget = calcNBudget(
    nTest ? [{ no3_n_kg_ha: nTest.no3_n_kg_ha, nh4_n_kg_ha: nTest.nh4_n_kg_ha }] : [],
    apps.map((a) => ({ n_kg_ha: a.n_kg_ha, incorporated: a.incorporated, product: a.product, daysToRain: a.days_to_rain })),
    soilType,
    null,
    null,
  )

  return {
    pTest: pTest ? { testedAt: day(pTest.tested_at), depthCm: pTest.depth_cm, ph: pTest.ph_cacl2, colwell: pTest.p_colwell_mg_kg, pbi: pTest.pbi } : null,
    nTest: nTest ? { testedAt: day(nTest.tested_at), depthCm: nTest.depth_cm, no3: nTest.no3_n_kg_ha, nh4: nTest.nh4_n_kg_ha, sulphur: nTest.sulphur_mg_kg, chloride: nTest.chloride_mg_kg } : null,
    ph, phosphorus, sulphur, chloride, lime,
    applications: apps.map((a) => ({
      id: a.id, appliedAt: day(a.applied_at), product: a.product, rateKgHa: a.rate_kg_ha, nKgHa: a.n_kg_ha,
      method: a.method, lossKg: a.volatilization_loss_kg, incorporated: a.incorporated,
    })),
    budget,
    seasonFrom: planted ? day(planted) : null,
  }
}
