import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createStation, createFarmer, createFarm } from './actions'
import PaddockForm from './PaddockForm'
import ReplaceStationForm from './ReplaceStationForm'
import ResetPasswordForm from './ResetPasswordForm'
import EditStationForm from './EditStationForm'
import BorrowStationForm from './BorrowStationForm'
import FarmerSubscriptionForm from './FarmerSubscriptionForm'
import SettingsForm from './SettingsForm'
import Link from 'next/link'

const titleStyle = { margin: '0 0 4px', fontSize: 15, fontWeight: 600 }
const hintStyle = { margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }

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
      where: {
        subscription_expires_at: {
          gte: twoWeeksAgo,
          lte: thirtyDaysFromNow,
        },
      },
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
    id: c.id,
    crop_name: c.crop_name,
    variety: c.variety,
    grain_price_per_tonne: c.grain_price_per_tonne != null ? parseFloat(String(c.grain_price_per_tonne)) : null,
  }))

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
            <span style={{ color: 'var(--orange)' }}>Admin</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            Register stations, create farmer logins, set up farms and paddocks
          </p>
        </div>
        {stationsWithGps > 0 && (
          <Link href="/admin/map" style={{ border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            🗺️ Station map
          </Link>
        )}
      </div>

      {expiringFarmers.length > 0 && (
        <div className="card" style={{ padding: 20, marginBottom: 20, border: '1px solid rgba(250,204,21,0.4)' }}>
          <h3 style={{ ...titleStyle, color: '#facc15', marginBottom: 12 }}>⚠️ Subscriptions expiring soon</h3>
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
                <div style={{ color: isOverdue ? '#ef4444' : daysLeft <= 7 ? '#f97316' : '#facc15', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 16 }}>
                  {isOverdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>1. Register a station</h3>
          <p style={hintStyle}>Device ID, WS90 serial number, and GPS coordinates.</p>
          <form action={createStation}>
            <input className="input" name="id" placeholder="Station ID (e.g. node_3)" required style={{ marginBottom: 10 }} />
            <input className="input" name="ws90_serial" placeholder="WS90 serial number (optional)" style={{ marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input className="input" name="latitude" type="number" step="0.000001" placeholder="Latitude" />
              <input className="input" name="longitude" type="number" step="0.000001" placeholder="Longitude" />
            </div>
            <button className="btn-primary" type="submit">Register station</button>
          </form>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            {unassigned.length} unassigned: {unassigned.map(s => s.id).join(', ') || '—'}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>2. Edit a station</h3>
          <p style={hintStyle}>Update paddock name, serial number, GPS, or elevation.</p>
          <EditStationForm stations={stations} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>3. Create a farmer login</h3>
          <form action={createFarmer}>
            <input className="input" name="name" placeholder="Farmer name" required style={{ marginBottom: 10 }} />
            <input className="input" name="email" type="email" placeholder="Email" required style={{ marginBottom: 10 }} />
            <input className="input" name="password" type="password" placeholder="Password" required style={{ marginBottom: 10 }} />
            <button className="btn-primary" type="submit">Create login</button>
          </form>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>4. Create a farm</h3>
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
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>5. Add a paddock</h3>
          <p style={hintStyle}>Links a registered station to a farm.</p>
          <PaddockForm stations={stations} farms={safeFarms} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>6. Replace a station</h3>
          <p style={hintStyle}>Stolen or broken — moves the paddock to a new device.</p>
          <ReplaceStationForm assigned={assigned} unassigned={unassigned} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>8. Market prices</h3>
          <p style={hintStyle}>Update grain prices and fertiliser cost for economic N optimum calculations.</p>
          <SettingsForm
            nCost={settings ? parseFloat(String(settings.n_cost_per_kg_n)) : 1.20}
            cropTypes={safeCropTypes}
          />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>8. Borrow weather data</h3>
          <p style={hintStyle}>Let a paddock use a nearby station's readings (max 5 km).</p>
          <BorrowStationForm stations={stations} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>Farmer subscriptions</h3>
          <p style={hintStyle}>Set tier (Base/Mid/Pro), expiry date and payment notes.</p>
          <FarmerSubscriptionForm farmers={farmers.map(f => ({
            id: f.id,
            name: f.name,
            email: f.email,
            tier: f.tier,
            subscription_expires_at: (f as any).subscription_expires_at ?? null,
            subscription_notes: (f as any).subscription_notes ?? null,
          }))} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>7. Reset a farmer's password</h3>
          <p style={hintStyle}>Sets a new password directly — shown once after saving.</p>
          <ResetPasswordForm farmers={safeFarmers} />
        </div>
      </div>

      </div>

      <div style={{ marginTop: 32 }}>
        <h3 style={titleStyle}>All farms &amp; paddocks</h3>
        {farms.length === 0 && <p style={hintStyle}>No farms yet.</p>}
        {farms.map(f => (
          <div key={f.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>{f.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>· {f.farmers.name}</span></div>
            {stations.filter(s => s.farm_id === f.id).map(s => {
              const crop = s.crop_type_id ? cropById.get(s.crop_type_id) : null
              return (
                <div key={s.id} style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
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
      </div>
    </div>
  )
}
