'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

type ActionState = { error?: string; success?: string } | null

async function assertOwnsStation(stationId: string) {
  const session = await auth()
  if (!session?.user) return null
  const isAdmin = (session.user as any).email === 'mdpankhurst@gmail.com'
  const station = await prisma.stations.findUnique({ where: { id: stationId } })
  if (!station) return null
  if (!isAdmin && station.farmer_id !== (session.user as any).id) return null
  return station
}

export async function createZone(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const name = (formData.get('name') as string)?.trim() || 'Zone 1'
  const crop_type_id = formData.get('crop_type_id') as string
  const planted_date = formData.get('planted_date') as string
  const soil_type = formData.get('soil_type') as string
  const hectares = formData.get('hectares') as string

  const station = await assertOwnsStation(station_id)
  if (!station) return { error: 'Not your paddock.' }

  await prisma.zones.create({
    data: {
      station_id,
      name,
      crop_type_id: crop_type_id ? parseInt(crop_type_id) : null,
      planted_date: planted_date ? new Date(planted_date) : null,
      soil_type: soil_type || 'loam',
      hectares: hectares || null,
    },
  })

  revalidatePath(`/station/${station_id}`)
  return { success: `${name} added.` }
}

export async function deleteZone(formData: FormData) {
  const zone_id = formData.get('zone_id') as string
  const station_id = formData.get('station_id') as string
  const station = await assertOwnsStation(station_id)
  if (!station) return
  await prisma.zones.delete({ where: { id: zone_id } })
  revalidatePath(`/station/${station_id}`)
}
