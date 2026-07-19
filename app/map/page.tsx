import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import FarmMap from './FarmMap'
import { getDailyRainWithRate, getDailyAvgTempsWithGapFill } from '@/lib/gdd'

export const dynamic = 'force-dynamic'

export default async function MapPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: {
      crop_types: true,
      paddock_polygons: true,
    },
  })

  const stationData = await Promise.all(stations.map(async s => {
    const { rainMm } = await getDailyRainWithRate(s.id, prisma)

    // GDD
    let gddPct = 0
    let daysToHarvest: number | null = null
    if (s.planted_date && s.latitude && s.longitude && s.crop_types?.target_gdd_harvest) {
      const temps = await getDailyAvgTempsWithGapFill(s.id, new Date(s.planted_date), s.latitude, s.longitude, prisma)
      const baseTemp = parseFloat(String(s.crop_types.base_temp_gdd ?? 4))
      const targetGdd = parseFloat(String(s.crop_types.target_gdd_harvest))
      const totalGdd = temps.reduce((sum, t) => sum + Math.max(0, t - baseTemp), 0)
      gddPct = targetGdd > 0 ? Math.round((totalGdd / targetGdd) * 100) : 0
      if (targetGdd > 0 && temps.length > 0) {
        const avgDaily = totalGdd / temps.length
        const remaining = targetGdd - totalGdd
        if (remaining > 0 && avgDaily > 0) {
          daysToHarvest = Math.ceil(remaining / avgDaily)
        }
      }
    }

    // Latest reading
    const latest = await prisma.weather_readings.findFirst({
      where: { station_id: s.id },
      orderBy: { created_at: 'desc' },
      select: { temperature_c: true },
    })

    return {
      id: s.id,
      name: s.paddock_name ?? s.id,
      latitude: s.latitude ? parseFloat(String(s.latitude)) : null,
      longitude: s.longitude ? parseFloat(String(s.longitude)) : null,
      cropName: s.crop_types?.crop_name ?? null,
      variety: s.crop_types?.variety ?? null,
      hectares: s.hectares ? parseFloat(String(s.hectares)) : null,
      plantedDate: s.planted_date ? s.planted_date.toLocaleDateString('en-AU') : null,
      rainToday: rainMm != null ? Math.round(rainMm * 10) / 10 : null,
      tempC: latest?.temperature_c != null ? parseFloat(String(latest.temperature_c)) : null,
      gddPct,
      daysToHarvest,
      polygons: s.paddock_polygons.map(p => ({
        id: p.id,
        name: p.name,
        geojson: p.geojson,
      })),
    }
  }))

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← My Paddocks</Link>
        <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>My Farm</h1>
        <div style={{ width: 80 }} />
      </div>
      <div style={{ flex: 1 }}>
        <FarmMap stations={stationData} />
      </div>
    </div>
  )
}
