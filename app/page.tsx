import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import FarmMap from './map/FarmMap'
import NavMenu from '@/components/NavMenu'
import { getDailyRainWithRate, getDailyAvgTempsWithGapFill } from '@/lib/gdd'
import { getSubscriptionStatus, canAccessFeature } from '@/lib/subscription'
import { calcNBudget } from '@/lib/nBudget'
import { getGrowingSeasonRain } from '@/lib/gdd'

export const dynamic = 'force-dynamic'

function toN(v: any) { return v == null ? null : parseFloat(String(v)) }

export default async function Home() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const isAdmin = (session.user as any).email === 'mdpankhurst@gmail.com'
  const cookieStore = await cookies()
  const impersonateId = cookieStore.get('admin_impersonate')?.value
  const isImpersonating = isAdmin && !!impersonateId

  if (isAdmin && impersonateId) {
    const impersonatedFarmer = await prisma.farmers.findUnique({
      where: { id: impersonateId },
      select: { id: true, email: true, name: true },
    })
    if (impersonatedFarmer) {
      ;(session.user as any).id = impersonatedFarmer.id
      ;(session.user as any).name = impersonatedFarmer.name
    }
  }

  const farmer = await prisma.farmers.findUnique({
    where: { id: (session.user as any).id },
    select: { tier: true, subscription_expires_at: true },
  })

  const subStatus = getSubscriptionStatus(
    farmer?.tier ?? 'base',
    (farmer as any)?.subscription_expires_at ?? null
  )

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: { crop_types: true, paddock_polygons: true },
  })

  const stationData = await Promise.all(stations.map(async s => {
    const { rainMm } = await getDailyRainWithRate(s.id, prisma)

    let gddPct = 0
    let daysToHarvest: number | null = null
    if (s.planted_date && s.latitude && s.longitude && s.crop_types?.target_gdd_harvest) {
      const temps = await getDailyAvgTempsWithGapFill(s.id, new Date(s.planted_date), s.latitude, s.longitude, prisma)
      const baseTemp = toN(s.crop_types.base_temp_gdd) ?? 4
      const targetGdd = toN(s.crop_types.target_gdd_harvest) ?? 0
      const totalGdd = temps.reduce((sum, t) => sum + Math.max(0, t - baseTemp), 0)
      gddPct = targetGdd > 0 ? Math.round((totalGdd / targetGdd) * 100) : 0
      if (targetGdd > 0 && temps.length > 0) {
        const avgDaily = totalGdd / temps.length
        const remaining = targetGdd - totalGdd
        if (remaining > 0 && avgDaily > 0) daysToHarvest = Math.ceil(remaining / avgDaily)
      }
    }

    const latest = await prisma.weather_readings.findFirst({
      where: { station_id: s.id },
      orderBy: { created_at: 'desc' },
      select: { temperature_c: true },
    })

    const [soilTests, phosphorusTests, nitrogenApps] = await Promise.all([
      prisma.nitrogen_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
      prisma.phosphorus_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
      prisma.nitrogen_applications.findMany({ where: { station_id: s.id }, orderBy: { applied_at: 'desc' } }),
    ])

    const nBudget = calcNBudget(soilTests, nitrogenApps, s.soil_type ?? null, s.target_yield_t_ha ?? null, 40)
    const totalAvailableN = nBudget.totalAvailable > 0 ? nBudget.totalAvailable : null

    const latestP = phosphorusTests[0]
    let pStatus: string | null = null
    if (latestP?.p_colwell_mg_kg != null && latestP?.pbi != null) {
      const colwellP = toN(latestP.p_colwell_mg_kg)!
      const criticalP = 4.6 * Math.pow(toN(latestP.pbi)!, 0.393)
      if (colwellP < criticalP * 0.7) pStatus = 'deficient'
      else if (colwellP < criticalP) pStatus = 'marginal'
      else if (colwellP < criticalP * 1.5) pStatus = 'adequate'
      else pStatus = 'high'
    }

    const growingSeasonRain = s.planted_date ? await getGrowingSeasonRain(s.id, new Date(s.planted_date), prisma) : null

    return {
      id: s.id,
      name: s.paddock_name ?? s.id,
      latitude: s.latitude ? toN(s.latitude) : null,
      longitude: s.longitude ? toN(s.longitude) : null,
      cropName: s.crop_types?.crop_name ?? null,
      variety: s.crop_types?.variety ?? null,
      hectares: s.hectares ? toN(s.hectares) : null,
      plantedDate: s.planted_date ? s.planted_date.toLocaleDateString('en-AU') : null,
      rainToday: rainMm != null ? Math.round(rainMm * 10) / 10 : null,
      tempC: latest?.temperature_c != null ? toN(latest.temperature_c) : null,
      gddPct,
      daysToHarvest,
      growingSeasonRain,
      totalAvailableN,
      pStatus,
      polygons: s.paddock_polygons.map(p => ({ id: p.id, name: p.name, geojson: p.geojson })),
    }
  }))

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/Logo.png" alt="Weather Wrangler" style={{ width: 32, height: 32, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>My Farm</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stationData.length} paddock{stationData.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/dashboard" style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', textDecoration: 'none' }}>Dashboard</Link>
          <NavMenu canPro={canAccessFeature(subStatus, 'pro')} isAdmin={isAdmin} />
        </div>
      </div>

      {isImpersonating && (
        <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid #f97316', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: '#f97316' }}>👁 Viewing as farmer — <strong>{(session.user as any)?.name}</strong></span>
          <a href="/admin" style={{ color: '#f97316', fontSize: 12, textDecoration: 'none', border: '1px solid #f97316', borderRadius: 6, padding: '3px 8px' }}>Stop viewing</a>
        </div>
      )}

      {/* Full screen map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <FarmMap stations={stationData} defaultLayer="rain" />
      </div>
    </div>
  )
}
