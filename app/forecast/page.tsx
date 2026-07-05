import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { fetchBOMForecast, fetchBOMYesterday, weatherCodeLabel } from '@/lib/bom'
import { findNearestStation } from '@/lib/bomStations'

export const dynamic = 'force-dynamic'

function windDir(deg: number | null): string {
  if (deg == null) return '—'
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

export default async function ForecastPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const stations = await prisma.stations.findMany({
    where: {
      farmer_id: (session.user as any).id,
      latitude: { not: null },
      longitude: { not: null },
    },
    orderBy: { created_at: 'asc' },
  })

  if (stations.length === 0) {
    return (
      <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← My Paddocks</Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 8px' }}>
          <span style={{ color: 'var(--orange)' }}>Forecast</span>
        </h1>
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No stations with GPS coordinates. Add lat/long in Admin → Edit a station.
        </div>
      </div>
    )
  }

  // Use first station's location — could let user pick later
  const station = stations[0]
  const lat = station.latitude as number
  const lng = station.longitude as number

  const nearestStation = findNearestStation(lat, lng)

  const [forecast, yesterday, locationInfo] = await Promise.all([
    fetchBOMForecast(lat, lng),
    fetchBOMYesterday(lat, lng),
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m&timezone=Australia%2FMelbourne`)
      .then(r => r.json())
      .then(d => ({ latitude: d.latitude, longitude: d.longitude, elevation: d.elevation }))
      .catch(() => null),
  ])

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
      <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← My Paddocks</Link>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '12px 0 24px' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
            <span style={{ color: 'var(--orange)' }}>7-Day</span> Forecast
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '4px 0 0' }}>
            {station.paddock_name ?? station.id} · Open-Meteo / BOM ACCESS-G model
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '2px 0 0' }}>
            Nearest BOM station: <span style={{ color: 'var(--orange)' }}>{nearestStation.name}</span>
            {' '}({nearestStation.distanceKm} km away) · Open-Meteo grid for paddock coordinates
          </p>
        </div>
        {stations.length > 1 && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {station.paddock_name ?? station.id}
          </div>
        )}
      </div>

      {/* Yesterday comparison */}
      {yesterday && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Yesterday — BOM comparison
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <Metric label="Max temp" value={yesterday.tempMax != null ? `${yesterday.tempMax.toFixed(1)}°C` : '—'} />
            <Metric label="Min temp" value={yesterday.tempMin != null ? `${yesterday.tempMin.toFixed(1)}°C` : '—'} />
            <Metric label="Rainfall" value={yesterday.precipitation != null ? `${yesterday.precipitation.toFixed(1)} mm` : '—'} />
            <Metric label="ET₀" value={yesterday.et0 != null ? `${yesterday.et0.toFixed(1)} mm` : '—'} />
            <Metric label="Max wind" value={yesterday.windSpeedMax != null ? `${yesterday.windSpeedMax.toFixed(0)} km/h ${windDir(yesterday.windDirDominant)}` : '—'} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 0', fontStyle: 'italic' }}>
            ERA5 reanalysis data — typically available with a 1–2 day lag.
          </p>
        </div>
      )}

      {/* 7-day forecast */}
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          7-Day Forecast
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Day', 'Conditions', 'Max', 'Min', 'Rain', 'Rain %', 'ET₀', 'Wind'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {forecast.map((day, i) => {
                const date = new Date(day.date)
                const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : days[date.getDay()]
                const dateStr = date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
                const hasRain = (day.precipitation ?? 0) > 0
                const highRainProb = (day.precipitationProbability ?? 0) >= 50

                return (
                  <tr key={day.date} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '10px 10px' }}>
                      <div style={{ fontWeight: 600 }}>{dayName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dateStr}</div>
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{weatherCodeLabel(day.weatherCode)}</td>
                    <td style={{ padding: '10px 10px', color: '#f97316', fontWeight: 500 }}>{day.tempMax != null ? `${day.tempMax.toFixed(0)}°` : '—'}</td>
                    <td style={{ padding: '10px 10px', color: '#60a5fa' }}>{day.tempMin != null ? `${day.tempMin.toFixed(0)}°` : '—'}</td>
                    <td style={{ padding: '10px 10px', color: hasRain ? '#60a5fa' : 'var(--text-muted)', fontWeight: hasRain ? 600 : 400 }}>
                      {day.precipitation != null ? `${day.precipitation.toFixed(1)} mm` : '—'}
                    </td>
                    <td style={{ padding: '10px 10px', color: highRainProb ? '#60a5fa' : 'var(--text-muted)' }}>
                      {day.precipitationProbability != null ? `${day.precipitationProbability}%` : '—'}
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--purple)' }}>
                      {day.et0 != null ? `${day.et0.toFixed(1)} mm` : '—'}
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                      {day.windSpeedMax != null ? `${day.windSpeedMax.toFixed(0)} km/h` : '—'}
                      {day.windDirDominant != null ? ` ${windDir(day.windDirDominant)}` : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '12px 0 0', fontStyle: 'italic' }}>
          Forecast from Open-Meteo using BOM ACCESS-G model · Updated every 15 minutes · Not for safety-critical decisions
        </p>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
    </div>
  )
}
