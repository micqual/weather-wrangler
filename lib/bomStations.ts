// BOM weather stations relevant to the Victorian/NSW Mallee and surrounds
// Source: BOM station directory ftp://ftp.bom.gov.au/anon2/home/ncc/metadata/sitelists/stations.zip
// Subset manually selected for Mallee region coverage

export type BOMStation = {
  id: string      // BOM station number
  name: string    // Station name
  lat: number
  lng: number
  state: string
}

export const MALLEE_STATIONS: BOMStation[] = [
  { id: '076031', name: 'Swan Hill Airport', lat: -35.3758, lng: 143.5553, state: 'VIC' },
  { id: '076064', name: 'Sea Lake Post Office', lat: -35.5000, lng: 142.8500, state: 'VIC' },
  { id: '076077', name: 'Hopetoun', lat: -35.7253, lng: 142.3619, state: 'VIC' },
  { id: '076047', name: 'Ouyen', lat: -35.0706, lng: 142.3200, state: 'VIC' },
  { id: '076038', name: 'Mildura Airport', lat: -34.2358, lng: 142.0867, state: 'VIC' },
  { id: '077094', name: 'Walpeup Research', lat: -35.1167, lng: 142.0000, state: 'VIC' },
  { id: '076084', name: 'Donald', lat: -36.3667, lng: 142.9833, state: 'VIC' },
  { id: '076069', name: 'Birchip', lat: -35.9833, lng: 142.9167, state: 'VIC' },
  { id: '076014', name: 'Charlton', lat: -36.2667, lng: 143.3500, state: 'VIC' },
  { id: '076025', name: 'Kerang', lat: -35.7167, lng: 143.9167, state: 'VIC' },
  { id: '072150', name: 'Hay Airport', lat: -34.5333, lng: 144.8333, state: 'NSW' },
  { id: '049037', name: 'Horsham Airport', lat: -36.6697, lng: 142.1733, state: 'VIC' },
  { id: '076092', name: 'Rainbow', lat: -35.9000, lng: 141.9833, state: 'VIC' },
  { id: '076091', name: 'Underbool', lat: -35.1667, lng: 141.8167, state: 'VIC' },
  { id: '076060', name: 'Robinvale Airport', lat: -34.6717, lng: 142.7769, state: 'VIC' },
  { id: '076035', name: 'Murrayville', lat: -35.2667, lng: 141.1833, state: 'VIC' },
  { id: '072023', name: 'Balranald', lat: -34.6333, lng: 143.5667, state: 'NSW' },
  { id: '076055', name: 'Quambatook', lat: -35.8667, lng: 143.5167, state: 'VIC' },
  { id: '076067', name: 'Speed', lat: -35.9667, lng: 142.4000, state: 'VIC' },
  { id: '076029', name: 'Longerenong', lat: -36.6667, lng: 142.3000, state: 'VIC' },
]

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function findNearestStation(lat: number, lng: number): BOMStation & { distanceKm: number } {
  let nearest = MALLEE_STATIONS[0]
  let minDist = haversineKm(lat, lng, nearest.lat, nearest.lng)

  for (const s of MALLEE_STATIONS.slice(1)) {
    const dist = haversineKm(lat, lng, s.lat, s.lng)
    if (dist < minDist) {
      minDist = dist
      nearest = s
    }
  }

  return { ...nearest, distanceKm: Math.round(minDist) }
}
