import { auth } from '@/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.email !== 'mdpankhurst@gmail.com') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const farmer_id = req.nextUrl.searchParams.get('farmer_id')
  if (!farmer_id) return NextResponse.redirect(new URL('/admin', req.url))

  return NextResponse.redirect(new URL(`/?viewAs=${farmer_id}`, req.url))
}
