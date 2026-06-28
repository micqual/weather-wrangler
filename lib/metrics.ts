export const METRICS = {
  temp: { label: '🌡️ Temperature (°C)', color: 'var(--orange)', field: 'temperature_c' as const, fmt: (v: number) => `${v.toFixed(0)}°`, transform: (v: number) => v },
  humidity: { label: '💧 Humidity (%)', color: 'var(--purple)', field: 'humidity' as const, fmt: (v: number) => `${v.toFixed(0)}%`, transform: (v: number) => v },
  wind: { label: '💨 Wind (km/h)', color: 'var(--orange-light)', field: 'wind_avg_ms' as const, fmt: (v: number) => v.toFixed(0), transform: (v: number) => v * 3.6 },
  rain: { label: '🌧️ Rain (mm)', color: 'var(--purple-deep)', field: 'rain_mm' as const, fmt: (v: number) => v.toFixed(1), transform: (v: number) => v },
} as const

export type MetricKey = keyof typeof METRICS
