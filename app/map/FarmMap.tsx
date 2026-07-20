'use client'

import { useEffect, useRef, useState } from 'react'

type StationData = {
  id: string
  name: string
  latitude: number | null
  longitude: number | null
  cropName: string | null
  variety: string | null
  hectares: number | null
  plantedDate: string | null
  rainToday: number | null
  tempC: number | null
  gddPct: number
  daysToHarvest: number | null
  growingSeasonRain: number | null
  totalAvailableN: number | null
  pStatus: string | null
  polygons: { id: string; name: string | null; geojson: any }[]
}

type Layer = 'crop' | 'rain' | 'temp' | 'gdd' | 'harvest' | 'season_rain' | 'nitrogen' | 'phosphorus'

const LAYER_LABELS: Record<Layer, string> = {
  crop: 'Crop type',
  rain: 'Rain today',
  temp: 'Temperature',
  gdd: 'GDD progress',
  harvest: 'Days to harvest',
  season_rain: 'Season rainfall',
  nitrogen: 'N available',
  phosphorus: 'P status',
}

const CROP_COLOURS: Record<string, string> = {
  Wheat: '#f2762a',
  Barley: '#9b7dd4',
  Canola: '#facc15',
  Oats: '#4ade80',
  Lentils: '#60a5fa',
  Faba: '#f472b6',
}

function rainColor(mm: number | null): string {
  if (mm == null) return '#888'
  if (mm === 0) return '#f2762a'
  if (mm < 5) return '#facc15'
  if (mm < 15) return '#4ade80'
  return '#60a5fa'
}

function tempColor(t: number | null): string {
  if (t == null) return '#888'
  if (t < 5) return '#60a5fa'
  if (t < 12) return '#4ade80'
  if (t < 20) return '#facc15'
  return '#f2762a'
}

function gddColor(pct: number): string {
  if (pct < 30) return '#60a5fa'
  if (pct < 60) return '#4ade80'
  if (pct < 85) return '#facc15'
  if (pct < 95) return '#f97316'
  return '#ef4444'
}

function seasonRainColor(mm: number | null): string {
  if (mm == null) return '#888'
  if (mm < 50) return '#f2762a'
  if (mm < 100) return '#facc15'
  if (mm < 200) return '#4ade80'
  return '#60a5fa'
}

function nitrogenColor(kg: number | null): string {
  if (kg == null) return '#888'
  if (kg < 40) return '#ef4444'
  if (kg < 80) return '#f97316'
  if (kg < 120) return '#facc15'
  return '#4ade80'
}

function phosphorusColor(status: string | null): string {
  if (status == null) return '#888'
  if (status === 'deficient') return '#ef4444'
  if (status === 'marginal') return '#f97316'
  if (status === 'adequate') return '#4ade80'
  return '#60a5fa' // high
}

function harvestColor(days: number | null): string {
  if (days == null) return '#888'
  if (days < 14) return '#ef4444'
  if (days < 30) return '#f97316'
  if (days < 60) return '#facc15'
  return '#4ade80'
}

function getColor(s: StationData, layer: Layer): string {
  switch (layer) {
    case 'crop': return CROP_COLOURS[s.cropName ?? ''] ?? '#888'
    case 'rain': return rainColor(s.rainToday)
    case 'temp': return tempColor(s.tempC)
    case 'gdd': return gddColor(s.gddPct)
    case 'harvest': return harvestColor(s.daysToHarvest)
    case 'season_rain': return seasonRainColor(s.growingSeasonRain ?? null)
    case 'nitrogen': return nitrogenColor(s.totalAvailableN ?? null)
    case 'phosphorus': return phosphorusColor(s.pStatus ?? null)
  }
}

function getLegendItems(layer: Layer, stations: StationData[]) {
  switch (layer) {
    case 'crop':
      const crops = [...new Set(stations.map(s => s.cropName).filter(Boolean))]
      return crops.map(c => ({ color: CROP_COLOURS[c!] ?? '#888', label: c! }))
    case 'rain':
      return [
        { color: '#f2762a', label: '0 mm' },
        { color: '#facc15', label: '1–5 mm' },
        { color: '#4ade80', label: '5–15 mm' },
        { color: '#60a5fa', label: '15+ mm' },
      ]
    case 'temp':
      return [
        { color: '#60a5fa', label: 'Below 5°C' },
        { color: '#4ade80', label: '5–12°C' },
        { color: '#facc15', label: '12–20°C' },
        { color: '#f2762a', label: '20°C+' },
      ]
    case 'gdd':
      return [
        { color: '#60a5fa', label: '0–30%' },
        { color: '#4ade80', label: '30–60%' },
        { color: '#facc15', label: '60–85%' },
        { color: '#f97316', label: '85–95%' },
        { color: '#ef4444', label: '95%+ (near harvest)' },
      ]
    case 'harvest':
      return [
        { color: '#ef4444', label: 'Under 2 weeks' },
        { color: '#f97316', label: '2–4 weeks' },
        { color: '#facc15', label: '1–2 months' },
        { color: '#4ade80', label: '2+ months' },
      ]
    case 'season_rain':
      return [
        { color: '#f2762a', label: 'Under 50 mm' },
        { color: '#facc15', label: '50–100 mm' },
        { color: '#4ade80', label: '100–200 mm' },
        { color: '#60a5fa', label: '200+ mm' },
      ]
    case 'nitrogen':
      return [
        { color: '#ef4444', label: 'Under 40 kg N/ha' },
        { color: '#f97316', label: '40–80 kg N/ha' },
        { color: '#facc15', label: '80–120 kg N/ha' },
        { color: '#4ade80', label: '120+ kg N/ha' },
      ]
    case 'phosphorus':
      return [
        { color: '#ef4444', label: 'Deficient' },
        { color: '#f97316', label: 'Marginal' },
        { color: '#4ade80', label: 'Adequate' },
        { color: '#60a5fa', label: 'High' },
      ]
  }
}

export default function FarmMap({ stations }: { stations: StationData[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const layersRef = useRef<any[]>([])
  const [activeLayer, setActiveLayer] = useState<Layer>('crop')
  const [selectedStation, setSelectedStation] = useState<StationData | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    import('leaflet').then(L => {
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      // Centre on first station with coords
      const first = stations.find(s => s.latitude && s.longitude)
      const center: [number, number] = first ? [first.latitude!, first.longitude!] : [-35.3, 143.5]

      const map = L.map(mapRef.current!, { preferCanvas: false }).setView(center, 13)
      mapInstance.current = map

      const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19,
      })
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      })
      esri.addTo(map)
      L.control.layers({ 'Satellite': esri, 'Street': osm }, {}, { position: 'topright', collapsed: true }).addTo(map)

      // Add station markers and polygons
      const bounds: [number, number][] = []

      stations.forEach(s => {
        const color = getColor(s, 'crop')

        // Polygon
        if (s.polygons.length > 0) {
          s.polygons.forEach(p => {
            try {
              const geojson = typeof p.geojson === 'string' ? JSON.parse(p.geojson) : p.geojson
              const layer = L.geoJSON(geojson, {
                style: { color, fillColor: color, fillOpacity: 0.35, weight: 2 },
              })
              layer.on('click', () => setSelectedStation(s))
              layer.addTo(map)
              layersRef.current.push({ layer, station: s })
              const b = layer.getBounds()
              bounds.push([b.getSouth(), b.getWest()])
              bounds.push([b.getNorth(), b.getEast()])
            } catch {}
          })
        }

        // Marker
        if (s.latitude && s.longitude) {
          const marker = L.circleMarker([s.latitude, s.longitude], {
            radius: 8, color, fillColor: color, fillOpacity: 0.9, weight: 2,
          })
          marker.on('click', () => setSelectedStation(s))
          marker.bindTooltip(s.name, { permanent: false })
          marker.addTo(map)
          layersRef.current.push({ layer: marker, station: s, isMarker: true })
          bounds.push([s.latitude, s.longitude])
        }
      })

      if (bounds.length > 0) map.fitBounds(bounds as any, { padding: [40, 40] })
    })
  }, [])

  // Update colours when layer changes
  useEffect(() => {
    layersRef.current.forEach(({ layer, station, isMarker }) => {
      const color = getColor(station, activeLayer)
      if (isMarker) {
        layer.setStyle({ color, fillColor: color })
      } else {
        layer.setStyle({ color, fillColor: color, fillOpacity: 0.35 })
      }
    })
  }, [activeLayer])

  const legendItems = getLegendItems(activeLayer, stations)

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 53px)' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Layer selector */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, minWidth: 160 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: 600 }}>Show by</div>
        {(Object.keys(LAYER_LABELS) as Layer[]).map(l => (
          <button key={l} onClick={() => setActiveLayer(l)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
            background: activeLayer === l ? 'var(--bg-pro)' : 'none',
            border: 'none', borderRadius: 6, fontSize: 13,
            color: activeLayer === l ? 'var(--text-pro)' : 'var(--text)',
            cursor: 'pointer', marginBottom: 2, fontWeight: activeLayer === l ? 600 : 400,
          }}>
            {LAYER_LABELS[l]}
          </button>
        ))}

        {/* Legend */}
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {legendItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 11, color: 'var(--text-muted)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color, flexShrink: 0 }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Station info panel */}
      {selectedStation && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, minWidth: 280, maxWidth: 360 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedStation.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {selectedStation.cropName ? `${selectedStation.cropName}${selectedStation.variety ? ` (${selectedStation.variety})` : ''}` : 'No crop set'}
                {selectedStation.hectares ? ` · ${selectedStation.hectares} ha` : ''}
              </div>
            </div>
            <button onClick={() => setSelectedStation(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedStation.rainToday != null ? `${selectedStation.rainToday} mm` : '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Rain today</div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedStation.tempC != null ? `${selectedStation.tempC}°C` : '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Temperature</div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedStation.gddPct}%</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>GDD progress</div>
            </div>
            <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedStation.daysToHarvest != null ? `${selectedStation.daysToHarvest}d` : '—'}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>To harvest</div>
            </div>
          </div>
          <a href={`/station/${selectedStation.id}`} style={{ display: 'block', textAlign: 'center', background: 'var(--orange)', color: '#fff', borderRadius: 8, padding: '8px 0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Open paddock →
          </a>
        </div>
      )}
    </div>
  )
}
