'use client'

type Point = { date: string; etoMmDay: number }

export default function ETSparkline({ points }: { points: Point[] }) {
  if (points.length < 2) return null

  const width = 120
  const height = 32
  const maxVal = Math.max(...points.map(p => p.etoMmDay), 0.1)

  const x = (i: number) => (i / (points.length - 1)) * width
  const y = (v: number) => height - (v / maxVal) * height

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p.etoMmDay).toFixed(1)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: 60, height: 16, display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}>
      <path d={pathD} fill="none" stroke="var(--purple)" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}
