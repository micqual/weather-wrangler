export type FrostRisk = 'none' | 'watch' | 'warning' | 'frost'

export type FrostResult = {
  risk: FrostRisk
  label: string
  color: string
  reason: string
  dewPoint: number | null
}

function dewPointC(tempC: number, humidity: number): number {
  const a = 17.27
  const b = 237.7
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100)
  return (b * alpha) / (a - alpha)
}

export function getFrostRisk(
  tempC: number | null,
  humidity: number | null,
  alertTemp: number | null,
  hourMelbourne: number
): FrostResult {
  const threshold = alertTemp ?? 2
  const nightTime = hourMelbourne >= 22 || hourMelbourne <= 9

  if (tempC == null) {
    return { risk: 'none', label: 'No data', color: 'var(--text-muted)', reason: 'No temperature data', dewPoint: null }
  }

  const dewPoint = humidity != null ? dewPointC(tempC, humidity) : null
  const spreadToDew = dewPoint != null ? tempC - dewPoint : null

  // Active frost
  if (tempC <= 0) {
    return { risk: 'frost', label: '❄️ Frost', color: '#60a5fa', reason: `${tempC.toFixed(1)}°C — freezing conditions`, dewPoint }
  }

  // Warning — within alert threshold and nighttime
  if (tempC <= threshold && nightTime) {
    return { risk: 'warning', label: '🌡️ Frost warning', color: '#93c5fd', reason: `${tempC.toFixed(1)}°C — at risk overnight`, dewPoint }
  }

  // Watch — approaching threshold or dew point close
  if (tempC <= threshold + 3 && nightTime) {
    return { risk: 'watch', label: '👁️ Frost watch', color: 'var(--purple)', reason: `${tempC.toFixed(1)}°C — monitor overnight`, dewPoint }
  }

  // Dew point spread < 2°C — high moisture, frost more likely if temp drops
  if (spreadToDew != null && spreadToDew < 2 && nightTime && tempC <= threshold + 6) {
    return { risk: 'watch', label: '👁️ Frost watch', color: 'var(--purple)', reason: `Dew point close (${dewPoint!.toFixed(1)}°C) — fog/frost risk if temp drops`, dewPoint }
  }

  return { risk: 'none', label: '✅ No frost risk', color: 'var(--text-muted)', reason: `${tempC.toFixed(1)}°C — safe`, dewPoint }
}
