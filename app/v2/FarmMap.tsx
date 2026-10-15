'use client'
import { useEffect, useRef } from 'react'

export type MapShape = { polyId: string; stationId: string; label: string; sublabel: string | null; color: string; geojson: any }
export type Basemap = 'satellite' | 'map'

declare global { interface Window { L?: any } }

const TILES: Record<Basemap, string> = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  map: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
}

const LABEL_CSS = `
.v2-label{background:transparent;border:0;box-shadow:none;padding:0;color:#fff;text-align:center;
  text-shadow:0 1px 3px rgba(0,0,0,.85);font:600 13px/1.3 system-ui,-apple-system,sans-serif;white-space:nowrap}
.v2-label:before{display:none}
.v2-label-sub{font-weight:500;font-size:11px;display:flex;align-items:center;gap:5px;justify-content:center}
.v2-label-sub span{width:9px;height:9px;border-radius:3px;border:1.5px solid #fff;display:inline-block}
`

function loadLeaflet(): Promise<any> {
  if (!document.getElementById('v2-label-css')) {
    const st = document.createElement('style')
    st.id = 'v2-label-css'
    st.textContent = LABEL_CSS
    document.head.appendChild(st)
  }
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

const esc = (t: string) => t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const styleFor = (color: string, selected: boolean) =>
  selected
    ? { color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 0.35 }
    : { color, weight: 2, fillColor: color, fillOpacity: 0.2 }

export default function FarmMap({ shapes, selectedId, onSelect, basemap, locateTick }: {
  shapes: MapShape[]
  selectedId: string | null
  onSelect: (stationId: string) => void
  basemap: Basemap
  locateTick: number
}) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const tileRef = useRef<any>(null)
  const meRef = useRef<any>(null)
  const layersRef = useRef<Record<string, { layer: any; color: string }[]>>({})
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const basemapRef = useRef(basemap)
  basemapRef.current = basemap
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  const applySelection = (zoom: boolean) => {
    const map = mapRef.current
    if (!map) return
    const sel = selectedRef.current
    for (const [sid, items] of Object.entries(layersRef.current)) {
      for (const it of items) it.layer.setStyle(styleFor(it.color, sid === sel))
    }
    const items = sel ? layersRef.current[sel] : null
    if (zoom && items?.length) {
      const b = items[0].layer.getBounds()
      items.forEach((it) => b.extend(it.layer.getBounds()))
      map.fitBounds(b, { paddingTopLeft: [40, 90], paddingBottomRight: [40, 40], maxZoom: 16 })
    }
  }

  useEffect(() => {
    let cancelled = false
    loadLeaflet().then((L) => {
      if (cancelled || !divRef.current || mapRef.current) return
      const map = L.map(divRef.current, { zoomControl: false })
      mapRef.current = map
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      tileRef.current = L.tileLayer(TILES[basemapRef.current], { attribution: 'Tiles © Esri', maxZoom: 19 }).addTo(map)

      const group = L.featureGroup().addTo(map)
      for (const s of shapes) {
        try {
          const layer = L.geoJSON(s.geojson, { style: styleFor(s.color, false) })
          layer.on('click', () => onSelectRef.current(s.stationId))
          const html = '<div>' + esc(s.label) + '</div>' +
            (s.sublabel ? '<div class="v2-label-sub"><span style="background:' + s.color + '"></span>' + esc(s.sublabel) + '</div>' : '')
          layer.bindTooltip(html, { permanent: true, direction: 'center', className: 'v2-label' })
          layer.addTo(group)
          ;(layersRef.current[s.stationId] ||= []).push({ layer, color: s.color })
        } catch (e) {
          console.warn('Could not draw polygon', s.polyId, e)
        }
      }
      if (group.getLayers().length) map.fitBounds(group.getBounds(), { paddingTopLeft: [40, 90], paddingBottomRight: [40, 40] })
      else map.setView([-36.5, 144.5], 7)
      applySelection(false)
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      tileRef.current = null
      meRef.current = null
      layersRef.current = {}
    }
  }, [shapes])

  useEffect(() => { applySelection(true) }, [selectedId])

  useEffect(() => { tileRef.current?.setUrl(TILES[basemap]) }, [basemap])

  useEffect(() => {
    const map = mapRef.current
    const L = window.L
    if (!locateTick || !map || !L) return
    map.once('locationfound', (e: any) => {
      meRef.current?.remove()
      meRef.current = L.circleMarker(e.latlng, { radius: 7, color: '#fff', weight: 2, fillColor: '#2f80ed', fillOpacity: 1 }).addTo(map)
    })
    map.once('locationerror', () => alert('Could not get your location'))
    map.locate({ setView: true, maxZoom: 16 })
  }, [locateTick])

  return <div ref={divRef} style={{ position: 'absolute', inset: 0 }} />
}
