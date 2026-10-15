import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isMobile } from './device'
import V2Shell from './V2Shell'

export const dynamic = 'force-dynamic'

export default async function V2Home() {
  if (await isMobile()) redirect('/')

  const session = await auth()
  if (!session?.user) redirect('/login')

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    orderBy: { paddock_name: 'asc' },
    include: { crop_types: true },
  })

  const polygons = await prisma.paddock_polygons.findMany({
    where: { station_id: { in: stations.map((s) => s.id) } },
  })

  return (
    <V2Shell
      paddocks={stations.map((s) => ({
        id: s.id,
        name: s.paddock_name ?? s.id,
        crop: [(s as any).crop_types?.crop_name, (s as any).crop_types?.variety].filter(Boolean).join(' · ') || null,
      }))}
      polygons={polygons.map((p) => ({ id: p.id, stationId: p.station_id, geojson: p.geojson }))}
    />
  )
}
