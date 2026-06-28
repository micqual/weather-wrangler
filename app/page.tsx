import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export default async function Dashboard() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const stations = await prisma.stations.findMany({
    where: { farmer_id: (session.user as any).id },
    include: { weather_readings: { orderBy: { created_at: 'desc' }, take: 1 } },
  })

  return (
    <div style={{ padding: 20 }}>
      <h1>My Paddocks</h1>
      {stations.map(s => {
        const r = s.weather_readings[0]
        return (
          <div key={s.id} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 10 }}>
            <h3>{s.paddock_name ?? s.id}</h3>
            <p>Temp: {r?.temperature_c}°C · Humidity: {r?.humidity}%</p>
            <p>ESP battery: {r?.esp_battery_v}V · Solar: {r?.solar_v}V</p>
          </div>
        )
      })}
    </div>
  )
}
