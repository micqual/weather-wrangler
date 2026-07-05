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

export async function createIrrigationLog(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const zone_id = (formData.get('zone_id') as string) || null
  const irrigated_at = formData.get('irrigated_at') as string
  const amount_mm = formData.get('amount_mm') as string
  const method = formData.get('method') as string
  const notes = formData.get('notes') as string

  const station = await assertOwnsStation(station_id)
  if (!station) return { error: 'Not your paddock.' }
  if (!amount_mm) return { error: 'Amount is required.' }

  await prisma.irrigation_logs.create({
    data: {
      station_id,
      zone_id,
      irrigated_at: irrigated_at ? new Date(irrigated_at) : new Date(),
      amount_mm: parseFloat(amount_mm),
      method: method || 'flood',
      notes: notes || null,
    },
  })

  revalidatePath(`/station/${station_id}`)
  return { success: `${amount_mm}mm irrigation recorded.` }
}

export async function deleteIrrigationLog(formData: FormData) {
  const id = formData.get('id') as string
  const station_id = formData.get('station_id') as string
  const station = await assertOwnsStation(station_id)
  if (!station) return
  await prisma.irrigation_logs.delete({ where: { id } })
  revalidatePath(`/station/${station_id}`)
}

export async function createManualRain(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const rain_date = formData.get('rain_date') as string
  const amount_mm = formData.get('amount_mm') as string
  const notes = formData.get('notes') as string

  const station = await assertOwnsStation(station_id)
  if (!station) return { error: 'Not your paddock.' }
  if (!amount_mm || !rain_date) return { error: 'Date and amount are required.' }

  await prisma.manual_rain_entries.create({
    data: {
      station_id,
      rain_date: new Date(rain_date),
      amount_mm: parseFloat(amount_mm),
      notes: notes || null,
    },
  })

  revalidatePath(`/station/${station_id}`)
  return { success: `${amount_mm}mm manual rain entry added for ${new Date(rain_date).toLocaleDateString('en-AU')}.` }
}

export async function deleteManualRain(formData: FormData) {
  const id = formData.get('id') as string
  const station_id = formData.get('station_id') as string
  const station = await assertOwnsStation(station_id)
  if (!station) return
  await prisma.manual_rain_entries.delete({ where: { id } })
  revalidatePath(`/station/${station_id}`)
}
