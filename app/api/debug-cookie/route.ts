import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/auth'

export async function GET(req: NextRequest) {
  const session = await auth()
  const cookieStore = await cookies()
  const impersonateId = cookieStore.get('admin_impersonate')?.value
  
  return NextResponse.json({
    sessionEmail: (session?.user as any)?.email,
    sessionId: (session?.user as any)?.id,
    impersonateCookie: impersonateId ?? 'not set',
  })
}
