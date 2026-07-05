'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { parseFile } from './geoparse'

type ActionState = { error?: string; success?: string; polygons?: { id: string; name: string }[] } | null

async function assertOwnsStation(stationId: string) {
  const session = await auth()
  if (!session?.user) return null
  const isAdmin = (session.user as any).email === 'mdpankhurst@gmail.com'
  const station = await prisma.stations.findUnique({ where: { id: stationId } })
  if (!station) return null
  if (!isAdmin && station.farmer_id !== (session.user as any).id) return null
  return station
}

export async function uploadPolygons(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const zone_id = (formData.get('zone_id') as string) || null
  const file = formData.get('file') as File

  const station = await assertOwnsStation(station_id)
  if (!station) return { error: 'Not your paddock.' }
  if (!file || file.size === 0) return { error: 'Please select a file.' }

  const text = await file.text()
  let polygons
  try {
    polygons = parseFile(file.name, text)
  } catch (e: any) {
    return { error: e.message }
  }

  if (polygons.length === 0) return { error: 'No polygon shapes found in file.' }

  await Promise.all(polygons.map(p =>
    prisma.paddock_polygons.create({
      data: {
        station_id,
        zone_id,
        name: p.name,
        geojson: p.geojson as any,
      },
    })
  ))

  revalidatePath(`/station/${station_id}`)
  return { success: `${polygons.length} polygon${polygons.length > 1 ? 's' : ''} imported.` }
}

export async function deletePolygon(formData: FormData) {
  const id = formData.get('id') as string
  const station_id = formData.get('station_id') as string
  const station = await assertOwnsStation(station_id)
  if (!station) return
  await prisma.paddock_polygons.delete({ where: { id } })
  revalidatePath(`/station/${station_id}`)
}
