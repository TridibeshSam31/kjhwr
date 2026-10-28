# Demo video outline (≤ 10 min total)

## Part 1: client pitch (≤ 5 min)

1. **Problem (30 s).** "Every morning you lock in tomorrow's purchases before the wind is known. How much wind can
   you count on, and how wrong could the forecast be?"
2. **Day-ahead decision tab (1.5 min).** Pick 15 Jan.
   - The forecast shown is exactly the one available at 09:20 on 14 Jan (published 07:30), with no hindsight.
   - Tiles: forecast energy, *indicative low-wind energy*, actual delivered.
   - The shaded band is a historical error range from the previous 14 settled days, so no later data is used.
   - Step to 28 Jan, the worst day, to show the actual falling far below the forecast.
3. **Forecast accuracy tab (2 min).**
   - Typical miss: 2.0 GW, 18% of output.
   - **The big finding:** actual wind averaged about 1.75 GW below the public forecast, even hours ahead. The cause
     needs investigating; curtailment is one hypothesis.
   - Tick *Bias-corrected forecast*: an exploratory correction cut the error by 33% in back-test, using only data
     you'd have had that morning. It needs more data before relying on it.
   - The lead-time chart shows that delaying the decision barely helps; the distribution shows the downside risk.
     Downside misses are much larger than upside ones.
4. **Close (30 s).** Pilot value: quantified risk on every purchase. Next steps: live data feed, solar, alerts when a
   new forecast run moves.

## Part 2: tech-lead review (≤ 5 min)

1. **Architecture (1 min).** React + Vite + Recharts → FastAPI (pure Python) → JSON snapshot from Elexon. Docker
   Compose runs two services (FastAPI backend; nginx serving the UI and proxying /api); Vercel serves a static UI
   plus a Python function. Show the README table.
2. **Core logic (1.5 min).** `analysis.py`:
   - `gate_closure()`: UK local time to UTC, DST-safe.
   - `Dataset.latest_forecast()`: bisect over publish times, the no-look-ahead rule.
   - `correction_factor()`: only uses D-2 and earlier; explain why D-1 is excluded.
   - `error_band()`: leave-one-day-out.
3. **Data quirks (45 s).** Hourly forecast vs half-hourly actuals; 8 runs a day at fixed times; forecasts published
   after the target time are dropped; the sign convention.
4. **Practices (1 min).** Pure functions plus a thin API layer; typed frontend API client; unit tests on synthetic
   data, including the look-ahead and DST cases; API smoke tests on real data; memoised reports; snapshot for
   determinism; `fetch_data.py` to refresh. AI-assisted, as disclosed in the README.
5. **Trade-offs and next steps (45 s).** Snapshot vs a live DB, pooled vs lead-dependent bands, hour-average
   comparison, CI pipeline.
