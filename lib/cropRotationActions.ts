'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

type ActionState = { error?: string; success?: string } | null

export async function addCropRotation(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const crop_name = formData.get('crop_name') as string
  const variety = formData.get('variety') as string
  const planted_date = formData.get('planted_date') as string
  const harvest_date = formData.get('harvest_date') as string
  const yield_t_ha = formData.get('yield_t_ha') as string
  const notes = formData.get('notes') as string

  if (!crop_name) return { error: 'Crop name is required.' }

  await prisma.crop_rotation.create({
    data: {
      station_id,
      crop_name,
      variety: variety || null,
      planted_date: planted_date ? new Date(planted_date) : null,
      harvest_date: harvest_date ? new Date(harvest_date) : null,
      yield_t_ha: yield_t_ha ? parseFloat(yield_t_ha) : null,
      notes: notes || null,
    },
  })

  revalidatePath(`/station/${station_id}`)
  return { success: 'Season added.' }
}

export async function deleteCropRotation(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get('id') as string
  const station_id = formData.get('station_id') as string

  await prisma.crop_rotation.delete({ where: { id } })
  revalidatePath(`/station/${station_id}`)
  return { success: 'Removed.' }
}
