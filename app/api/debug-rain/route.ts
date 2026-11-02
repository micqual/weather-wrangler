import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getDailyRainWithRate } from '@/lib/gdd'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await auth()
  if ((session?.user as any)?.email !== 'mdpankhurst@gmail.com') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const station = req.nextUrl.searchParams.get('station') ?? 'node_2'
  try {
    const rec = await prisma.stations.findUnique({ where: { id: station }, select: { borrowed_station_id: true } })
    const eff = rec?.borrowed_station_id ?? station
    const result = await getDailyRainWithRate(station, prisma)
    const rows: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS readings, MIN(rain_mm) AS lowest, MAX(rain_mm) AS highest, MAX(created_at) AS newest
      FROM weather_readings
      WHERE station_id = ${eff} AND rain_mm IS NOT NULL
      AND created_at >= (CASE WHEN (NOW() AT TIME ZONE 'Australia/Melbourne')::time < '09:00'
        THEN date_trunc('day', NOW() AT TIME ZONE 'Australia/Melbourne') - interval '15 hours'
        ELSE date_trunc('day', NOW() AT TIME ZONE 'Australia/Melbourne') + interval '9 hours' END) AT TIME ZONE 'Australia/Melbourne'`
    return NextResponse.json({ station, readsFrom: eff, appResult: result, databaseSinceNineAm: rows[0] })
  } catch (e: any) {
    return NextResponse.json({ station, error: String(e?.message ?? e) }, { status: 500 })
  }
}
