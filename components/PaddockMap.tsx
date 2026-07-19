'use client'

import { useEffect, useRef } from 'react'

export type PolygonLayer = {
  id: string
  name: string
  geojson: any
  zoneId: string | null
  zoneName: string | null
}

export default function PaddockMap({
  polygons,
  stationLat,
  stationLng,
}: {
  polygons: PolygonLayer[]
  stationLat: number | null
  stationLng: number | null
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (!mapRef.current || initializedRef.current) return
    initializedRef.current = true

    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      // Default center — use station location or Australia centre
      const defaultCenter: [number, number] = stationLat && stationLng
        ? [stationLat, stationLng]
        : [-35.0, 142.0]

      const map = L.map(mapRef.current!, { preferCanvas: false }).setView(defaultCenter, 14)

      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      })

      const esri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri, Maxar, Earthstar Geographics',
        maxZoom: 19,
      })

      const esriLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: '',
        maxZoom: 19,
        opacity: 0.8,
      })

      // Default to satellite
      esri.addTo(map)
      esriLabels.addTo(map)

      L.control.layers(
        { 'Satellite': esri, 'Street map': osm },
        { 'Labels': esriLabels },
        { position: 'topright', collapsed: false }
      ).addTo(map)

      // Zone colours
      const ZONE_COLORS = ['#f2762a', '#b182ff', '#4ade80', '#60a5fa', '#facc15', '#f97316', '#a78bfa']
      const zoneColorMap = new Map<string, string>()
      let colorIdx = 0

      const allLayers: any[] = []

      polygons.forEach(p => {
        let color = '#f2762a' // default orange for paddock-level
        if (p.zoneId) {
          if (!zoneColorMap.has(p.zoneId)) {
            zoneColorMap.set(p.zoneId, ZONE_COLORS[colorIdx % ZONE_COLORS.length])
            colorIdx++
          }
          color = zoneColorMap.get(p.zoneId)!
        }

        const layer = L.geoJSON(p.geojson, {
          style: {
            color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.15,
          },
        })
          .bindPopup(`<strong>${p.name}</strong>${p.zoneName ? `<br>${p.zoneName}` : ''}`)
          .addTo(map)

        allLayers.push(layer)
      })

      // Station marker
      if (stationLat && stationLng) {
        L.marker([stationLat, stationLng])
          .bindPopup('📡 Station')
          .addTo(map)
      }

      // Fit to all polygons
      if (allLayers.length > 0) {
        const group = L.featureGroup(allLayers)
        map.fitBounds(group.getBounds(), { padding: [20, 20] })
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
      <div ref={mapRef} style={{ width: '100%', height: 360, borderRadius: 10, overflow: 'hidden' }} />
    </>
  )
}
