import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createStation, createFarmer, createFarm } from './actions'
import PaddockForm from './PaddockForm'
import ReplaceStationForm from './ReplaceStationForm'
import ResetPasswordForm from './ResetPasswordForm'
import EditStationForm from './EditStationForm'
import BorrowStationForm from './BorrowStationForm'
import SettingsForm from './SettingsForm'
import FarmerSubscriptionForm from './FarmerSubscriptionForm'
import AdminTabs from './AdminTabs'
import CollapsibleCard from '@/components/CollapsibleCard'
import Link from 'next/link'

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).email !== 'mdpankhurst@gmail.com') redirect('/')

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

  const [stations, farmers, farms, cropTypes, settings, expiringFarmers] = await Promise.all([
    prisma.stations.findMany({ orderBy: { created_at: 'desc' } }),
    prisma.farmers.findMany({ orderBy: { created_at: 'desc' } }),
    prisma.farms.findMany({ include: { farmers: true }, orderBy: { created_at: 'desc' } }),
    prisma.crop_types.findMany({ orderBy: { id: 'asc' } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
    prisma.farmers.findMany({
      where: { subscription_expires_at: { gte: twoWeeksAgo, lte: thirtyDaysFromNow } },
      orderBy: { subscription_expires_at: 'asc' },
    }),
  ])

  const unassigned = stations.filter(s => !s.farm_id)
  const assigned = stations.filter(s => s.farm_id)
  const cropById = new Map(cropTypes.map(c => [c.id, c]))
  const stationsWithGps = stations.filter(s => s.latitude && s.longitude).length
  const safeFarmers = farmers.map(f => ({ id: f.id, name: f.name, email: f.email }))
  const safeFarms = farms.map(f => ({ ...f, farmers: { name: f.farmers.name } }))
  const safeCropTypes = cropTypes.map(c => ({
    id: c.id, crop_name: c.crop_name, variety: c.variety,
    grain_price_per_tonne: c.grain_price_per_tonne != null ? parseFloat(String(c.grain_price_per_tonne)) : null,
  }))

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
            <span style={{ color: 'var(--orange)' }}>Admin</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            {stations.length} stations · {farmers.length} farmers · {farms.length} farms
          </p>
        </div>
        {stationsWithGps > 0 && (
          <Link href="/admin/map" style={{ border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            🗺️ Station map
          </Link>
        )}
      </div>

      {/* Expiring subscriptions */}
      {expiringFarmers.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '1px solid rgba(250,204,21,0.4)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#facc15', marginBottom: 12 }}>⚠️ Subscriptions expiring soon</div>
          {expiringFarmers.map(f => {
            const expiry = new Date((f as any).subscription_expires_at)
            const daysLeft = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            const isOverdue = daysLeft < 0
            return (
              <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{f.name ?? f.email}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{f.tier ?? 'base'}</span>
                  {(f as any).subscription_notes && <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>· {(f as any).subscription_notes}</span>}
                </div>
                <div style={{ color: isOverdue ? '#ef4444' : daysLeft <= 7 ? '#f97316' : '#facc15', fontWeight: 600 }}>
                  {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AdminTabs>
        {/* ── SETUP TAB ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CollapsibleCard title="Register a station" hint="Device ID, WS90 serial number, and GPS coordinates.">
            <form action={createStation}>
              <input className="input" name="id" placeholder="Station ID (e.g. node_3)" required style={{ marginBottom: 10 }} />
              <input className="input" name="ws90_serial" placeholder="WS90 serial number (optional)" style={{ marginBottom: 10 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input className="input" name="latitude" type="number" step="0.000001" placeholder="Latitude" />
                <input className="input" name="longitude" type="number" step="0.000001" placeholder="Longitude" />
              </div>
              <button className="btn-primary" type="submit">Register station</button>
            </form>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              {unassigned.length} unassigned: {unassigned.map(s => s.id).join(', ') || '—'}
            </div>
          </CollapsibleCard>

          <CollapsibleCard title="Edit a station" hint="Update paddock name, serial number, GPS, or elevation.">
            <EditStationForm stations={stations} />
          </CollapsibleCard>

          <CollapsibleCard title="Add a paddock" hint="Links a registered station to a farm.">
            <PaddockForm stations={stations} farms={safeFarms} />
          </CollapsibleCard>

          <CollapsibleCard title="Replace a station" hint="Stolen or broken — moves the paddock to a new device.">
            <ReplaceStationForm assigned={assigned} unassigned={unassigned} />
          </CollapsibleCard>

          <CollapsibleCard title="Borrow weather data" hint="Let a paddock use a nearby station's readings (max 5 km).">
            <BorrowStationForm stations={stations} />
          </CollapsibleCard>

          <CollapsibleCard title="All farms & paddocks" defaultOpen={true}>
            {farms.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No farms yet.</p>}
            {farms.map(f => (
              <div key={f.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 10 }}>
                <div style={{ fontWeight: 600 }}>{f.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {f.farmers.name}</span></div>
                {stations.filter(s => s.farm_id === f.id).map(s => {
                  const crop = s.crop_type_id ? cropById.get(s.crop_type_id) : null
                  return (
                    <div key={s.id} style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                      {s.paddock_name || s.id}
                      {(s as any).ws90_serial ? ` · S/N: ${(s as any).ws90_serial}` : ''}
                      {crop ? ` · ${crop.crop_name} (${crop.variety})` : ''}
                      {s.hectares ? ` · ${s.hectares} ha` : ''}
                      {s.planted_date ? ` · planted ${new Date(s.planted_date).toLocaleDateString('en-AU')}` : ''}
                      {s.latitude && s.longitude ? ` · ${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}` : ''}
                    </div>
                  )
                })}
                {stations.filter(s => s.farm_id === f.id).length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>No paddocks yet</div>
                )}
              </div>
            ))}
          </CollapsibleCard>
        </div>

        {/* ── FARMERS TAB ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CollapsibleCard title="Create a farmer login">
            <form action={createFarmer}>
              <input className="input" name="name" placeholder="Farmer name" required style={{ marginBottom: 10 }} />
              <input className="input" name="email" type="email" placeholder="Email" required style={{ marginBottom: 10 }} />
              <input className="input" name="password" type="password" placeholder="Password" required style={{ marginBottom: 10 }} />
              <button className="btn-primary" type="submit">Create login</button>
            </form>
          </CollapsibleCard>

          <CollapsibleCard title="Create a farm">
            <form action={createFarm}>
              <select className="input" name="farmer_id" required style={{ marginBottom: 10 }}>
                <option value="">Select farmer…</option>
                {safeFarmers.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                ))}
              </select>
              <input className="input" name="name" placeholder="Farm name" required style={{ marginBottom: 10 }} />
              <input className="input" name="address" placeholder="Address (optional)" style={{ marginBottom: 10 }} />
              <button className="btn-primary" type="submit">Create farm</button>
            </form>
          </CollapsibleCard>

          <CollapsibleCard title="Farmer subscriptions" hint="Set tier (Base/Mid/Pro), expiry date and payment notes." defaultOpen={true}>
            <FarmerSubscriptionForm farmers={farmers.map(f => ({
              id: f.id, name: f.name, email: f.email, tier: f.tier,
              subscription_expires_at: (f as any).subscription_expires_at ?? null,
              subscription_notes: (f as any).subscription_notes ?? null,
            }))} />
          </CollapsibleCard>

          <CollapsibleCard title="Reset a farmer's password" hint="Sets a new password — shown once after saving.">
            <ResetPasswordForm farmers={safeFarmers} />
          </CollapsibleCard>
        </div>

        {/* ── PRICES TAB ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CollapsibleCard title="Market prices" hint="Grain prices and fertiliser cost for economic N optimum." defaultOpen={true}>
            <SettingsForm
              nCost={settings ? parseFloat(String(settings.n_cost_per_kg_n)) : 1.20}
              cropTypes={safeCropTypes}
            />
          </CollapsibleCard>
        </div>
      </AdminTabs>
    </div>
  )
}
