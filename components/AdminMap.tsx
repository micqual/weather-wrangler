'use client'

import { useEffect, useRef } from 'react'

export type StationMarker = {
  id: string
  paddockName: string | null
  latitude: number
  longitude: number
  alerts: string[]
  alertLevel: 'ok' | 'warn' | 'critical'
}

export default function AdminMap({ stations }: { stations: StationMarker[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current || initializedRef.current) return
    initializedRef.current = true

    import('leaflet').then(L => {
      // If container already has a map, remove it first
      if ((mapRef.current as any)?._leaflet_id) {
        const existingMap = (mapRef.current as any)._leaflet_map
        if (existingMap) existingMap.remove()
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, { preferCanvas: true }).setView(
        stations.length > 0 ? [stations[0].latitude, stations[0].longitude] : [-35.0, 142.0],
        12
      )

      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      })

      const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      })

      esri.addTo(map)

      L.control.layers(
        { 'Satellite': esri, 'Street map': osm },
        {},
        { position: 'topright', collapsed: false }
      ).addTo(map)

      stations.forEach(s => {
        const color = s.alertLevel === 'critical' ? '#ef4444'
          : s.alertLevel === 'warn' ? '#facc15'
          : '#4ade80'

        const icon = L.divIcon({
          html: `<div style="width:28px;height:28px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.4)">📡</div>`,
          className: '',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        })

        const alertHtml = s.alerts.length > 0
          ? `<div style="color:#ef4444;margin-top:4px;font-size:12px">${s.alerts.join('<br>')}</div>`
          : `<div style="color:#4ade80;font-size:12px;margin-top:4px">✅ All OK</div>`

        L.marker([s.latitude, s.longitude], { icon })
          .bindPopup(L.popup({ maxWidth: 220 }).setContent(`
            <div style="font-family:sans-serif;padding:4px">
              <strong style="font-size:14px">${s.paddockName ?? s.id}</strong>
              <div style="color:#888;font-size:11px;margin-top:2px">${s.id}</div>
              ${alertHtml}
            </div>
          `))
          .addTo(map)
      })

      if (stations.length > 1) {
        map.fitBounds(
          L.latLngBounds(stations.map(s => [s.latitude, s.longitude] as [number, number])),
          { padding: [40, 40] }
        )
      }

      mapInstanceRef.current = map
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        initializedRef.current = false
      }
    }
  }, [])

  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <div ref={mapRef} style={{ width: '100%', height: 420, borderRadius: 12, overflow: 'hidden' }} />
    </>
  )
}
