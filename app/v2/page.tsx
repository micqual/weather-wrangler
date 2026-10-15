import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { isMobile } from './device'

export const dynamic = 'force-dynamic'

export default async function V2Home() {
  if (await isMobile()) redirect('/')

  const session = await auth()
  if (!session?.user) redirect('/login')

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    orderBy: { paddock_name: 'asc' },
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', height: '100vh' }}>
      <aside style={{ borderRight: '1px solid #3f2c57', overflowY: 'auto', padding: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>My paddocks</div>
        {stations.map((s) => (
          <Link key={s.id} href={'/station/' + s.id} style={{ display: 'block', padding: '12px 14px', marginBottom: 8, borderRadius: 10, background: '#271b38', color: 'inherit', textDecoration: 'none' }}>
            <div style={{ fontWeight: 600 }}>{s.paddock_name ?? s.id}</div>
          </Link>
        ))}
        <Link href="/" style={{ display: 'block', marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>Back to classic view</Link>
      </aside>
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        Farm map coming next
      </main>
    </div>
  )
}
