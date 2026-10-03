'use server'

import { signIn } from '@/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function impersonateFarmer(formData: FormData) {
  const farmer_id = formData.get('farmer_id') as string
  if (!farmer_id) return

  const farmer = await prisma.farmers.findUnique({
    where: { id: farmer_id },
    select: { email: true },
  })

  if (!farmer?.email) return

  // Store the farmer email in a temp cookie and redirect
  // We use a server-side redirect with a special param that the auth callback picks up
  redirect(`/api/admin-impersonate?farmer_id=${farmer_id}`)
}
