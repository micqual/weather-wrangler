import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createStation, createFarmer, createFarm } from './actions'
import PaddockForm from './PaddockForm'
import ReplaceStationForm from './ReplaceStationForm'
import ResetPasswordForm from './ResetPasswordForm'

const titleStyle = { margin: '0 0 4px', fontSize: 15, fontWeight: 600 }
const hintStyle = { margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if ((session.user as any).email !== 'mdpankhurst@gmail.com') redirect('/')

  const [stations, farmers, farms, cropTypes] = await Promise.all([
    prisma.stations.findMany({ orderBy: { created_at: 'desc' } }),
    prisma.farmers.findMany({ orderBy: { created_at: 'desc' } }),
    prisma.farms.findMany({ include: { farmers: true }, orderBy: { created_at: 'desc' } }),
    prisma.crop_types.findMany({ orderBy: { id: 'asc' } }),
  ])

  const unassigned = stations.filter(s => !s.farm_id)
  const assigned = stations.filter(s => s.farm_id)
  const cropById = new Map(cropTypes.map(c => [c.id, c]))

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>
        <span style={{ color: 'var(--orange)' }}>Admin</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 28px' }}>
        Register stations, create farmer logins, set up farms and paddocks
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>1. Register a station</h3>
          <p style={hintStyle}>Device ID, WS90 serial number, and GPS coordinates.</p>
          <form action={createStation}>
            <input className="input" name="id" placeholder="Station ID (e.g. node_3)" required style={{ marginBottom: 10 }} />
            <input className="input" name="ws90_serial" placeholder="WS90 serial number (optional)" style={{ marginBottom: 10 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input className="input" name="latitude" type="number" step="0.000001" placeholder="Latitude (e.g. -35.123)" />
              <input className="input" name="longitude" type="number" step="0.000001" placeholder="Longitude (e.g. 143.456)" />
            </div>
            <button className="btn-primary" type="submit">Register station</button>
          </form>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
            {unassigned.length} unassigned: {unassigned.map(s => s.id).join(', ') || '—'}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>2. Create a farmer login</h3>
          <form action={createFarmer}>
            <input className="input" name="name" placeholder="Farmer name" required style={{ marginBottom: 10 }} />
            <input className="input" name="email" type="email" placeholder="Email" required style={{ marginBottom: 10 }} />
            <input className="input" name="password" type="password" placeholder="Password" required style={{ marginBottom: 10 }} />
            <button className="btn-primary" type="submit">Create login</button>
          </form>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>3. Create a farm</h3>
          <form action={createFarm}>
            <select className="input" name="farmer_id" required style={{ marginBottom: 10 }}>
              <option value="">Select farmer…</option>
              {farmers.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
              ))}
            </select>
            <input className="input" name="name" placeholder="Farm name" required style={{ marginBottom: 10 }} />
            <input className="input" name="address" placeholder="Address (optional)" style={{ marginBottom: 10 }} />
            <button className="btn-primary" type="submit">Create farm</button>
          </form>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>4. Add a paddock</h3>
          <p style={hintStyle}>Links a registered station to a farm.</p>
          <PaddockForm stations={stations} farms={farms} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>5. Replace a station</h3>
          <p style={hintStyle}>Stolen or broken — moves the paddock to a new device.</p>
          <ReplaceStationForm assigned={assigned} unassigned={unassigned} />
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={titleStyle}>6. Reset a farmer's password</h3>
          <p style={hintStyle}>Sets a new password directly — shown once after saving.</p>
          <ResetPasswordForm farmers={farmers} />
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
