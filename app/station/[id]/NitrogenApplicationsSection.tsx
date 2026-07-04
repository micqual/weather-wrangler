import { deleteNitrogenApplication } from '@/lib/nitrogenActions'
import AddNitrogenApplicationForm from './AddNitrogenApplicationForm'
import { estimateNLosses } from '@/lib/volatilization'

type Zone = { id: string; name: string; soil_type: string | null }
type Product = { id: number; name: string; n_percent: number }
type Application = {
  id: number
  zone_id: string | null
  product: string
  rate_kg_ha: number
  n_kg_ha: number
  applied_at: Date
  method: string | null
  incorporated: boolean | null
  notes: string | null
  avgTempC?: number | null
  avgHumidity?: number | null
  daysToRain?: number | null
  totalRainMm?: number | null
  soilType?: string | null
}

function levelLabel(zoneId: string | null, zones: Zone[]) {
  if (!zoneId) return 'Whole paddock'
  return zones.find(z => z.id === zoneId)?.name ?? 'Unknown zone'
}

export default function NitrogenApplicationsSection({
  stationId,
  zones,
  products,
  applications,
  paddockSoilType,
}: {
  stationId: string
  zones: Zone[]
  products: Product[]
  applications: Application[]
  paddockSoilType: string | null
}) {
  const appsWithLosses = applications.map(a => {
    const soilType = a.zone_id
      ? zones.find(z => z.id === a.zone_id)?.soil_type ?? paddockSoilType
      : paddockSoilType

    const losses = estimateNLosses(
      a.n_kg_ha,
      a.incorporated ?? false,
      a.avgTempC ?? null,
      a.avgHumidity ?? null,
      a.daysToRain ?? null,
      a.totalRainMm ?? null,
      soilType ?? null,
      a.product
    )
    return { ...a, losses }
  })

  const totalNApplied = applications.reduce((sum, a) => sum + a.n_kg_ha, 0)
  const totalNRetained = appsWithLosses.reduce((sum, a) => sum + a.losses.retainedKgNHa, 0)
  const totalVolat = appsWithLosses.reduce((sum, a) => sum + a.losses.volatilizationKgNHa, 0)
  const totalLeach = appsWithLosses.reduce((sum, a) => sum + a.losses.leachingKgNHa, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Nitrogen Applications
        </h3>
        {applications.length > 0 && (
          <div style={{ fontSize: 12, textAlign: 'right' }}>
            <div>Applied: <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{totalNApplied.toFixed(1)} kg N/ha</span></div>
            <div style={{ color: 'var(--text-muted)' }}>
              Volatilized: {totalVolat.toFixed(1)} · Leached: {totalLeach.toFixed(1)}
            </div>
            <div>Retained: <span style={{ color: 'var(--purple)', fontWeight: 600 }}>{totalNRetained.toFixed(1)} kg N/ha</span></div>
          </div>
        )}
      </div>

      {applications.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>No applications recorded yet.</p>
      )}

      {appsWithLosses.map(a => (
        <div key={a.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>{a.product}</span>
              {' · '}
              <span style={{ color: 'var(--orange)' }}>{a.n_kg_ha.toFixed(1)} kg N/ha applied</span>
              {' · '}{levelLabel(a.zone_id, zones)}
              {' · '}{new Date(a.applied_at).toLocaleDateString('en-AU')}
              {a.method ? ` · ${a.method}` : ''}
              {a.incorporated ? ' · incorporated' : ''}
            </div>
            <form action={deleteNitrogenApplication}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="station_id" value={stationId} />
              <button type="submit" style={{ background: 'none', border: 'none', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
            </form>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 16 }}>
            <span>Volatilized: <span style={{ color: '#f97316' }}>{a.losses.volatilizationKgNHa} kg/ha ({a.losses.volatilizationPct}%)</span></span>
            <span>Leached: <span style={{ color: '#60a5fa' }}>{a.losses.leachingKgNHa} kg/ha ({a.losses.leachingPct}%)</span></span>
            <span>Retained: <span style={{ color: 'var(--purple)' }}>{a.losses.retainedKgNHa} kg/ha</span></span>
          </div>
          {a.losses.notes.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, fontStyle: 'italic' }}>
              {a.losses.notes.join(' · ')}
            </div>
          )}
          {a.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{a.notes}</div>}
        </div>
      ))}

      <div style={{ borderTop: applications.length > 0 ? '1px solid var(--border)' : 'none', paddingTop: applications.length > 0 ? 14 : 0, marginTop: applications.length > 0 ? 14 : 0 }}>
        <AddNitrogenApplicationForm stationId={stationId} zones={zones} products={products} />
      </div>
    </div>
  )
}
