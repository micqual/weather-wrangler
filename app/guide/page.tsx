import Link from 'next/link'
import PrintButton from '@/app/report/PrintButton'

export default function GuidePage() {
  return (
    <div style={{ fontFamily: 'Georgia, serif', maxWidth: 860, margin: '0 auto', padding: '0 24px', color: '#1a1a1a', background: '#fff', minHeight: '100vh' }}>

      <div className="no-print" style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', marginBottom: 32 }}>
        <Link href="/" style={{ color: '#666', fontSize: 13, textDecoration: 'none' }}>← My Paddocks</Link>
        <PrintButton />
      </div>

      {/* ── FARMER GUIDE ── */}
      <div style={{ marginBottom: 64 }}>
        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>User Guide</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 4px' }}>Weather Wrangler</h1>
        <h2 style={{ fontSize: 18, fontWeight: 400, color: '#444', margin: '0 0 32px' }}>Farmer Guide</h2>

        <GSection title="Getting started">
          <p>Your Weather Wrangler dashboard is available at <strong>weather-wrangler.vercel.app</strong>. Log in with your email and password provided by your agronomist. Bookmark the page or add it to your phone home screen for quick access.</p>
          <p>The QR code on your weather station takes you directly to a public page showing live temperature, humidity, wind and rain — no login needed.</p>
        </GSection>

        <GSection title="My Paddocks — the main dashboard">
          <p>Each card represents one paddock. You will see:</p>
          <GList items={[
            'Paddock name and how long ago the last reading was received',
            'Temperature, humidity, wind speed and direction, and today\'s rainfall',
            'WS battery, Node battery, and solar charging status',
            'Field conditions — ET, Delta T, spray window, frost risk, field trafficability, disease risk',
            'Crop progress — GDD accumulated since planting and estimated harvest date',
          ]} />
          <p>Tap any of the four weather boxes to see the weather history page with date range charts.</p>
        </GSection>

        <GSection title="Field conditions explained">
          <GTable rows={[
            ['Evapotranspiration (ET)', 'How much water the crop is using today (mm/day).'],
            ['Delta T', 'Wet bulb depression. Optimal spray range is 2–8°C.'],
            ['Spray window', 'Combines Delta T, wind, temperature and humidity. Shows failing conditions when not suitable.'],
            ['Frost risk', 'Based on temperature, dew point and time of day.'],
            ['Field trafficability', 'Can you drive on it? Based on recent rainfall, soil type and ET drying rate.'],
            ['Disease risk', 'Environmental conditions favouring stripe rust, stem rust, septoria or powdery mildew (wheat/barley).'],
          ]} />
        </GSection>

        <GSection title="Weather history">
          <p>Tap any weather reading on the dashboard to open the history page. Shows daily charts for temperature, humidity, wind and rainfall across any date range you select. Use the quick shortcuts (48h, 7d, 14d, 30d) or enter a custom date range.</p>
        </GSection>

        <GSection title="Crop progress (GDD)">
          <p>Growing Degree Days measure accumulated heat since planting. Daily GDD = average temperature minus the base temperature (4°C for wheat and barley). When the total reaches the variety target, the crop is at maturity. Where the station was installed after sowing, GDD is gap-filled using BOM historical temperature data for the paddock location.</p>
        </GSection>

        <GSection title="The paddock page">
          <p>Tap the paddock name to open the paddock detail page where you can set crop type, planted date, soil type, paddock size, target and actual yield, stored soil water, and organic carbon. You can also add zones, nitrogen applications, soil tests, irrigation records, historical rain, and paddock boundary maps.</p>
        </GSection>

        <GSection title="Other pages">
          <GTable rows={[
            ['Nitrogen', 'N budget gauge, yield potential, N loss timeline since planting.'],
            ['Agronomy', 'Mitscherlich yield curve, seasonal water budget, rainfall decile yield chart.'],
            ['Forecast', '7-day BOM forecast + yesterday BOM comparison for your paddock location.'],
            ['Report', 'Monthly farm report — printable, covers weather, N, soil tests and station health.'],
            ['Methodology', 'How every value is calculated with sources and limitations.'],
          ]} />
        </GSection>
      </div>

      {/* ── AGRONOMY GUIDE ── */}
      <div style={{ pageBreakBefore: 'always', marginBottom: 64 }}>
        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Agronomy Guide</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 4px' }}>Weather Wrangler</h1>
        <h2 style={{ fontSize: 18, fontWeight: 400, color: '#444', margin: '0 0 32px' }}>Reading the Agronomy Page</h2>

        <GSection title="Overview">
          <p>The Agronomy page combines soil test data, nitrogen applications, rainfall records and weather station data to estimate yield potential and the economic optimum nitrogen rate. It uses the same French-Schultz / Sadras-Angus framework as Yield Prophet® Lite.</p>
        </GSection>

        <GSection title="Key numbers">
          <GTable rows={[
            ['Soil test N', 'NO₃ + NH₄ from latest soil test in kg N/ha.'],
            ['OC mineralisation', 'Estimated N from organic matter — OC% × 20 kg N/ha.'],
            ['N applied at sowing', 'Retained N from applications on or before planting date.'],
            ['N applied after sowing', 'Retained N from applications after planting date.'],
            ['Total available N', 'Sum of all N sources after losses.'],
            ['Water-limited yield', 'Maximum yield possible given water supply — regardless of N.'],
            ['N-limited yield', 'Predicted yield given current total available N.'],
            ['95% optimal N', 'N rate that achieves 95% of maximum yield.'],
            ['Economic optimum', 'Most profitable N rate — where marginal return equals marginal cost.'],
          ]} />
        </GSection>

        <GSection title="The Mitscherlich yield curve">
          <p>The orange curve shows predicted yield at different N application rates. It rises steeply at low N then flattens.</p>
          <GList items={[
            'Green line — your current N position and predicted yield',
            'Purple dashed — 95% optimal N rate',
            'Amber dotted — economic optimum',
            'Slider — drag to estimate yield at any N rate',
          ]} />
        </GSection>

        <GSection title="Seasonal water budget">
          <GList items={[
            'Fallow (Nov 1 → planting) — 25% of rainfall contributes to stored soil water',
            'Growing season (planting → today) — 80% efficiency, uses WW station data where available',
            'Remaining forecast — BOM 7-day forecast + 10-year monthly averages beyond that',
            'Less 60mm evaporation (updated from original 110mm, Harries et al. 2022)',
          ]} />
          <p>Use the season adjustment slider (±30%) to reflect current seasonal outlook.</p>
        </GSection>

        <GSection title="Rainfall decile yield chart">
          <p>Shows yield potential across five rainfall scenarios based on 30 years of historical growing season rainfall. Dark bar = water-limited yield (unlimited N). Light bar = yield with current N. Recommended N shown to reach water-limited potential for each scenario.</p>
          <p>In low rainfall years (decile 1-2), extra N will not improve yield — water is limiting. In high rainfall years, N becomes limiting and additional investment is justified.</p>
        </GSection>

        <GSection title="What to do">
          <GList numbered items={[
            'Check your N gap — if N-limited yield is below water-limited yield, consider a topdress',
            'Compare to economic optimum — if left of the amber line, a profitable N response is likely available',
            'Use the decile chart — match N investment to the rainfall scenario most likely this season',
            'Adjust season outlook slider if seasonal forecast is unusually wet or dry',
            'Verify inputs — soil test data, planting date, and stored soil water must be entered accurately',
          ]} />
        </GSection>

        <GSection title="Limitations">
          <GList items={[
            'Single soil layer model — does not track water through soil profile',
            'No pest, disease or frost adjustment',
            'OC mineralisation is a fixed estimate',
            'For full probabilistic APSIM simulation use Yield Prophet® at yieldprophet.com.au',
          ]} />
          <p>Results are indicative only — not a substitute for professional agronomic advice.</p>
        </GSection>
      </div>

      {/* ── ADMIN SETUP GUIDE ── */}
      <div style={{ pageBreakBefore: 'always' }}>
        <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Admin Guide</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 4px' }}>Weather Wrangler</h1>
        <h2 style={{ fontSize: 18, fontWeight: 400, color: '#444', margin: '0 0 32px' }}>Setting Up a New Farmer</h2>

        <GSection title="Overview">
          <p>Setting up a new farmer involves four steps: registering the station hardware, creating the farmer login, creating their farm, and linking the paddock. Each step is done from the Admin page.</p>
        </GSection>

        <GSection title="Step 1 — Register the station">
          <GList numbered items={[
            'Go to Admin → Setup tab → Register a station',
            'Enter the Station ID (e.g. node_3) — must match the ESP32 firmware exactly',
            'Enter the WS90 serial number from the device label',
            'Enter GPS coordinates — right-click the install location in Google Maps',
            'Click Register station',
          ]} />
        </GSection>

        <GSection title="Step 2 — Create farmer login">
          <GList numbered items={[
            'Go to Admin → Farmers tab → Create a farmer login',
            'Enter farmer name, email, and temporary password',
            'Click Create login and give the farmer their credentials',
          ]} />
        </GSection>

        <GSection title="Step 3 — Create farm and link paddock">
          <GList numbered items={[
            'Admin → Farmers tab → Create a farm — select farmer, enter farm name',
            'Admin → Setup tab → Add a paddock — select station and farm, enter paddock name',
            'The paddock now appears on the farmer dashboard',
          ]} />
        </GSection>

        <GSection title="Step 4 — Enter opening data">
          <p>On the paddock page set: crop type, planted date, soil type, hectares, target yield, stored soil water, organic carbon. Enter opening soil tests (N, P, pH) in the Soil Tests section. These feed directly into the N budget and agronomy calculations.</p>
        </GSection>

        <GSection title="Subscription management">
          <p>Go to Admin → Farmers tab → Farmer subscriptions. Set tier (Base/Mid/Pro), expiry date, and payment reference. The dashboard shows a warning banner when subscription is within 14 days of expiry and enters a 2-week grace period after expiry before locking Pro features.</p>
        </GSection>
      </div>

      <div style={{ borderTop: '1px solid #ddd', marginTop: 40, paddingTop: 12, fontSize: 11, color: '#aaa' }}>
        Weather Wrangler · weather-wrangler.vercel.app · info@weatherwrangler.net · +61 422 490 254
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
        @page { margin: 20mm; }
        p { margin: 0 0 12px; line-height: 1.7; font-size: 14px; color: #333; }
      `}</style>
    </div>
  )
}

function GSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px', paddingBottom: 6, borderBottom: '1px solid #eee' }}>{title}</h3>
      {children}
    </div>
  )
}

function GList({ items, numbered }: { items: string[]; numbered?: boolean }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 14, color: '#333', lineHeight: 1.6 }}>
          <span style={{ flexShrink: 0, color: '#888', minWidth: 20 }}>{numbered ? `${i + 1}.` : '·'}</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

function GTable({ rows }: { rows: [string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
      <tbody>
        {rows.map(([term, def], i) => (
          <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, whiteSpace: 'nowrap', verticalAlign: 'top', width: 200 }}>{term}</td>
            <td style={{ padding: '8px 0', color: '#444', lineHeight: 1.6 }}>{def}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
