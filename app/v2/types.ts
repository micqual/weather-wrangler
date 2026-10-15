import type { SprayCondition } from '@/lib/sprayWindow'

export type Conditions = {
  hasData: boolean
  borrowedFrom: string | null
  readingAt: string | null
  tempC: number | null
  humidity: number | null
  windKmh: number | null
  gustKmh: number | null
  windDir: string | null
  uvi: number | null
  rainToday: number | null
  rainYesterday: number | null
  rain7d: number | null
  deltaT: number | null
  sprayOverall: 'go' | 'caution' | 'stop'
  sprayConditions: SprayCondition[]
}
