export function degreesToCompass(deg: number | null): string {
  if (deg == null) return '—'
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const index = Math.round(deg / 22.5) % 16
  return directions[index]
}

export function windArrow(deg: number | null): string {
  if (deg == null) return ''
  // Arrow points IN the direction the wind is coming FROM
  const arrows = ['↓','↓','↙','↙','←','←','↖','↖','↑','↑','↗','↗','→','→','↘','↘']
  const index = Math.round(deg / 22.5) % 16
  return arrows[index]
}

export function rainVariance(rainMm: number, avgRateMMH: number | null): { pct: number; label: string } {
  if (rainMm === 0) return { pct: 0, label: '' }
  if (avgRateMMH == null) return { pct: 20, label: '±20%' }
  if (avgRateMMH < 5) return { pct: 20, label: '±20%' }
  if (avgRateMMH <= 50) return { pct: 10, label: '±10%' }
  return { pct: 20, label: '±20%' }
}
