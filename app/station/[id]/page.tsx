import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import PaddockDetailsForm from './PaddockDetailsForm'
import ZonesSection from './ZonesSection'
import SoilTestsSection from './SoilTestsSection'

export default async function StationDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/login')

  const station = await prisma.stations.findFirst({ where: { id, farmer_id: (session.user as any).id } })
  if (!station) notFound()

  const [cropTypes, zones, nitrogenTests, phosphorusTests] = await Promise.all([
    prisma.crop_types.findMany({ orderBy: { id: 'asc' } }),
    prisma.zones.findMany({ where: { station_id: id }, orderBy: { created_at: 'asc' } }),
    prisma.nitrogen_soil_tests.findMany({ where: { station_id: id }, orderBy: { tested_at: 'desc' } }),
    prisma.phosphorus_soil_tests.findMany({ where: { station_id: id }, orderBy: { tested_at: 'desc' } }),
  ])

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 880, margin: '0 auto' }}>
      <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← Back to paddocks</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 24px' }}>
        {station.paddock_name ?? station.id}
      </h1>

      <PaddockDetailsForm
        stationId={station.id}
        cropTypes={cropTypes}
        currentCropTypeId={station.crop_type_id}
        currentPlantedDate={station.planted_date ? new Date(station.planted_date).toISOString().slice(0, 10) : null}
        currentHectares={station.hectares}
        currentSoilType={station.soil_type}
      />

      <ZonesSection stationId={station.id} zones={zones} cropTypes={cropTypes} />

      <SoilTestsSection
        stationId={station.id}
        zones={zones.map(z => ({ id: z.id, name: z.name }))}
        nitrogenTests={nitrogenTests}
        phosphorusTests={phosphorusTests}
      />

      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        For weather history, click Temp / Humidity / Wind / Rain on the <Link href="/" style={{ color: 'var(--orange)' }}>main dashboard</Link>.
      </p>
    </div>
  )
}
