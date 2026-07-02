import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import AdminMap from '@/components/AdminMap'
import type { StationMarker } from '@/components/AdminMap'

export const dynamic = 'force-dynamic'

export default async function AdminMapPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).email !== 'mdpankhurst@gmail.com') redirect('/')

  const stations = await prisma.stations.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
    },
    include: {
      weather_readings: {
        orderBy: { created_at: 'desc' },
        take: 1,
        select: {
          created_at: true,
          battery_mv: true,
          esp_battery_v: true,
        },
      },
    },
  })

  const markers: StationMarker[] = stations.map(s => {
    const r = s.weather_readings[0]
    const alerts: string[] = []

    // No data alert — no reading in 2 hours
    if (!r?.created_at) {
      alerts.push('⚠️ No readings received')
    } else {
      const ageMin = Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000)
      if (ageMin > 120) alerts.push(`⚠️ No data for ${Math.round(ageMin / 60)}h`)
    }

    // WS90 battery alert
    if (r?.battery_mv != null) {
      const v = (r.battery_mv as number) / 1000
      if (v < 2.0) alerts.push(`🔴 WS battery critical (${v.toFixed(2)}V)`)
      else if (v < 2.4) alerts.push(`🟡 WS battery low (${v.toFixed(2)}V)`)
    }

    // Node battery alert
    if (r?.esp_battery_v != null) {
      const v = r.esp_battery_v as number
      if (v < 3.4) alerts.push(`🔴 Node battery critical (${v.toFixed(2)}V)`)
      else if (v < 3.7) alerts.push(`🟡 Node battery low (${v.toFixed(2)}V)`)
    }

    const alertLevel: 'ok' | 'warn' | 'critical' =
      alerts.some(a => a.includes('🔴')) ? 'critical'
      : alerts.some(a => a.includes('🟡') || a.includes('⚠️')) ? 'warn'
      : 'ok'

    return {
      id: s.id,
      paddockName: s.paddock_name,
      latitude: s.latitude as number,
      longitude: s.longitude as number,
      alerts,
      alertLevel,
    }
  })

  const criticalCount = markers.filter(m => m.alertLevel === 'critical').length
  const warnCount = markers.filter(m => m.alertLevel === 'warn').length

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            <span style={{ color: 'var(--orange)' }}>Station</span> Map
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            {markers.length} station{markers.length !== 1 ? 's' : ''} with GPS coordinates
            {criticalCount > 0 && <span style={{ color: '#ef4444', marginLeft: 8 }}>· {criticalCount} critical</span>}
            {warnCount > 0 && <span style={{ color: '#facc15', marginLeft: 8 }}>· {warnCount} warnings</span>}
          </p>
        </div>
        <Link href="/admin" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← Admin</Link>
      </div>

      {markers.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No stations with GPS coordinates yet. Add lat/long when registering a station.
        </div>
      ) : (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <AdminMap stations={markers} />
        </div>
      )}

      {/* Alert list below the map */}
      {markers.filter(m => m.alertLevel !== 'ok').length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Alerts
          </h3>
          {markers.filter(m => m.alertLevel !== 'ok').map(m => (
            <div key={m.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{m.paddockName ?? m.id}</div>
              {m.alerts.map((a, i) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{a}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
