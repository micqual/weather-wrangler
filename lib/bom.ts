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

// Fetch 30-year monthly rainfall averages using Open-Meteo archive
// Used for future month estimates in the growing season water budget
export async function fetchClimateNormals(
  latitude: number,
  longitude: number
): Promise<{ month: number; avgRainfallMm: number }[]> {
  // Pull 10 years of data (faster than 30, still statistically meaningful)
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    start_date: '2014-01-01',
    end_date: '2023-12-31',
    daily: 'precipitation_sum',
    timezone: 'Australia/Melbourne',
    wind_speed_unit: 'kmh',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
      next: { revalidate: 86400 * 30 }, // cache 30 days
    })
    if (!res.ok) return []
    const data = await res.json()
    const d = data.daily
    if (!d?.time) return []

    // Aggregate by month
    const monthTotals: Record<number, number[]> = {}
    for (let m = 1; m <= 12; m++) monthTotals[m] = []

    for (let i = 0; i < d.time.length; i++) {
      const month = parseInt(d.time[i].split('-')[1])
      const rain = d.precipitation_sum[i] ?? 0
      monthTotals[month].push(rain)
    }

    // Average monthly total (sum all daily rain per month, then average across years)
    const yearCount = 10
    return Object.entries(monthTotals).map(([m, vals]) => ({
      month: parseInt(m),
      avgRainfallMm: Math.round(vals.reduce((a, b) => a + b, 0) / yearCount),
    }))
  } catch {
    return []
  }
}

// Fetch growing season decile rainfall (10th, 30th, 50th, 80th, 100th percentile)
// for the rainfall decile yield chart
export async function fetchRainfallDeciles(
  latitude: number,
  longitude: number,
  startMonth: number, // e.g. 4 for April
  endMonth: number    // e.g. 10 for October
): Promise<{ decile: number; label: string; rainfallMm: number }[]> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
    start_date: '1994-01-01',
    end_date: '2023-12-31',
    daily: 'precipitation_sum',
    timezone: 'Australia/Melbourne',
  })

  try {
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params}`, {
      next: { revalidate: 86400 * 30 },
    })
    if (!res.ok) return []
    const data = await res.json()
    const d = data.daily
    if (!d?.time) return []

    // Sum rainfall for each growing season
    const seasonTotals: Record<number, number> = {}
    for (let i = 0; i < d.time.length; i++) {
      const [year, month] = d.time[i].split('-').map(Number)
      const rain = d.precipitation_sum[i] ?? 0
      if (month >= startMonth && month <= endMonth) {
        if (!seasonTotals[year]) seasonTotals[year] = 0
        seasonTotals[year] += rain
      }
    }

    const totals = Object.values(seasonTotals).sort((a, b) => a - b)
    const n = totals.length

    const percentile = (p: number) => totals[Math.floor(p / 100 * n)] ?? 0

    return [
      { decile: 1, label: 'Decile 1\nVery low', rainfallMm: Math.round(percentile(10)) },
      { decile: 3, label: 'Decile 2-3\nLow', rainfallMm: Math.round(percentile(25)) },
      { decile: 5, label: 'Decile 4-7\nAverage', rainfallMm: Math.round(percentile(50)) },
      { decile: 8, label: 'Decile 8-9\nHigh', rainfallMm: Math.round(percentile(75)) },
      { decile: 10, label: 'Decile 10\nVery high', rainfallMm: Math.round(percentile(95)) },
    ]
  } catch {
    return []
  }
}
