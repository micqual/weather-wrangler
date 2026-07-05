// Parse KML, GeoJSON, and basic Shapefile-converted-to-GeoJSON
// Returns an array of GeoJSON Feature objects with Polygon/MultiPolygon geometry

export type ParsedPolygon = {
  name: string
  geojson: object
}

export function parseGeoJSON(text: string): ParsedPolygon[] {
  const data = JSON.parse(text)
  const features = data.type === 'FeatureCollection' ? data.features
    : data.type === 'Feature' ? [data]
    : data.type === 'Polygon' || data.type === 'MultiPolygon' ? [{ type: 'Feature', geometry: data, properties: {} }]
    : []

  return features
    .filter((f: any) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
    .map((f: any, i: number) => ({
      name: f.properties?.name ?? f.properties?.Name ?? f.properties?.label ?? `Area ${i + 1}`,
      geojson: f.geometry,
    }))
}

export function parseKML(text: string): ParsedPolygon[] {
  const results: ParsedPolygon[] = []

  // Extract Placemark elements
  const placemarkRegex = /<Placemark[^>]*>([\s\S]*?)<\/Placemark>/gi
  let match

  while ((match = placemarkRegex.exec(text)) !== null) {
    const inner = match[1]

    // Get name
    const nameMatch = inner.match(/<name[^>]*>([\s\S]*?)<\/name>/i)
    const name = nameMatch ? nameMatch[1].trim().replace(/<!\[CDATA\[|\]\]>/g, '') : 'Area'

    // Get coordinates from Polygon
    const coordsMatch = inner.match(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/i)
    if (!coordsMatch) continue

    const coordStr = coordsMatch[1].trim()
    const coords = coordStr.split(/\s+/).map(c => {
      const parts = c.split(',')
      return [parseFloat(parts[0]), parseFloat(parts[1])]
    }).filter(c => !isNaN(c[0]) && !isNaN(c[1]))

    if (coords.length < 3) continue

    // Close ring if needed
    if (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1]) {
      coords.push(coords[0])
    }

    results.push({
      name,
      geojson: { type: 'Polygon', coordinates: [coords] },
    })
  }

  return results
}

export function parseFile(filename: string, text: string): ParsedPolygon[] {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'kml') return parseKML(text)
  if (ext === 'geojson' || ext === 'json') return parseGeoJSON(text)
  throw new Error(`Unsupported file type: .${ext}. Please use KML or GeoJSON.`)
}
