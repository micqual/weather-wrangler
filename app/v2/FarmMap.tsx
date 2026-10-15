'use client'
import { useEffect, useRef } from 'react'

export type Poly = { id: string; stationId: string; name: string | null; geojson: any }

declare global { interface Window { L?: any } }

function loadLeaflet(): Promise<any> {
  if (window.L) return Promise.resolve(window.L)
  return new Promise((resolve, reject) => {
    if (!document.getElementById('v2-leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'v2-leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    const existing = document.getElementById('v2-leaflet-js')
    if (existing) { existing.addEventListener('load', () => resolve(window.L)); return }
    const s = document.createElement('script')
    s.id = 'v2-leaflet-js'
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    s.onload = () => resolve(window.L)
    s.onerror = reject
    document.body.appendChild(s)
  })
}

const BASE = { color: '#f2762a', weight: 2, fillOpacity: 0.15 }
const SELECTED = { color: '#ffffff', weight: 3, fillOpacity: 0.3 }

export default function FarmMap({ polygons, selectedId, onSelect }: {
  polygons: Poly[]
  selectedId: string | null
  onSelect: (stationId: string) => void
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layersRef = useRef<Record<string, any[]>>({})
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !divRef.current || mapRef.current) return
      const map = L.map(divRef.current)
      mapRef.current = map
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Imagery © Esri', maxZoom: 19,
      }).addTo(map)

      const group = L.featureGroup().addTo(map)
      for (const p of polygons) {
        try {
          const layer = L.geoJSON(p.geojson, { style: BASE })
          layer.on('click', () => onSelectRef.current(p.stationId))
          if (p.name) layer.bindTooltip(p.name, { sticky: true })
          layer.addTo(group)
          ;(layersRef.current[p.stationId] ||= []).push(layer)
        } catch (e) {
          console.warn('Could not draw polygon', p.id, e)
        }
      }
      if (group.getLayers().length) map.fitBounds(group.getBounds(), { padding: [30, 30] })
      else map.setView([-36.5, 144.5], 7)
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      layersRef.current = {}
    }
  }, [polygons])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const [sid, layers] of Object.entries(layersRef.current)) {
      for (const l of layers) l.setStyle(sid === selectedId ? SELECTED : BASE)
    }
    const sel = selectedId ? layersRef.current[selectedId] : null
    if (sel?.length) {
      const bounds = sel[0].getBounds()
      sel.forEach((l: any) => bounds.extend(l.getBounds()))
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 })
    }
  }, [selectedId])

  return <div ref={divRef} style={{ width: '100%', height: '100%' }} />
}
