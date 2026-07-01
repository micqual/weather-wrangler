'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

type ActionState = { error?: string; success?: string } | null

export async function updatePaddockDetails(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const session = await auth()
  if (!session?.user) return { error: 'Not signed in.' }

  const station_id = formData.get('station_id') as string
  const crop_type_id = formData.get('crop_type_id') as string
  const planted_date = formData.get('planted_date') as string
  const hectares = formData.get('hectares') as string
  const soil_type = formData.get('soil_type') as string
  const target_yield = formData.get('target_yield_t_ha') as string
  const actual_yield = formData.get('actual_yield_t_ha') as string

  if (!station_id) return { error: 'Missing paddock.' }

  const isAdmin = (session.user as any).email === 'mdpankhurst@gmail.com'
  const station = await prisma.stations.findUnique({ where: { id: station_id } })
  if (!station) return { error: 'Paddock not found.' }
  if (!isAdmin && station.farmer_id !== (session.user as any).id) return { error: 'Not your paddock.' }

  await prisma.stations.update({
    where: { id: station_id },
    data: {
      crop_type_id: crop_type_id ? parseInt(crop_type_id) : null,
      planted_date: planted_date ? new Date(planted_date) : null,
      hectares: hectares ? parseFloat(hectares) : null,
      soil_type: soil_type || null,
      target_yield_t_ha: target_yield ? parseFloat(target_yield) : null,
      actual_yield_t_ha: actual_yield ? parseFloat(actual_yield) : null,
    },
  })

  revalidatePath('/')
  revalidatePath('/admin')
  revalidatePath(`/station/${station_id}`)
  return { success: 'Paddock details updated.' }
}
