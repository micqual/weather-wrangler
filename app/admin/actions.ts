'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

export async function createStation(formData: FormData) {
  const id = (formData.get('id') as string)?.trim()
  const ws90_serial = (formData.get('ws90_serial') as string)?.trim() || null
  const latitude = formData.get('latitude') as string
  const longitude = formData.get('longitude') as string
  if (!id) return
  await prisma.stations.create({
    data: {
      id,
      ws90_serial,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
    }
  })
  revalidatePath('/admin')
}

export async function createFarmer(formData: FormData) {
  const name = formData.get('name') as string
  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const password = formData.get('password') as string
  if (!email || !password) return
  const password_hash = await bcrypt.hash(password, 12)
  await prisma.farmers.create({ data: { name, email, password_hash, active: true, tier: 'base' } })
  revalidatePath('/admin')
}

export async function createFarm(formData: FormData) {
  const farmer_id = formData.get('farmer_id') as string
  const name = formData.get('name') as string
  const address = formData.get('address') as string
  if (!farmer_id || !name) return
  await prisma.farms.create({ data: { farmer_id, name, address: address || null } })
  revalidatePath('/admin')
}

type ActionState = { error?: string; success?: string } | null

export async function createPaddock(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const farm_id = formData.get('farm_id') as string
  const paddock_name = formData.get('paddock_name') as string
  const confirmReassign = formData.get('confirm_reassign') === 'on'

  if (!station_id || !farm_id) return { error: 'Pick a station and a farm.' }

  const station = await prisma.stations.findUnique({ where: { id: station_id } })
  if (!station) return { error: 'Station not found.' }

  if (station.farm_id && station.farm_id !== farm_id && !confirmReassign) {
    return { error: `${station_id} is already assigned to a different farm. Tick "confirm reassignment" below if you really want to move it.` }
  }

  const farm = await prisma.farms.findUnique({ where: { id: farm_id } })
  if (!farm) return { error: 'Farm not found.' }

  await prisma.stations.update({
    where: { id: station_id },
    data: { farm_id, farmer_id: farm.farmer_id, paddock_name: paddock_name || null },
  })
  revalidatePath('/admin')
  revalidatePath('/')
  return { success: `${station_id} linked to ${farm.name}.` }
}

export async function replaceStation(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const old_station_id = formData.get('old_station_id') as string
  const new_station_id = formData.get('new_station_id') as string

  if (!old_station_id || !new_station_id) return { error: 'Pick both the old and the replacement station.' }
  if (old_station_id === new_station_id) return { error: 'Old and new station must be different.' }

  const oldStation = await prisma.stations.findUnique({ where: { id: old_station_id } })
  if (!oldStation) return { error: 'Old station not found.' }

  const newStation = await prisma.stations.findUnique({ where: { id: new_station_id } })
  if (!newStation) return { error: `${new_station_id} isn't registered yet — register it in step 1 first.` }

  await prisma.stations.update({
    where: { id: new_station_id },
    data: { farm_id: oldStation.farm_id, farmer_id: oldStation.farmer_id, paddock_name: oldStation.paddock_name },
  })
  await prisma.stations.update({
    where: { id: old_station_id },
    data: { farm_id: null, farmer_id: null },
  })

  revalidatePath('/admin')
  revalidatePath('/')
  return { success: `${new_station_id} now stands in for ${old_station_id}'s paddock. ${old_station_id} is unassigned but its history is untouched.` }
}

export async function resetPassword(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const farmer_id = formData.get('farmer_id') as string
  const new_password = formData.get('new_password') as string

  if (!farmer_id || !new_password) return { error: 'Pick a farmer and enter a new password.' }
  if (new_password.length < 6) return { error: 'Password should be at least 6 characters.' }

  const farmer = await prisma.farmers.findUnique({ where: { id: farmer_id } })
  if (!farmer) return { error: 'Farmer not found.' }

  const password_hash = await bcrypt.hash(new_password, 12)
  await prisma.farmers.update({ where: { id: farmer_id }, data: { password_hash } })

  return { success: `Password for ${farmer.email} is now: ${new_password} — copy it now, it won't be shown again.` }
}
