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

export async function createNitrogenApplication(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const station_id = formData.get('station_id') as string
  const zone_id = (formData.get('zone_id') as string) || null
  const product_id = formData.get('product_id') as string
  const rate_kg_ha = formData.get('rate_kg_ha') as string
  const applied_at = formData.get('applied_at') as string
  const method = formData.get('method') as string
  const incorporated = formData.get('incorporated') === 'on'
  const notes = formData.get('notes') as string

  const station = await assertOwnsStation(station_id)
  if (!station) return { error: 'Not your paddock.' }
  if (!rate_kg_ha) return { error: 'Rate is required.' }
  if (!product_id) return { error: 'Select a product.' }

  const product = await prisma.nitrogen_products.findUnique({ where: { id: parseInt(product_id) } })
  if (!product) return { error: 'Product not found.' }

  const rate = parseFloat(rate_kg_ha)
  const n_kg_ha = rate * (product.n_percent / 100)

  await prisma.nitrogen_applications.create({
    data: {
      station_id,
      zone_id,
      product: product.name,
      rate_kg_ha: rate,
      n_kg_ha,
      applied_at: applied_at ? new Date(applied_at) : new Date(),
      method: method || 'broadcast',
      incorporated,
      notes: notes || null,
    },
  })

  revalidatePath(`/station/${station_id}`)
  return { success: `${product.name} application recorded — ${n_kg_ha.toFixed(1)} kg N/ha` }
}

export async function deleteNitrogenApplication(formData: FormData) {
  const id = parseInt(formData.get('id') as string)
  const station_id = formData.get('station_id') as string
  const station = await assertOwnsStation(station_id)
  if (!station) return
  await prisma.nitrogen_applications.delete({ where: { id } })
  revalidatePath(`/station/${station_id}`)
}
