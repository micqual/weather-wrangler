import Link from 'next/link'

export default function MethodologyPage() {
  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px', maxWidth: 860, margin: '0 auto' }}>
      <Link href="/" style={{ color: 'var(--text-muted)', fontSize: 14, textDecoration: 'none' }}>← My Paddocks</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '12px 0 4px' }}>
        <span style={{ color: 'var(--orange)' }}>Methodology</span>
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 32px' }}>
        How each value is calculated — sources, assumptions, and limitations.
      </p>

      <Section title="🌦️ Weather & Monitoring">
        <Item title="Daily Rain (Today)">
          The WS90 tipping bucket gauge reports a cumulative rain total that resets at local midnight (AEST/AEDT, daylight saving handled automatically). Today's rain = latest reading minus the first reading after midnight. Rain measurement accuracy varies by intensity: ±20% below 5 mm/h, ±10% between 5–50 mm/h, ±20% above 50 mm/h (manufacturer specification).
        </Item>
        <Item title="Delta T">
          Wet bulb depression, calculated from air temperature and relative humidity using the Magnus formula approximation for wet bulb temperature. Optimal spray range is 2–8°C Delta T (GRDC spray guidelines). Below 2°C indicates inversion risk; above 10°C indicates rapid droplet evaporation.
        </Item>
        <Item title="Evapotranspiration (ETo)">
          FAO-56 Penman-Monteith reference evapotranspiration (Allen et al., 1998). Inputs: temperature (max, min, average), humidity, wind speed, solar radiation. Solar radiation is estimated from the light sensor (lux ÷ 120 to convert to W/m²) which is accurate to approximately ±15%. Where no lux data is available, the Hargreaves temperature-based method is used. ETo is a reference value for short grass — crop-specific coefficients (Kc) are not applied.
        </Item>
        <Item title="7-Day Forecast">
          Sourced from Open-Meteo (open-meteo.com) using the BOM ACCESS-G numerical weather prediction model. Updated every 15 minutes. Forecast accuracy decreases beyond 3–4 days. Not suitable for safety-critical decisions.
        </Item>
        <Item title="Yesterday's BOM Data">
          ERA5 reanalysis data via Open-Meteo archive API. ERA5 is a global atmospheric reanalysis produced by ECMWF, assimilating BOM observations. Typically available with a 1–2 day lag. Grid resolution approximately 25 km — local effects (topography, irrigation) may not be captured.
        </Item>
        <Item title="Nearest BOM Station">
          Identified using a straight-line haversine distance calculation from the paddock's GPS coordinates to a curated list of ~20 Mallee and surrounds BOM observation stations. The listed station is the closest by distance — it is not necessarily the most representative for the paddock's microclimate.
        </Item>
        <Item title="Field Trafficability">
          Estimated from recent rainfall (last 24h and 72h), days since last rain, soil type, and evapotranspiration rate. Soil drainage rate is classified as fast (sandy), medium (loam), or slow (clay). Thresholds are indicative — actual trafficability depends on subsoil moisture, traffic load, and wheel configuration. Always make a visual assessment before driving.
        </Item>
      </Section>

      <Section title="❄️ Frost & Heat Stress">
        <Item title="Frost Risk">
          Based on current air temperature, dew point, and time of day. Watch: temp ≤ alert threshold + 6°C between 10pm–9am. Warning: temp ≤ alert threshold between 10pm–9am. Frost: temp ≤ 0°C. Dew point estimated from temperature and relative humidity using the Magnus formula. Alert temperature is set per crop type (default 2°C for wheat/barley at flowering). This is a monitoring indicator only — actual frost damage depends on growth stage, radiation conditions, and canopy temperature which differs from air temperature.
        </Item>
        <Item title="Heat Stress">
          Thresholds based on GRDC published guidelines for Australian winter cereals: Watch ≥28°C, Stress ≥31°C (sterility risk), Severe ≥35°C. Most critical during flowering and grain fill. Growth stage is used to flag increased risk during sensitive periods.
        </Item>
      </Section>

      <Section title="🌿 Spray Window">
        <Item title="Spray Window Assessment">
          Based on GRDC spray application guidelines. Conditions assessed: Delta T (2–8°C optimal), wind speed (3–20 km/h optimal, inversion risk below 3 km/h or below 11 km/h at night), temperature (caution above 28°C, stop above 35°C), humidity (caution below 30%, stop below 20%). Gust factor flagged when gusts exceed average by more than 33%. Overall status is the worst of all individual conditions. Not a substitute for label requirements or professional agronomic advice.
        </Item>
      </Section>

      <Section title="🌱 Growing Degree Days & Harvest Estimate">
        <Item title="Growing Degree Days (GDD)">
          Accumulated heat units since planting. Daily GDD = max(0, daily average temperature − base temperature). Base temperature is set per crop type (4°C for wheat and barley, consistent with Australian extension recommendations). Daily average temperature is calculated from all readings within each calendar day (Melbourne time).
        </Item>
        <Item title="Estimated Harvest Date">
          Projected by extrapolating the current daily GDD accumulation rate forward until the crop-specific target GDD is reached. The target GDD represents physiological maturity for that variety. Estimate accuracy depends on: (1) accuracy of the target GDD value, (2) consistency of future temperatures with the historical average rate, and (3) planting date accuracy. This is a guide only — consult your agronomist for harvest timing decisions.
        </Item>
      </Section>

      <Section title="🧪 Nitrogen Budget">
        <Item title="N Budget">
          Total available N = soil N (from latest soil test, NO₃ + NH₄) + retained applied N (after losses). Does not account for mineralisation of organic N, which can be significant in high-organic-carbon soils.
        </Item>
        <Item title="Nitrogen Volatilization Loss">
          Estimated using a practical extension model consistent with the key factors in the APSIM volatilization model. Key factors: product type (urea-based products only), incorporation status, temperature, humidity, and days to rain after application. Incorporated urea: ~2% loss. Surface-applied urea: 5–40% depending on conditions, with rain within 24 hours reducing loss significantly. This is an estimate — the full APSIM mechanistic model requires soil CEC and pH inputs not available from a weather station.
        </Item>
        <Item title="Nitrogen Leaching Loss">
          Estimated from total rainfall since application and soil drainage class. Sandy soils are assigned higher leaching coefficients than clay soils. Significant leaching risk at &gt;50mm rainfall after application. This is a simplified model — actual leaching depends on soil water content, rainfall intensity, and root zone depth.
        </Item>
        <Item title="Crop N Usage">
          Estimated as a fixed daily drawdown: total N required (yield target × N requirement per tonne) ÷ days from planting to estimated harvest. Default N requirement is 40 kg N per tonne of grain yield for wheat and barley (GRDC rule of thumb). This is a simplification — actual N uptake is non-linear and peaks around stem elongation.
        </Item>
      </Section>

      <Section title="📈 Yield Potential">
        <Item title="Water-Limited Yield (French-Schultz / Sadras-Angus)">
          Y = (Stored Soil Water + Growing Season Rainfall − Evaporation Coefficient) × WUE. Evaporation coefficient = 110 mm (opening rainfall lost to evaporation). WUE (Water Use Efficiency) default = 17 kg grain/mm water, set per crop type. Based on French and Schultz (1984) as extended by Sadras and Angus (2006). This framework is widely used in Australian dryland agronomy and underpins Yield Prophet Lite.
        </Item>
        <Item title="Nitrogen-Limited Yield">
          Y = Total Available N ÷ N requirement per tonne. Capped at water-limited yield when both are available. N requirement default = 40 kg N/tonne (wheat/barley).
        </Item>
        <Item title="Mitscherlich Yield Curve">
          Y = A × (1 − e^(−c(x+b))). A = maximum attainable yield (water-limited), x = applied N (kg/ha), b = soil N (kg/ha), c = efficiency constant (default 0.03 for dryland cereals). The 95% optimal N rate is where the curve reaches 95% of maximum yield. Economic optimum N = the point where marginal revenue (grain price × yield response) equals marginal cost (N fertiliser cost). Reference: Mitscherlich (1909), adapted for Australian dryland cereals.
        </Item>
      </Section>

      <Section title="🧫 Phosphorus Interpretation">
        <Item title="Critical Colwell P">
          Critical Colwell P = 4.6 × PBI^0.393 (Moody, 2007). This is the Colwell P value required to achieve 90% of maximum yield. The formula accounts for the Phosphorus Buffer Index (PBI) which measures how strongly the soil retains phosphorus. Source: GRDC Update Papers 2020 and 2022.
        </Item>
        <Item title="Phosphorus Buffer Index (PBI) Class">
          PBI classes: Very Very Low (&lt;35), Very Low (35–70), Low (70–140), Moderate (140–280), High (280–840), Very High (&gt;840). Higher PBI soils require more P fertiliser to raise Colwell P by one unit.
        </Item>
        <Item title="Capital P Required">
          Estimated deficit between measured Colwell P and critical Colwell P, adjusted for PBI. Approximately 1 kg P/ha raises Colwell P by ~1 mg/kg in a 0–10cm layer on low-PBI soils; more P is required per unit change on high-PBI soils. DAP equivalent calculated at 18% P content. These are indicative estimates — soil test calibration trials for your specific soil are the most reliable guide.
        </Item>
        <Item title="P Build-Up Factor (Maintenance P)">
          When Colwell P is at or above critical, maintenance P = grain yield × P export rate. Wheat and barley export approximately 3.0 kg P per tonne of grain; canola approximately 5.0 kg P per tonne. Source: GRDC nutrient removal guidelines.
        </Item>
      </Section>

      <Section title="⚗️ Soil Chemistry">
        <Item title="pH Interpretation (CaCl₂)">
          Optimal pH range: 5.5–7.0 for wheat/barley, 5.8–7.5 for canola, 6.0–7.0 for legumes (all in CaCl₂). pH CaCl₂ reads approximately 0.7 units lower than pH in water. Below pH 4.8, aluminium and manganese toxicity are likely. Source: GRDC Soil Acidification guidelines and DPIRD pH management fact sheets.
        </Item>
        <Item title="Lime Requirement Calculator">
          Estimated lime rate to raise pH to target. Based on GRDC lime management guidelines for southern Australia. Soil buffering coefficients: sandy 0.8 t/ha per pH unit, loam 1.5, clay 2.5. Adjusted for lime Neutralising Value (NV). These are approximations — actual lime requirements vary with soil organic matter, clay mineralogy, and existing lime reserves. A buffer pH test gives a more accurate site-specific lime requirement.
        </Item>
        <Item title="Sulphur (KCl40 method)">
          Critical level: 8 mg/kg for cereals, ~10 mg/kg for canola. Source: Agriculture Victoria soil test guidelines and GRDC Update Papers 2016. Sulphur is mobile in soil — deep sampling (0–60 cm) is recommended for accurate assessment.
        </Item>
        <Item title="Chloride">
          Chloride is primarily a salinity/toxicity indicator in Australian dryland soils, not a deficiency nutrient. Thresholds: &lt;60 mg/kg — no concern, 60–120 mg/kg — monitor, 120–200 mg/kg — yield risk, &gt;200 mg/kg — toxic range. Source: SA PIRSA soil testing guidelines. Barley is more tolerant of chloride than wheat or canola.
        </Item>
      </Section>

      <Section title="🌾 Disease Risk">
        <Item title="Disease Risk Indicators (Wheat & Barley)">
          Conditions assessed for stripe rust (optimal 8–15°C, leaf wetness required), stem/leaf rust (15–30°C, high humidity), septoria tritici blotch (10–25°C, rain splash), and powdery mildew (15–22°C, high humidity, less rain). Leaf wetness is estimated from humidity ≥95% or recent rainfall. These are environmental risk indicators only — they do not account for variety resistance ratings, fungicide history, or inoculum load. Source: GRDC Tips & Tactics for disease management.
        </Item>
      </Section>

      <div style={{ marginTop: 40, padding: '16px 0', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
        <p>All calculations are intended as decision-support tools for qualified agronomists and experienced growers. They do not replace site-specific agronomic advice, calibrated soil test interpretation services, or professional recommendations.</p>
        <p style={{ marginTop: 8 }}>Key references: Allen et al. (1998) FAO-56; French & Schultz (1984); Sadras & Angus (2006); Moody (2007); GRDC publications as cited. Contact <a href="mailto:mdpankhurst@gmail.com" style={{ color: 'var(--orange)' }}>mdpankhurst@gmail.com</a> for questions about specific calculations.</p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px', color: 'var(--text)' }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {children}
      </div>
    </div>
  )
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--orange)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}
