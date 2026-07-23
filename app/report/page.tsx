import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import PrintButton from './PrintButton'
import { fetchBOMHistorical, fetchBOMForecast, fetchClimateNormals, fetchRainfallDeciles } from '@/lib/bom'
import { findNearestStation } from '@/lib/bomStations'
import { calcNBudget } from '@/lib/nBudget'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'
import { getDailyRainWithRate, getDailyAvgTempsWithGapFill, getGrowingSeasonRain } from '@/lib/gdd'
import { getDailyET } from '@/lib/et'
import { interpretSulphur, interpretChloride } from '@/lib/nutrientInterpretation'
import ReportContent from './ReportContent'

export const dynamic = 'force-dynamic'

const monthName = (m: number) => ['January','February','March','April','May','June','July','August','September','October','November','December'][m]
function toN(v: any) { return v == null ? null : parseFloat(String(v)) }

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string; station?: string }> }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const sp = await searchParams
  const now = new Date()
  const reportYear = sp.year ? parseInt(sp.year) : now.getFullYear()

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: { crop_types: true },
  })

  if (stations.length === 0) return <div style={{ padding: 40 }}>No paddocks found.</div>

  const selectedStationId = sp.station ?? stations[0].id
  const s = stations.find(st => st.id === selectedStationId) ?? stations[0]

  const settings = await prisma.settings.findUnique({ where: { id: 1 } })

  // Fetch all data for this station
  const [soilTests, phosphorusTests, nitrogenApplications, irrigationLogs, agronomistNotes] = await Promise.all([
    prisma.nitrogen_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
    prisma.phosphorus_soil_tests.findMany({ where: { station_id: s.id }, orderBy: { tested_at: 'desc' } }),
    prisma.nitrogen_applications.findMany({ where: { station_id: s.id }, orderBy: { applied_at: 'asc' } }),
    prisma.irrigation_logs.findMany({ where: { station_id: s.id }, orderBy: { irrigated_at: 'asc' } }),
    prisma.agronomist_notes.findMany({ where: { station_id: s.id, season_year: reportYear }, orderBy: { created_at: 'desc' } }),
  ])

  const appsWithWeather = await Promise.all(nitrogenApplications.map(async a => {
    const weather = await getPostApplicationWeather(s.id, new Date(a.applied_at), prisma)
    const losses = estimateNLosses(a.n_kg_ha, a.incorporated ?? false, weather.avgTempC, weather.avgHumidity, weather.daysToRain, weather.totalRainMm, s.soil_type ?? null, a.product)
    return { ...a, losses }
  }))

  const plantedDate = s.planted_date ? new Date(s.planted_date) : null
  const organicCarbonPct = toN((s as any).organic_carbon_pct)
  const nReq = toN(s.crop_types?.n_req_kg_per_tonne) ?? 40
  const nBudget = calcNBudget(soilTests, appsWithWeather, s.soil_type ?? null, s.target_yield_t_ha ?? null, nReq, organicCarbonPct)

  // N split by planted date
  const paddockApps = appsWithWeather.filter(a => !(a as any).zone_id)
  const preSowingN = paddockApps.filter(a => !plantedDate || new Date(a.applied_at) <= plantedDate).reduce((sum, a) => sum + (a.losses?.retainedKgNHa ?? a.n_kg_ha), 0)
  const postSowingN = paddockApps.filter(a => plantedDate && new Date(a.applied_at) > plantedDate).reduce((sum, a) => sum + (a.losses?.retainedKgNHa ?? a.n_kg_ha), 0)

  // Season date range
  const seasonStart = plantedDate ?? new Date(reportYear, 2, 1)
  const today = new Date()

  // Weather data
  const [bomHistorical, bomForecast, climateNormals, decileData] = await Promise.all([
    s.latitude && s.longitude ? fetchBOMHistorical(s.latitude, s.longitude, seasonStart.toLocaleDateString('en-CA'), today.toLocaleDateString('en-CA')) : Promise.resolve([]),
    s.latitude && s.longitude ? fetchBOMForecast(s.latitude, s.longitude) : Promise.resolve([]),
    s.latitude && s.longitude ? fetchClimateNormals(s.latitude, s.longitude) : Promise.resolve([]),
    s.latitude && s.longitude && plantedDate ? fetchRainfallDeciles(s.latitude, s.longitude, plantedDate.getMonth() + 1, 10) : Promise.resolve([]),
  ])

  // Season rainfall from station
  const growingSeasonRain = plantedDate ? await getGrowingSeasonRain(s.id, plantedDate, prisma) : 0

  // Monthly rainfall breakdown
  const monthlyRain: { month: string; station: number; historical: number }[] = []
  if (plantedDate) {
    const cursor = new Date(plantedDate)
    cursor.setDate(1)
    while (cursor <= today) {
      const m = cursor.getMonth()
      const y = cursor.getFullYear()
      const monthStart = new Date(y, m, 1)
      const monthEnd = new Date(y, m + 1, 0)
      const monthReadings = await prisma.weather_readings.findMany({
        where: { station_id: s.id, created_at: { gte: monthStart, lte: monthEnd }, rain_mm: { not: null } },
        orderBy: { created_at: 'asc' },
        select: { rain_mm: true },
      })
      let mRain = 0
      for (let i = 1; i < monthReadings.length; i++) {
        const prev = toN(monthReadings[i-1].rain_mm) ?? 0
        const curr = toN(monthReadings[i].rain_mm) ?? 0
        const inc = curr - prev
        if (inc > 0 && inc < 50) mRain += inc
      }
      const histNormal = climateNormals.find((n: any) => n.month === m + 1)?.avgRainfallMm ?? 0
      monthlyRain.push({
        month: new Date(y, m, 1).toLocaleDateString('en-AU', { month: 'short', year: '2-digit' }),
        station: Math.round(mRain * 10) / 10,
        historical: histNormal,
      })
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  // GDD and harvest
  let totalGdd = 0
  let gddPct = 0
  let harvestDate: Date | null = null
  let dailyGddTemps: number[] = []
  if (plantedDate && s.latitude && s.longitude) {
    dailyGddTemps = await getDailyAvgTempsWithGapFill(s.id, plantedDate, s.latitude, s.longitude, prisma)
    const baseTemp = toN(s.crop_types?.base_temp_gdd) ?? 4
    const targetGdd = toN(s.crop_types?.target_gdd_harvest) ?? 0
    totalGdd = dailyGddTemps.reduce((sum, t) => sum + Math.max(0, t - baseTemp), 0)
    gddPct = targetGdd > 0 ? Math.round((totalGdd / targetGdd) * 100) : 0
    if (targetGdd > 0 && dailyGddTemps.length > 0) {
      const avgDaily = totalGdd / dailyGddTemps.length
      const remaining = targetGdd - totalGdd
      if (remaining > 0 && avgDaily > 0) harvestDate = new Date(Date.now() + (remaining / avgDaily) * 86400000)
    }
  }

  // Temperature stats from BOM
  const temps = bomHistorical.map((d: any) => ({ max: d.tempMax, min: d.tempMin, avg: d.tempMax != null && d.tempMin != null ? (d.tempMax + d.tempMin) / 2 : null, date: d.date }))
  const avgTemp = temps.filter(t => t.avg != null).length > 0 ? temps.filter(t => t.avg != null).reduce((sum, t) => sum + t.avg!, 0) / temps.filter(t => t.avg != null).length : null
  const maxTemp = temps.length > 0 ? Math.max(...temps.filter(t => t.max != null).map(t => t.max!)) : null
  const minTemp = temps.length > 0 ? Math.min(...temps.filter(t => t.min != null).map(t => t.min!)) : null

  // Frost events
  const frostEvents = await prisma.weather_readings.findMany({
    where: { station_id: s.id, temperature_c: { lte: 0 }, ...(plantedDate ? { created_at: { gte: plantedDate } } : {}) },
    orderBy: { created_at: 'asc' },
    select: { created_at: true, temperature_c: true },
  })
  const frostDays = [...new Set(frostEvents.map(r => new Date(r.created_at!).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })))]
  const minFrostTemp = frostEvents.length > 0 ? Math.min(...frostEvents.map(r => toN(r.temperature_c) ?? 0)) : null
  const lastFrostDate = frostEvents.length > 0 ? new Date(frostEvents[frostEvents.length - 1].created_at!) : null

  // Spray windows — days with good conditions
  const sprayWindowDays = await prisma.weather_readings.groupBy({
    by: ['station_id'],
    where: {
      station_id: s.id,
      humidity: { gte: 30, lte: 95 },
      wind_avg_ms: { gte: 0.8, lte: 5.5 },
      temperature_c: { gte: 5, lte: 28 },
      ...(plantedDate ? { created_at: { gte: plantedDate } } : {}),
    },
    _count: true,
  })

  // Disease risk days
  const highHumidityDays = await prisma.weather_readings.findMany({
    where: { station_id: s.id, humidity: { gte: 80 }, temperature_c: { gte: 8, lte: 20 }, ...(plantedDate ? { created_at: { gte: plantedDate } } : {}) },
    select: { created_at: true },
    orderBy: { created_at: 'asc' },
  })
  const diseaseRiskDays = [...new Set(highHumidityDays.map(r => new Date(r.created_at!).toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' })))].length

  // Rainy days
  const rainyDaysCount = monthlyRain.filter(m => m.station >= 1).length

  // ET data
  const todayET = await getDailyET(s.id, s.elevation_m ?? null, s.latitude ?? null, prisma)

  // Leaching events (rain > 30mm)
  const leachingEvents = bomHistorical.filter((d: any) => (d.precipitation ?? 0) > 30).map((d: any) => ({
    date: new Date(d.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
    rainfall: Math.round(d.precipitation),
    nLost: Math.round((d.precipitation - 30) * 0.15),
  }))

  // Soil test interpretation
  const latestN = soilTests[0]
  const latestP = phosphorusTests[0]
  const sulphurInterp = latestN?.sulphur_mg_kg != null ? interpretSulphur(toN(latestN.sulphur_mg_kg)!, s.crop_types?.crop_name ?? null) : null
  const chlorideInterp = latestN?.chloride_mg_kg != null ? interpretChloride(toN(latestN.chloride_mg_kg)!, s.soil_type ?? null, s.crop_types?.crop_name ?? null) : null

  // P status
  let criticalP: number | null = null
  let pStatus: string | null = null
  if (latestP?.p_colwell_mg_kg != null && latestP?.pbi != null) {
    criticalP = 4.6 * Math.pow(toN(latestP.pbi)!, 0.393)
    const colwellP = toN(latestP.p_colwell_mg_kg)!
    if (colwellP < criticalP * 0.7) pStatus = 'deficient'
    else if (colwellP < criticalP) pStatus = 'marginal'
    else if (colwellP < criticalP * 1.5) pStatus = 'adequate'
    else pStatus = 'high'
  }

  // Nearest BOM station
  const nearest = s.latitude && s.longitude ? findNearestStation(s.latitude, s.longitude) : null

  // Decile bars for yield potential
  const wueVal = toN(s.crop_types?.wue_kg_per_mm) ?? 20
  const decileBars = decileData.map((d: any) => {
    const storedWater = growingSeasonRain * 0.25
    const totalWater = Math.max(0, storedWater + d.rainfallMm * 0.8 - 60)
    const waterLimited = Math.round(totalWater * wueVal) / 1000
    const nLimited = Math.min(waterLimited, Math.round(nBudget.totalAvailable / nReq * 10) / 10)
    const nGap = Math.max(0, waterLimited * nReq - nBudget.totalAvailable)
    return { label: d.label, rainfallMm: d.rainfallMm, waterLimitedTHa: waterLimited, nLimitedTHa: nLimited, nTopUpKgHa: Math.round(nGap) }
  })

  const reportData = {
    station: {
      id: s.id,
      name: s.paddock_name ?? s.id,
      cropName: s.crop_types?.crop_name ?? null,
      variety: s.crop_types?.variety ?? null,
      hectares: toN(s.hectares),
      soilType: s.soil_type ?? null,
      plantedDate: plantedDate?.toLocaleDateString('en-AU') ?? null,
      targetYield: toN(s.target_yield_t_ha),
      latitude: toN(s.latitude),
      longitude: toN(s.longitude),
      growthStage: (s as any).growth_stage ?? null,
    },
    season: { year: reportYear, startDate: seasonStart.toLocaleDateString('en-AU'), today: today.toLocaleDateString('en-AU'), dayCount: Math.ceil((today.getTime() - seasonStart.getTime()) / 86400000) },
    weather: { avgTemp, maxTemp, minTemp, growingSeasonRain, monthlyRain, frostDays: frostDays.length, minFrostTemp, lastFrostDate: lastFrostDate?.toLocaleDateString('en-AU') ?? null, diseaseRiskDays, rainyDays: rainyDaysCount, sprayWindowDays: Math.round((sprayWindowDays[0]?._count ?? 0) / 96), todayET: todayET?.etoMmDay ?? null, temps: temps.slice(0, 120) },
    harvest: { harvestDate: harvestDate?.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }) ?? null, harvestDateFull: harvestDate?.toLocaleDateString('en-AU') ?? null, totalGdd: Math.round(totalGdd), gddPct, daysToHarvest: harvestDate ? Math.max(0, Math.ceil((harvestDate.getTime() - Date.now()) / 86400000)) : null },
    nBudget: { soilTestN: (nBudget as any).soilTestN ?? 0, ocN: (nBudget as any).ocN ?? 0, preSowingN, postSowingN, totalAvailable: nBudget.totalAvailable, gapKgNHa: nBudget.gapKgNHa, appliedN: paddockApps.reduce((sum, a) => sum + a.n_kg_ha, 0) },
    applications: paddockApps.map(a => ({ date: new Date(a.applied_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), product: a.product, rateKgHa: a.rate_kg_ha ?? a.n_kg_ha, nKgHa: a.n_kg_ha, method: a.method ?? null, retainedKgHa: a.losses?.retainedKgNHa ?? a.n_kg_ha })),
    leachingEvents,
    soilTests: {
      latestNTest: latestN ? { date: new Date(latestN.tested_at).toLocaleDateString('en-AU'), no3: toN(latestN.no3_n_kg_ha), nh4: toN(latestN.nh4_n_kg_ha), sulphur: toN(latestN.sulphur_mg_kg), chloride: toN(latestN.chloride_mg_kg), sulphurStatus: sulphurInterp?.label ?? null, sulphurColor: sulphurInterp?.color ?? null, chlorideStatus: chlorideInterp?.label ?? null } : null,
      latestPTest: latestP ? { date: new Date(latestP.tested_at).toLocaleDateString('en-AU'), colwellP: toN(latestP.p_colwell_mg_kg), pbi: toN(latestP.pbi), ph: toN(latestP.ph_cacl2), criticalP, pStatus } : null,
    },
    irrigationLogs: irrigationLogs.map(i => ({ date: new Date((i as any).irrigated_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }), method: (i as any).method ?? null, amountMm: toN((i as any).amount_mm), notes: (i as any).notes ?? null })),
    decileBars,
    agronomistNotes: agronomistNotes[0] ?? null,
    settings: { contactName: (settings as any)?.contact_name ?? 'Michael Pankhurst', contactEmail: (settings as any)?.contact_email ?? 'info@weatherwrangler.net', contactPhone: (settings as any)?.contact_phone ?? '+61 422 490 254' },
    nearest,
  }

  const months = Array.from({ length: 12 }, (_, i) => ({ m: i, y: i <= now.getMonth() ? now.getFullYear() : now.getFullYear() - 1 }))

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      <div className="no-print" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', background: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>← My Paddocks</Link>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {stations.length > 1 && stations.map(st => (
              <a key={st.id} href={`/report?station=${st.id}&year=${reportYear}`} style={{ fontSize: 12, padding: '4px 10px', border: `1px solid ${st.id === selectedStationId ? '#7c5cbf' : '#ddd'}`, borderRadius: 6, textDecoration: 'none', color: st.id === selectedStationId ? '#7c5cbf' : '#666' }}>{st.paddock_name ?? st.id}</a>
            ))}
            {[2024, 2025, 2026, 2027].map(y => (
              <a key={y} href={`/report?station=${selectedStationId}&year=${y}`} style={{ fontSize: 12, padding: '4px 10px', border: `1px solid ${y === reportYear ? '#7c5cbf' : '#ddd'}`, borderRadius: 6, textDecoration: 'none', color: y === reportYear ? '#7c5cbf' : '#666' }}>{y}</a>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>
      <ReportContent data={reportData} stationId={s.id} seasonYear={reportYear} />
    </div>
  )
}
