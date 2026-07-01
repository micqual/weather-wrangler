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
