import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import PaddockDetailsForm from './PaddockDetailsForm'
import ZonesSection from './ZonesSection'
import SoilTestsSection from './SoilTestsSection'
import NitrogenApplicationsSection from './NitrogenApplicationsSection'
import CollapsibleSection from './CollapsibleSection'
import PolygonSection from './PolygonSection'
import IrrigationSection from './IrrigationSection'
import ManualRainSection from './ManualRainSection'
import { getPostApplicationWeather } from '@/lib/gdd'
import { estimateNLosses } from '@/lib/volatilization'
import CropRotationSection from './CropRotationSection'
import { interpretSulphur, interpretChloride } from '@/lib/nutrientInterpretation'
import { interpretPhosphorus } from '@/lib/phosphorus'

export default async function StationDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const station = await prisma.stations.findFirst({ where: { id, farmer_id: (session.user as any).id }, include: { crop_types: true } })
  if (!station) notFound()

  const [rawCropTypes, zones, nitrogenTests, phosphorusTests, nitrogenApplications, nitrogenProducts, polygons, irrigationLogs, manualRain, cropRotation] = await Promise.all([
    prisma.crop_types.findMany({ orderBy: { id: 'asc' } }),
    prisma.zones.findMany({ where: { station_id: id }, orderBy: { created_at: 'asc' } }),
    prisma.nitrogen_soil_tests.findMany({ where: { station_id: id }, orderBy: { tested_at: 'desc' } }),
    prisma.phosphorus_soil_tests.findMany({ where: { station_id: id }, orderBy: { tested_at: 'desc' } }),
    prisma.nitrogen_applications.findMany({ where: { station_id: id }, orderBy: { applied_at: 'desc' } }),
    prisma.nitrogen_products.findMany({ orderBy: { id: 'asc' } }),
    prisma.paddock_polygons.findMany({ where: { station_id: id }, orderBy: { created_at: 'asc' } }),
    prisma.irrigation_logs.findMany({ where: { station_id: id }, orderBy: { irrigated_at: 'desc' } }),
    prisma.manual_rain_entries.findMany({ where: { station_id: id }, orderBy: { rain_date: 'desc' } }),
    prisma.crop_rotation.findMany({ where: { station_id: id }, orderBy: { planted_date: 'desc' } }),
  ])

  const cropTypes = rawCropTypes.map(c => ({ id: c.id, crop_name: c.crop_name, variety: c.variety }))

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
      {/* Soil test alerts */}
      {(() => {
        const alerts: { msg: string; color: string }[] = []
        const latestN = nitrogenTests[0]
        const latestP = phosphorusTests[0]
        const cropName = station.crop_types?.crop_name ?? null
        const soilType = station.soil_type ?? null

        if (latestN?.sulphur_mg_kg != null) {
          const s = interpretSulphur(parseFloat(String(latestN.sulphur_mg_kg)), cropName)
          if (s.status === 'deficient') alerts.push({ msg: `⚠️ Sulphur deficient (${latestN.sulphur_mg_kg} mg/kg) — response to S fertiliser expected`, color: '#ef4444' })
          else if (s.status === 'marginal') alerts.push({ msg: `⚠️ Sulphur marginal (${latestN.sulphur_mg_kg} mg/kg) — yield response possible`, color: '#f97316' })
        }
        if (latestN?.chloride_mg_kg != null) {
          const cl = interpretChloride(parseFloat(String(latestN.chloride_mg_kg)), soilType, cropName)
          if (cl.status === 'high') alerts.push({ msg: `⚠️ Chloride elevated (${latestN.chloride_mg_kg} mg/kg) — monitor for salinity symptoms`, color: '#f97316' })
          else if (cl.status === 'toxic') alerts.push({ msg: `🔴 Chloride very high (${latestN.chloride_mg_kg} mg/kg) — significant salinity stress likely`, color: '#ef4444' })
        }
        if (latestP?.p_colwell_mg_kg != null && latestP?.pbi != null) {
          const pbi = parseFloat(String(latestP.pbi))
          const colwellP = parseFloat(String(latestP.p_colwell_mg_kg))
          const criticalP = 4.6 * Math.pow(pbi, 0.393)
          if (colwellP < criticalP * 0.7) alerts.push({ msg: `⚠️ Phosphorus deficient — Colwell P (${colwellP} mg/kg) well below critical (${criticalP.toFixed(0)} mg/kg)`, color: '#ef4444' })
          else if (colwellP < criticalP) alerts.push({ msg: `⚠️ Phosphorus marginal — Colwell P (${colwellP} mg/kg) below critical (${criticalP.toFixed(0)} mg/kg)`, color: '#f97316' })
        }
        if (latestP?.ph_cacl2 != null) {
          const ph = parseFloat(String(latestP.ph_cacl2))
          if (ph < 4.8) alerts.push({ msg: `🔴 pH very low (${ph}) — aluminium toxicity likely, lime required urgently`, color: '#ef4444' })
          else if (ph < 5.2) alerts.push({ msg: `⚠️ pH low (${ph}) — below optimal range, consider liming`, color: '#f97316' })
        }

        if (alerts.length === 0) return null
        return (
          <div style={{ marginBottom: 16 }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${a.color}`, background: `${a.color}18`, fontSize: 13, color: a.color, marginBottom: 6 }}>
                {a.msg}
              </div>
            ))}
          </div>
        )
      })()}

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

      <CollapsibleSection title="Paddock details" defaultOpen={true}>
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
          ws90Serial={(station as any).ws90_serial ?? null}
          latitude={station.latitude ?? null}
          longitude={station.longitude ?? null}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Zones (${zones.length})`} defaultOpen={zones.length > 0}>
        <ZonesSection stationId={station.id} zones={zones} cropTypes={cropTypes} />
      </CollapsibleSection>

      <CollapsibleSection title={`Nitrogen applications (${nitrogenApplications.length})`} defaultOpen={nitrogenApplications.length > 0}>
        <NitrogenApplicationsSection
          stationId={station.id}
          zones={zones.map(z => ({ id: z.id, name: z.name, soil_type: z.soil_type ?? null }))}
          products={nitrogenProducts}
          applications={appsWithWeather}
          paddockSoilType={station.soil_type ?? null}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Soil tests (${nitrogenTests.length + phosphorusTests.length})`} defaultOpen={nitrogenTests.length > 0 || phosphorusTests.length > 0}>
        <SoilTestsSection
          stationId={station.id}
          zones={zones.map(z => ({ id: z.id, name: z.name }))}
          nitrogenTests={nitrogenTests}
          phosphorusTests={phosphorusTests}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Irrigation log (${irrigationLogs.length})`} defaultOpen={irrigationLogs.length > 0}>
        <IrrigationSection
          stationId={station.id}
          zones={zones.map(z => ({ id: z.id, name: z.name }))}
          logs={irrigationLogs}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Crop rotation (${cropRotation.length})`} defaultOpen={false}>
        <CropRotationSection
          stationId={id}
          entries={cropRotation.map(e => ({
            id: e.id,
            crop_name: e.crop_name,
            variety: e.variety,
            planted_date: e.planted_date,
            harvest_date: e.harvest_date,
            yield_t_ha: e.yield_t_ha != null ? parseFloat(String(e.yield_t_ha)) : null,
            notes: e.notes,
          }))}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Historical rain (${manualRain.length})`} defaultOpen={manualRain.length > 0}>
        <ManualRainSection
          stationId={station.id}
          entries={manualRain}
        />
      </CollapsibleSection>

      <CollapsibleSection title={`Boundaries (${polygons.length})`} defaultOpen={polygons.length > 0}>
        <PolygonSection
          stationId={station.id}
          zones={zones.map(z => ({ id: z.id, name: z.name }))}
          polygons={polygons.map(p => ({ id: p.id, name: p.name, geojson: p.geojson, zone_id: p.zone_id }))}
          stationLat={station.latitude ?? null}
          stationLng={station.longitude ?? null}
        />
      </CollapsibleSection>

      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        For weather history, click Temp / Humidity / Wind / Rain on the <Link href="/" style={{ color: 'var(--orange)' }}>main dashboard</Link>.
        For N budget and yield potential, visit the <Link href="/nitrogen" style={{ color: 'var(--orange)' }}>Nitrogen page</Link>.
      </p>
    </div>
  )
}
