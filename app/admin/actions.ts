'use server'

import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

export async function createStation(formData: FormData) {
  const id = (formData.get('id') as string)?.trim()
  if (!id) return
  await prisma.stations.create({ data: { id } })
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

export async function createPaddock(formData: FormData) {
  const station_id = formData.get('station_id') as string
  const farm_id = formData.get('farm_id') as string
  const paddock_name = formData.get('paddock_name') as string
  if (!station_id || !farm_id) return

  const farm = await prisma.farms.findUnique({ where: { id: farm_id } })
  if (!farm) return

  await prisma.stations.update({
    where: { id: station_id },
    data: { farm_id, farmer_id: farm.farmer_id, paddock_name: paddock_name || null },
  })
  revalidatePath('/admin')
}
