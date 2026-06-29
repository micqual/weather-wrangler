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

export async function createNitrogenTest(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const zone_id = (formData.get('zone_id') as string) || null
  const tested_at = formData.get('tested_at') as string
  const no3 = formData.get('no3_n_kg_ha') as string
  const nh4 = formData.get('nh4_n_kg_ha') as string
  const sulphur = formData.get('sulphur_mg_kg') as string
  const chloride = formData.get('chloride_mg_kg') as string

  const station = await assertOwnsStation(station_id)
  if (!station) return { error: 'Not your paddock.' }
  if (!no3) return { error: 'Nitrate Nitrogen is required.' }

  await prisma.nitrogen_soil_tests.create({
    data: {
      station_id,
      zone_id,
      tested_at: tested_at ? new Date(tested_at) : new Date(),
      no3_n_kg_ha: parseFloat(no3),
      nh4_n_kg_ha: nh4 ? parseFloat(nh4) : 0,
      sulphur_mg_kg: sulphur ? parseFloat(sulphur) : null,
      chloride_mg_kg: chloride ? parseFloat(chloride) : null,
    },
  })

  revalidatePath(`/station/${station_id}`)
  return { success: 'Nitrogen test added.' }
}

export async function createPhosphorusTest(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const zone_id = (formData.get('zone_id') as string) || null
  const tested_at = formData.get('tested_at') as string
  const p_colwell = formData.get('p_colwell_mg_kg') as string
  const pbi = formData.get('pbi') as string
  const ph = formData.get('ph_cacl2') as string

  const station = await assertOwnsStation(station_id)
  if (!station) return { error: 'Not your paddock.' }

  await prisma.phosphorus_soil_tests.create({
    data: {
      station_id,
      zone_id,
      tested_at: tested_at ? new Date(tested_at) : new Date(),
      p_colwell_mg_kg: p_colwell ? parseFloat(p_colwell) : null,
      pbi: pbi ? parseFloat(pbi) : null,
      ph_cacl2: ph ? parseFloat(ph) : null,
    },
  })

  revalidatePath(`/station/${station_id}`)
  return { success: 'Phosphorus test added.' }
}

export async function deleteNitrogenTest(formData: FormData) {
  const id = parseInt(formData.get('id') as string)
  const station_id = formData.get('station_id') as string
  const station = await assertOwnsStation(station_id)
  if (!station) return
  await prisma.nitrogen_soil_tests.delete({ where: { id } })
  revalidatePath(`/station/${station_id}`)
}

export async function deletePhosphorusTest(formData: FormData) {
  const id = parseInt(formData.get('id') as string)
  const station_id = formData.get('station_id') as string
  const station = await assertOwnsStation(station_id)
  if (!station) return
  await prisma.phosphorus_soil_tests.delete({ where: { id } })
  revalidatePath(`/station/${station_id}`)
}
