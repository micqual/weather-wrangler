// Reference Evapotranspiration (ETo) using FAO-56 Penman-Monteith
// Allen et al. (1998) FAO Irrigation and Drainage Paper 56
//
// Solar radiation estimated from lux — approximate (±15%)
// Results are indicative, not precise

export type ETResult = {
  etoMmDay: number
  dataQuality: 'good' | 'estimated' | 'low'
  notes: string[]
}

function satVapourPressure(tempC: number): number {
  return 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3))
}

function slopeVapourPressure(tempC: number): number {
  return 4098 * satVapourPressure(tempC) / Math.pow(tempC + 237.3, 2)
}

function extraterrestrialRadiation(dayOfYear: number, latitudeDeg: number | null): number {
  const lat = (latitudeDeg ?? -35) * Math.PI / 180
  const dr = 1 + 0.033 * Math.cos(2 * Math.PI * dayOfYear / 365)
  const dec = 0.409 * Math.sin(2 * Math.PI * dayOfYear / 365 - 1.39)
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(lat) * Math.tan(dec))))
  return 24 * 60 / Math.PI * 0.0820 * dr *
    (ws * Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.sin(ws))
}

export function calcETo(
  avgTempC: number,
  maxTempC: number,
  minTempC: number,
  humidity: number,
  windSpeedMs: number,
  avgLux: number | null,
  elevationM: number | null,
  dayOfYear: number,
  latitudeDeg: number | null
): ETResult {
  const notes: string[] = []

  const elev = elevationM ?? 100
  const P = 101.3 * Math.pow((293 - 0.0065 * elev) / 293, 5.26)
  const gamma = 0.000665 * P
  const u2 = windSpeedMs

  const esTmax = satVapourPressure(maxTempC)
  const esTmin = satVapourPressure(minTempC)
  const es = (esTmax + esTmin) / 2
  const ea = (humidity / 100) * es
  const delta = slopeVapourPressure(avgTempC)

  // Always calculate Ra — needed for longwave radiation formula
  const Ra = extraterrestrialRadiation(dayOfYear, latitudeDeg)

  let Rs: number
  let dataQuality: 'good' | 'estimated' | 'low' = 'estimated'

  if (avgLux != null && avgLux > 0) {
    const wPerM2 = avgLux / 120
    Rs = wPerM2 * 0.0864
    notes.push('Solar radiation estimated from light sensor (±15%)')
  } else {
    Rs = 0.16 * Ra * Math.sqrt(Math.max(0, maxTempC - minTempC))
    notes.push('No light data — solar radiation estimated from temperature range')
  }

  const Rns = (1 - 0.23) * Rs

  const sigma = 4.903e-9
  const Tmax_K = maxTempC + 273.16
  const Tmin_K = minTempC + 273.16
  const RsRa = Ra > 0 ? Rs / (0.75 * Ra) : 1
  const Rnl = sigma * (Math.pow(Tmax_K, 4) + Math.pow(Tmin_K, 4)) / 2 *
    (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) *
    (1.35 * Math.min(1.5, RsRa) - 0.35)

  const Rn = Rns - Math.max(0, Rnl)

  const numerator = 0.408 * delta * (Rn - 0) + gamma * (900 / (avgTempC + 273)) * u2 * (es - ea)
  const denominator = delta + gamma * (1 + 0.34 * u2)
  const ETo = Math.max(0, numerator / denominator)

  if (ETo < 0.2 || ETo > 12) dataQuality = 'low'

  return {
    etoMmDay: Math.round(ETo * 10) / 10,
    dataQuality,
    notes,
  }
}

export async function getDailyET(stationId: string, elevationM: number | null, latitudeDeg: number | null, prisma: any): Promise<ETResult | null> {
  const now = new Date()
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
  const melbDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
  const [year, month, day] = melbDateStr.split('-').map(Number)
  const midnightUTC = new Date(Date.UTC(year, month - 1, day - 1, 14, 0, 0))

  const readings = await prisma.weather_readings.findMany({
    where: { station_id: stationId, created_at: { gte: midnightUTC }, temperature_c: { not: null } },
    select: { temperature_c: true, humidity: true, wind_avg_ms: true, light_lux: true },
  })

  if (readings.length < 4) return null

  const temps = readings.map((r: any) => r.temperature_c as number)
  const avgTemp = temps.reduce((a: number, b: number) => a + b, 0) / temps.length
  const maxTemp = Math.max(...temps)
  const minTemp = Math.min(...temps)
  const humids = readings.filter((r: any) => r.humidity != null).map((r: any) => r.humidity as number)
  const avgHumidity = humids.length > 0 ? humids.reduce((a: number, b: number) => a + b, 0) / humids.length : 50
  const winds = readings.filter((r: any) => r.wind_avg_ms != null).map((r: any) => r.wind_avg_ms as number)
  const avgWind = winds.length > 0 ? winds.reduce((a: number, b: number) => a + b, 0) / winds.length : 1
  const luxes = readings.filter((r: any) => r.light_lux != null && r.light_lux > 0).map((r: any) => r.light_lux as number)
  const avgLux = luxes.length > 0 ? luxes.reduce((a: number, b: number) => a + b, 0) / luxes.length : null

  return calcETo(avgTemp, maxTemp, minTemp, avgHumidity, avgWind, avgLux, elevationM, dayOfYear, latitudeDeg)
}

export async function get7DayET(stationId: string, elevationM: number | null, latitudeDeg: number | null, prisma: any): Promise<{ date: string; etoMmDay: number }[]> {
  const results: { date: string; etoMmDay: number }[] = []

  for (let d = 6; d >= 0; d--) {
    const date = new Date()
    date.setDate(date.getDate() - d)
    const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })
    const [year, month, day] = dateStr.split('-').map(Number)
    const startUTC = new Date(Date.UTC(year, month - 1, day - 1, 14, 0, 0))
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)

    const readings = await prisma.weather_readings.findMany({
      where: { station_id: stationId, created_at: { gte: startUTC, lt: endUTC }, temperature_c: { not: null } },
      select: { temperature_c: true, humidity: true, wind_avg_ms: true, light_lux: true },
    })

    if (readings.length < 4) continue

    const temps = readings.map((r: any) => r.temperature_c as number)
    const avgTemp = temps.reduce((a: number, b: number) => a + b, 0) / temps.length
    const maxTemp = Math.max(...temps)
    const minTemp = Math.min(...temps)
    const humids = readings.filter((r: any) => r.humidity != null).map((r: any) => r.humidity as number)
    const avgHumidity = humids.length > 0 ? humids.reduce((a: number, b: number) => a + b, 0) / humids.length : 50
    const winds = readings.filter((r: any) => r.wind_avg_ms != null).map((r: any) => r.wind_avg_ms as number)
    const avgWind = winds.length > 0 ? winds.reduce((a: number, b: number) => a + b, 0) / winds.length : 1
    const luxes = readings.filter((r: any) => r.light_lux != null && r.light_lux > 0).map((r: any) => r.light_lux as number)
    const avgLux = luxes.length > 0 ? luxes.reduce((a: number, b: number) => a + b, 0) / luxes.length : null

    const et = calcETo(avgTemp, maxTemp, minTemp, avgHumidity, avgWind, avgLux, elevationM, dayOfYear, latitudeDeg)
    results.push({ date: dateStr, etoMmDay: et.etoMmDay })
  }

  return results
}
