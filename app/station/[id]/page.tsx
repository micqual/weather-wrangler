import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import PaddockDetailsForm from './PaddockDetailsForm'
import ZonesSection from './ZonesSection'
import SoilTestsSection from './SoilTestsSection'
import NitrogenApplicationsSection from './NitrogenApplicationsSection'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'

export default async function StationDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const station = await prisma.stations.findFirst({ where: { id, farmer_id: (session.user as any).id } })
  if (!station) notFound()

  const [cropTypes, zones, nitrogenTests, phosphorusTests, nitrogenApplications, nitrogenProducts] = await Promise.all([
    prisma.crop_types.findMany({ orderBy: { id: 'asc' } }),
    prisma.zones.findMany({ where: { station_id: id }, orderBy: { created_at: 'asc' } }),
    prisma.nitrogen_soil_tests.findMany({ where: { station_id: id }, orderBy: { tested_at: 'desc' } }),
    prisma.phosphorus_soil_tests.findMany({ where: { station_id: id }, orderBy: { tested_at: 'desc' } }),
    prisma.nitrogen_applications.findMany({ where: { station_id: id }, orderBy: { applied_at: 'desc' } }),
    prisma.nitrogen_products.findMany({ orderBy: { id: 'asc' } }),
  ])

  const appsWithWeather = await Promise.all(
    nitrogenApplications.map(async a => {
      const weather = await getPostApplicationWeather(id, new Date(a.applied_at), prisma)
      const losses = estimateNLosses(
        a.n_kg_ha, a.incorporated ?? false,
        weather.avgTempC, weather.avgHumidity,
        weather.daysToRain, weather.totalRainMm,
        station.soil_type ?? null, a.product
      )
      return { ...a, ...weather, losses }
    })
  )

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
      <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← Back to paddocks</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 8px' }}>
        {station.paddock_name ?? station.id}
      </h1>

      {(station.target_yield_t_ha != null || (station as any).actual_yield_t_ha != null) && (
        <div style={{ fontSize: 13, marginBottom: 20 }}>
          {station.target_yield_t_ha != null && (
            <span>Target yield: <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{station.target_yield_t_ha} t/ha</span></span>
          )}
          {station.target_yield_t_ha != null && (station as any).actual_yield_t_ha != null && <span style={{ color: 'var(--text-muted)' }}> · </span>}
          {(station as any).actual_yield_t_ha != null && (
            <span>Actual yield: <span style={{ color: 'var(--purple)', fontWeight: 600 }}>{(station as any).actual_yield_t_ha} t/ha</span></span>
          )}
        </div>
      )}

      <PaddockDetailsForm
        stationId={station.id}
        cropTypes={cropTypes}
        currentCropTypeId={station.crop_type_id}
        currentPlantedDate={station.planted_date ? new Date(station.planted_date).toISOString().slice(0, 10) : null}
        currentHectares={station.hectares}
        currentSoilType={station.soil_type}
        currentTargetYield={station.target_yield_t_ha}
        currentActualYield={(station as any).actual_yield_t_ha ?? null}
        currentStoredSoilWater={(station as any).stored_soil_water_mm ? parseFloat(String((station as any).stored_soil_water_mm)) : null}
        currentOrganicCarbon={(station as any).organic_carbon_pct ? parseFloat(String((station as any).organic_carbon_pct)) : null}
      />

      <ZonesSection stationId={station.id} zones={zones} cropTypes={cropTypes} />

      <NitrogenApplicationsSection
        stationId={station.id}
        zones={zones.map(z => ({ id: z.id, name: z.name, soil_type: z.soil_type ?? null }))}
        products={nitrogenProducts}
        applications={appsWithWeather}
        paddockSoilType={station.soil_type ?? null}
      />

      <SoilTestsSection
        stationId={station.id}
        zones={zones.map(z => ({ id: z.id, name: z.name }))}
        nitrogenTests={nitrogenTests}
        phosphorusTests={phosphorusTests}
      />

      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        For weather history, click Temp / Humidity / Wind / Rain on the <Link href="/" style={{ color: 'var(--orange)' }}>main dashboard</Link>.
        For N budget and yield potential, visit the <Link href="/nitrogen" style={{ color: 'var(--orange)' }}>Nitrogen page</Link>.
      </p>
    </div>
  )
}
