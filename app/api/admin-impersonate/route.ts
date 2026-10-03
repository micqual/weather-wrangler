import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.email !== 'mdpankhurst@gmail.com') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const farmer_id = req.nextUrl.searchParams.get('farmer_id')
  if (!farmer_id) return NextResponse.redirect(new URL('/admin', req.url))

  const farmer = await prisma.farmers.findUnique({
    where: { id: farmer_id },
    select: { id: true, email: true, name: true },
  })

  if (!farmer) return NextResponse.redirect(new URL('/admin', req.url))

  const cookieStore = await cookies()
  cookieStore.set('admin_impersonate', farmer_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60,
    path: '/',
  })

  return NextResponse.redirect(new URL('/', req.url))
}
