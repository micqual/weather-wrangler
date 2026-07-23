'use client'

import { useState } from 'react'

type ReportData = {
  station: any
  season: any
  weather: any
  harvest: any
  nBudget: any
  applications: any[]
  leachingEvents: any[]
  soilTests: any
  irrigationLogs: any[]
  decileBars: any[]
  agronomistNotes: any
  settings: any
  nearest: any
}

const GREEN = '#166534'
const ORANGE = '#ea580c'
const RED = '#dc2626'
const AMBER = '#d97706'
const BLUE = '#1d4ed8'
const GREY = '#6b7280'

function Badge({ label, color }: { label: string; color: string }) {
  const bg: Record<string, string> = { '#166534': '#dcfce7', '#dc2626': '#fee2e2', '#d97706': '#fef3c7', '#1d4ed8': '#dbeafe', '#6b7280': '#f3f4f6' }
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: bg[color] ?? '#f3f4f6', color, fontFamily: 'sans-serif', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <div style={{ width: 3, height: 18, background: GREEN, borderRadius: 2, flexShrink: 0 }} />
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, fontFamily: 'sans-serif' }}>{children}</h3>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: GREY, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'sans-serif', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color ?? '#111', fontFamily: 'sans-serif', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: GREY, marginTop: 2, fontFamily: 'sans-serif' }}>{sub}</div>}
    </div>
  )
}

function PageHeader({ title, sub, page, total }: { title: string; sub: string; page: number; total: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 8, borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>{title}</div>
        <div style={{ fontSize: 11, color: GREY, fontFamily: 'sans-serif', marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 11, color: GREY, fontFamily: 'sans-serif' }}>Page {page} of {total}</div>
    </div>
  )
}

function MiniBarChart({ data }: { data: { label: string; station: number; historical: number }[] }) {
  if (data.length === 0) return <div style={{ color: GREY, fontSize: 12, fontFamily: 'sans-serif' }}>No data</div>
  const max = Math.max(...data.flatMap(d => [d.station, d.historical]), 10)
  const h = 80
  return (
    <svg viewBox={`0 0 ${data.length * 40} ${h + 30}`} style={{ width: '100%', height: 'auto' }}>
      {data.map((d, i) => (
        <g key={i} transform={`translate(${i * 40}, 0)`}>
          <rect x={4} y={h - (d.station / max * h)} width={13} height={d.station / max * h} fill={GREEN} />
          <rect x={20} y={h - (d.historical / max * h)} width={13} height={d.historical / max * h} fill="#d1d5db" />
          <text x={18} y={h + 14} fontSize="9" fill={GREY} textAnchor="middle" fontFamily="sans-serif">{d.label}</text>
          <text x={10} y={h - (d.station / max * h) - 2} fontSize="8" fill={GREEN} textAnchor="middle" fontFamily="sans-serif">{d.station}</text>
        </g>
      ))}
      <text x={0} y={h + 26} fontSize="9" fill={GREEN} fontFamily="sans-serif">&#9632; Season</text>
      <text x={data.length * 20} y={h + 26} fontSize="9" fill={GREY} fontFamily="sans-serif">&#9632; Avg</text>
    </svg>
  )
}

function TempChart({ data }: { data: { date: string; max: number | null; avg: number | null; min: number | null }[] }) {
  if (data.length === 0) return null
  const filtered = data.filter(d => d.max != null && d.min != null)
  if (filtered.length < 2) return null
  const w = 400, h = 100, padL = 25, padB = 20, padT = 10
  const allVals = filtered.flatMap(d => [d.max!, d.min!])
  const minV = Math.min(...allVals) - 2
  const maxV = Math.max(...allVals) + 2
  const x = (i: number) => padL + (i / (filtered.length - 1)) * (w - padL)
  const y = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * (h - padT - padB)
  const line = (key: 'max' | 'avg' | 'min') =>
    filtered.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(0)} ${y(d[key] ?? 0).toFixed(0)}`).join(' ')
  const ticks = filtered.filter((_, i) => i % Math.floor(filtered.length / 4) === 0)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto' }}>
      <path d={line('max')} fill="none" stroke={RED} strokeWidth={1.5} />
      <path d={line('avg')} fill="none" stroke={ORANGE} strokeWidth={1.5} />
      <path d={line('min')} fill="none" stroke={BLUE} strokeWidth={1.5} />
      {[minV, (minV + maxV) / 2, maxV].map((v, i) => (
        <text key={i} x={padL - 3} y={y(v) + 3} fontSize="8" fill={GREY} textAnchor="end" fontFamily="sans-serif">{Math.round(v)}deg</text>
      ))}
      {ticks.map((d, i) => (
        <text key={i} x={x(filtered.indexOf(d))} y={h - 4} fontSize="8" fill={GREY} textAnchor="middle" fontFamily="sans-serif">
          {new Date(d.date).toLocaleDateString('en-AU', { month: 'short' })}
        </text>
      ))}
    </svg>
  )
}

export default function ReportContent({ data, stationId, seasonYear }: { data: ReportData; stationId: string; seasonYear: number }) {
  const [notes, setNotes] = useState(data.agronomistNotes?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const sub = `${data.station.name} · Season ${seasonYear}`

  const saveNotes = async () => {
    setSaving(true)
    await fetch('/api/agronomist-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id: stationId, season_year: seasonYear, notes }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ fontFamily: 'Georgia, serif', color: '#111', background: '#fff', maxWidth: 860, margin: '0 auto', padding: '0 24px' }}>

      <div style={{ paddingTop: 32, marginBottom: 48 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <img src="/Logo.png" alt="Weather Wrangler" style={{ width: 56, height: 56, objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 11, color: GREY, textTransform: 'uppercase', letterSpacing: 1.5, fontFamily: 'sans-serif' }}>Weather Wrangler</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'sans-serif' }}>Agronomy Report</div>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontFamily: 'sans-serif' }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Generated {new Date().toLocaleDateString('en-AU')}</div>
            <div style={{ fontSize: 12, color: GREY }}>Season {seasonYear}</div>
          </div>
        </div>

        <div style={{ borderTop: '2px solid #111', paddingTop: 20, marginBottom: 20 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px' }}>{data.station.name}</h1>
          <div style={{ fontSize: 14, color: GREY, fontFamily: 'sans-serif' }}>{data.settings.contactName}</div>
        </div>

        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
          {([
            ['CROP', data.station.cropName ? `${data.station.cropName}${data.station.variety ? \` — ${data.station.variety}\` : ''}` : '—', 'PLANTED', data.station.plantedDate ?? '—'],
            ['PADDOCK AREA', data.station.hectares ? `${data.station.hectares} ha` : '—', 'TARGET YIELD', data.station.targetYield ? `${data.station.targetYield} t/ha` : '—'],
            ['SOIL TYPE', data.station.soilType ?? '—', 'GROWTH STAGE', data.station.growthStage ?? '—'],
          ] as [string,string,string,string][]).map(([l1, v1, l2, v2], i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: i < 2 ? '1px solid #e5e7eb' : 'none' }}>
              <div style={{ padding: '10px 14px', borderRight: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 9, color: GREY, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'sans-serif', marginBottom: 2 }}>{l1}</div>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif' }}>{v1}</div>
              </div>
              <div style={{ padding: '10px 14px' }}>
                <div style={{ fontSize: 9, color: GREY, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'sans-serif', marginBottom: 2 }}>{l2}</div>
                <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'sans-serif' }}>{v2}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 24 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', fontFamily: 'sans-serif' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{data.settings.contactName}</div>
            <div style={{ fontSize: 13, color: GREEN, marginTop: 2 }}>{data.settings.contactEmail} · {data.settings.contactPhone}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', fontFamily: 'sans-serif', textAlign: 'right', minWidth: 160 }}>
            <div style={{ fontSize: 10, color: GREY, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>N status</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: data.nBudget.gapKgNHa > 20 ? ORANGE : GREEN }}>
              {data.nBudget.gapKgNHa > 20 ? 'TOP UP NEEDED' : 'ON TRACK'}
            </div>
            <div style={{ fontSize: 12, color: GREY, marginTop: 2 }}>{Math.round(data.nBudget.totalAvailable)} kg N/ha available</div>
          </div>
        </div>

        <PageHeader title="Season Weather Summary" sub={`${sub} · ${data.season.dayCount} days`} page={1} total={4} />
        <SectionTitle>Season at a glance</SectionTitle>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          <StatCard label="Season rainfall" value={`${data.weather.growingSeasonRain.toFixed(0)} mm`} color={GREEN} />
          <StatCard label="Avg temperature" value={data.weather.avgTemp != null ? `${data.weather.avgTemp.toFixed(1)} C` : '—'} />
          <StatCard label="GDD accumulated" value={`${data.harvest.totalGdd} Cd`} />
          <StatCard label="Frost events" value={`${data.weather.frostDays} nights`} color={data.weather.frostDays > 0 ? BLUE : undefined} />
          <StatCard label="Spray windows" value={`${data.weather.sprayWindowDays} days`} />
          <StatCard label="Disease risk days" value={`${data.weather.diseaseRiskDays} days`} color={data.weather.diseaseRiskDays > 10 ? AMBER : undefined} />
          <StatCard label="Rainy days" value={`${data.weather.rainyDays} days`} />
          <StatCard label="Est. harvest" value={data.harvest.harvestDate ?? '—'} color={GREEN} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <SectionTitle>Monthly rainfall vs historical</SectionTitle>
            <MiniBarChart data={data.weather.monthlyRain} />
          </div>
          <div>
            <SectionTitle>Temperature range</SectionTitle>
            <TempChart data={data.weather.temps} />
          </div>
        </div>
      </div>

      <div style={{ pageBreakBefore: 'always', paddingTop: 32, marginBottom: 48 }}>
        <PageHeader title="Nitrogen Management & Yield Projection" sub={sub} page={2} total={4} />
        <SectionTitle>N balance</SectionTitle>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '10px 14px', fontFamily: 'sans-serif', fontSize: 13, marginBottom: 16 }}>
          <span style={{ color: GREY }}>{Math.round(data.nBudget.soilTestN)} soil</span>
          {data.nBudget.ocN > 0 && <span style={{ color: GREY }}> + {Math.round(data.nBudget.ocN)} OC</span>}
          <span style={{ color: GREEN }}> + {Math.round(data.nBudget.postSowingN + data.nBudget.preSowingN)} applied</span>
          <span style={{ fontWeight: 700 }}> = {Math.round(data.nBudget.totalAvailable)} kg N/ha</span>
        </div>

        <SectionTitle>Yield potential by rainfall decile</SectionTitle>
        {data.decileBars.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'sans-serif', marginBottom: 20 }}>
            <thead>
              <tr style={{ background: '#111', color: '#fff' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500 }}>Rainfall decile</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>Potential</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>With current N</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>N top-up</th>
              </tr>
            </thead>
            <tbody>
              {data.decileBars.map((d: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', background: i === 2 ? '#f0fdf4' : 'transparent' }}>
                  <td style={{ padding: '7px 10px', fontWeight: i === 2 ? 600 : 400 }}>{d.label.split('\n')[0]}{i === 2 && <span style={{ color: GREY, fontWeight: 400 }}> (most likely)</span>}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{d.waterLimitedTHa.toFixed(1)} t/ha</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', color: d.nLimitedTHa < d.waterLimitedTHa ? ORANGE : GREEN, fontWeight: 600 }}>{d.nLimitedTHa.toFixed(1)} t/ha</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                    {d.nTopUpKgHa > 0 ? <Badge label={`+${d.nTopUpKgHa} kg N`} color={AMBER} /> : <Badge label="None" color={GREEN} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p style={{ fontSize: 12, color: GREY, fontFamily: 'sans-serif' }}>Set paddock coordinates to see decile analysis.</p>}
      </div>

      <div style={{ pageBreakBefore: 'always', paddingTop: 32, marginBottom: 48 }}>
        <PageHeader title="Soil Fertility & Application History" sub={sub} page={3} total={4} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <SectionTitle>Soil test results</SectionTitle>
            {data.soilTests.latestNTest || data.soilTests.latestPTest ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'sans-serif', marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: '#111', color: '#fff' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 500 }}>Parameter</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>Result</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 500 }}>Unit</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.soilTests.latestNTest && <>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 10px' }}>Nitrate N (NO3-N)</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{data.soilTests.latestNTest.no3}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: GREY }}>kg/ha</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}><Badge label="Adequate" color={GREEN} /></td>
                    </tr>
                    {data.soilTests.latestNTest.sulphur != null && <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 10px' }}>Sulphur (KCl40)</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{data.soilTests.latestNTest.sulphur}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: GREY }}>mg/kg</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}><Badge label={data.soilTests.latestNTest.sulphurStatus ?? '—'} color={data.soilTests.latestNTest.sulphurColor ?? GREY} /></td>
                    </tr>}
                    {data.soilTests.latestNTest.chloride != null && <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 10px' }}>Chloride</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{data.soilTests.latestNTest.chloride}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: GREY }}>mg/kg</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}><Badge label="Low risk" color={GREEN} /></td>
                    </tr>}
                  </>}
                  {data.soilTests.latestPTest && <>
                    {data.soilTests.latestPTest.colwellP != null && <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 10px' }}>Phosphorus (Colwell)</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{data.soilTests.latestPTest.colwellP}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: GREY }}>mg/kg</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}><Badge label={data.soilTests.latestPTest.pStatus ?? '—'} color={data.soilTests.latestPTest.pStatus === 'deficient' ? RED : data.soilTests.latestPTest.pStatus === 'marginal' ? AMBER : GREEN} /></td>
                    </tr>}
                    {data.soilTests.latestPTest.ph != null && <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 10px' }}>pH (CaCl2)</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{data.soilTests.latestPTest.ph}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: GREY }}>—</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center' }}><Badge label={data.soilTests.latestPTest.ph < 5.2 ? 'Acid risk' : data.soilTests.latestPTest.ph < 5.5 ? 'Low' : 'Adequate'} color={data.soilTests.latestPTest.ph < 5.2 ? RED : data.soilTests.latestPTest.ph < 5.5 ? AMBER : GREEN} /></td>
                    </tr>}
                  </>}
                </tbody>
              </table>
            ) : <p style={{ fontSize: 12, color: GREY, fontFamily: 'sans-serif' }}>No soil tests recorded.</p>}
          </div>
          <div>
            <SectionTitle>N application history</SectionTitle>
            {data.applications.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'sans-serif', marginBottom: 16 }}>
                <thead>
                  <tr style={{ background: '#111', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>Date</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>Product</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>N kg/ha</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {data.applications.map((a: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 8px' }}>{a.date}</td>
                      <td style={{ padding: '7px 8px' }}>{a.product}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, color: GREEN }}>{a.nKgHa.toFixed(1)}</td>
                      <td style={{ padding: '7px 8px', color: GREY }}>{a.method ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ fontSize: 12, color: GREY, fontFamily: 'sans-serif' }}>No applications recorded.</p>}

            <SectionTitle>Irrigation log</SectionTitle>
            {data.irrigationLogs.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'sans-serif' }}>
                <thead>
                  <tr style={{ background: '#111', color: '#fff' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>Date</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 500 }}>Type</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 500 }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.irrigationLogs.map((log: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '7px 8px' }}>{log.date}</td>
                      <td style={{ padding: '7px 8px' }}>{log.method ?? '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>{log.amountMm != null ? `${log.amountMm} mm` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p style={{ fontSize: 12, color: GREY, fontFamily: 'sans-serif', fontStyle: 'italic' }}>No irrigation events recorded</p>}
          </div>
        </div>
      </div>

      <div style={{ pageBreakBefore: 'always', paddingTop: 32, marginBottom: 48 }}>
        <PageHeader title="Agronomist Recommendations" sub={sub} page={4} total={4} />
        <SectionTitle>Agronomist notes</SectionTitle>
        <textarea
          className="no-print"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Enter agronomist notes and recommendations…"
          style={{ width: '100%', minHeight: 140, padding: '10px 12px', fontFamily: 'Georgia, serif', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, resize: 'vertical', marginBottom: 8, boxSizing: 'border-box' }}
        />
        {notes && (
          <div className="print-only" style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '12px 14px', fontSize: 13, lineHeight: 1.7, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
            {notes}
          </div>
        )}
        <div className="no-print" style={{ marginBottom: 24 }}>
          <button onClick={saveNotes} disabled={saving} style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'sans-serif' }}>
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save notes'}
          </button>
        </div>

        {data.decileBars[2] && (
          <>
            <SectionTitle>Season outlook</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={{ border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px', background: '#f0fdf4', fontFamily: 'sans-serif' }}>
                <div style={{ fontSize: 11, color: GREY, marginBottom: 6 }}>Average season (D4-7)</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: GREEN }}>{data.decileBars[2].waterLimitedTHa.toFixed(1)} t/ha</div>
              </div>
              <div style={{ border: '1px solid #fed7aa', borderRadius: 8, padding: '14px 16px', background: '#fff7ed', fontFamily: 'sans-serif' }}>
                <div style={{ fontSize: 11, color: GREY, marginBottom: 6 }}>With current N</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: ORANGE }}>{data.decileBars[2].nLimitedTHa.toFixed(1)} t/ha</div>
              </div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '14px 16px', background: '#f9fafb', fontFamily: 'sans-serif' }}>
                <div style={{ fontSize: 11, color: GREY, marginBottom: 6 }}>Potential gain</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: '#111' }}>${(((data.decileBars[2].waterLimitedTHa - data.decileBars[2].nLimitedTHa) * 280) * (data.station.hectares ?? 1)).toFixed(0)}</div>
              </div>
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, fontSize: 10, color: GREY, fontFamily: 'sans-serif', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 6px' }}>This report is prepared for advisory purposes only. Yield projections are estimates based on the French-Schultz / Mitscherlich model. Actual yields will vary.</p>
          <p style={{ margin: 0 }}>Generated by Weather Wrangler · weather-wrangler.vercel.app · Station: {data.station.id} · {new Date().toLocaleString('en-AU')} ACST</p>
        </div>
      </div>

      <style>{`
        @media print { .no-print { display: none !important; } .print-only { display: block !important; } }
        .print-only { display: none; }
        @page { margin: 15mm; size: A4; }
      `}</style>
    </div>
  )
}
