// Open-Meteo weather data — uses ERA5 reanalysis + BOM ACCESS-G forecast for Australia
// Free, no API key required
// Historical: archive-api.open-meteo.com (ERA5, 1-2 day lag)
// Forecast: api.open-meteo.com (BOM ACCESS-G model, 7-16 days)

export type DailyBOMData = {
  date: string
  tempMax: number | null
  tempMin: number | null
  precipitation: number | null
  et0: number | null
  windSpeedMax: number | null
  windDirDominant: number | null
}

export type ForecastDay = {
  date: string
  tempMax: number | null
  tempMin: number | null
  precipitation: number | null
  precipitationProbability: number | null
  et0: number | null
  windSpeedMax: number | null
  windDirDominant: number | null
  weatherCode: number | null
}

// Fetch yesterday's actuals for station comparison
export async function fetchBOMYesterday(
  latitude: number,
  longitude: number
): Promise<DailyBOMData | null> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const dateStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })

  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    start_date: dateStr,
    end_date: dateStr,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'et0_fao_evapotranspiration',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
    ].join(','),
    timezone: 'Australia/Melbourne',
    wind_speed_unit: 'kmh',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json()
    const d = data.daily
    if (!d?.time?.[0]) return null
    return {
      date: d.time[0],
      tempMax: d.temperature_2m_max?.[0] ?? null,
      tempMin: d.temperature_2m_min?.[0] ?? null,
      precipitation: d.precipitation_sum?.[0] ?? null,
      et0: d.et0_fao_evapotranspiration?.[0] ?? null,
      windSpeedMax: d.wind_speed_10m_max?.[0] ?? null,
      windDirDominant: d.wind_direction_10m_dominant?.[0] ?? null,
    }
  } catch {
    return null
  }
}

// Fetch 7-day forecast
export async function fetchBOMForecast(
  latitude: number,
  longitude: number
): Promise<ForecastDay[]> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'et0_fao_evapotranspiration',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
      'weather_code',
    ].join(','),
    timezone: 'Australia/Melbourne',
    wind_speed_unit: 'kmh',
    forecast_days: '7',
  })

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 900 }, // 15 min cache
    })
    if (!res.ok) return []
    const data = await res.json()
    const d = data.daily
    if (!d?.time) return []

    return d.time.map((date: string, i: number) => ({
      date,
      tempMax: d.temperature_2m_max?.[i] ?? null,
      tempMin: d.temperature_2m_min?.[i] ?? null,
      precipitation: d.precipitation_sum?.[i] ?? null,
      precipitationProbability: d.precipitation_probability_max?.[i] ?? null,
      et0: d.et0_fao_evapotranspiration?.[i] ?? null,
      windSpeedMax: d.wind_speed_10m_max?.[i] ?? null,
      windDirDominant: d.wind_direction_10m_dominant?.[i] ?? null,
      weatherCode: d.weather_code?.[i] ?? null,
    }))
  } catch {
    return []
  }
}

// Fetch historical daily data for a date range (for monthly reports)
export async function fetchBOMHistorical(
  latitude: number,
  longitude: number,
  startDate: string,
  endDate: string
): Promise<DailyBOMData[]> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    start_date: startDate,
    end_date: endDate,
    daily: [
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'et0_fao_evapotranspiration',
      'wind_speed_10m_max',
      'wind_direction_10m_dominant',
    ].join(','),
    timezone: 'Australia/Melbourne',
    wind_speed_unit: 'kmh',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const d = data.daily
    if (!d?.time) return []

    return d.time.map((date: string, i: number) => ({
      date,
      tempMax: d.temperature_2m_max?.[i] ?? null,
      tempMin: d.temperature_2m_min?.[i] ?? null,
      precipitation: d.precipitation_sum?.[i] ?? null,
      et0: d.et0_fao_evapotranspiration?.[i] ?? null,
      windSpeedMax: d.wind_speed_10m_max?.[i] ?? null,
      windDirDominant: d.wind_direction_10m_dominant?.[i] ?? null,
    }))
  } catch {
    return []
  }
}

// WMO weather code to description
export function weatherCodeLabel(code: number | null): string {
  if (code == null) return '—'
  if (code === 0) return 'Clear'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 49) return 'Foggy'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  if (code <= 99) return 'Thunderstorm'
  return '—'
}
