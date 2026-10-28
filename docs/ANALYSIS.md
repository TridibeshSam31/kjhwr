# Wind forecast accuracy: January 2026 pilot

**Question:** When the desk buys day-ahead power, how much should it trust the national wind forecast available
at that moment, and by how much is it typically wrong?

**Data:** Elexon BMRS. Actuals come from `FUELHH` (fuelType=WIND, half-hourly MW). Forecasts come from `WINDFOR`
(hourly MW, published 8 times a day, looking up to about 66 h ahead). The evaluation covers delivery days
2 Jan – 1 Feb 2026, which are the days bought in January: 744 hourly points.

**Method:** For each delivery day D we take the latest forecast published at or before **09:20 UK on D-1** (the
assumed gate closure). We then compare it with the actual at the same start time, using error = actual − forecast.

## Headline results (decision forecast, 09:20 gate)

| Metric | Elexon forecast | With bias correction |
|---|---|---|
| Mean absolute error | **2.02 GW** (18% of mean output) | **1.36 GW** (12%) |
| RMSE | 2.50 GW | 1.79 GW |
| Bias (actual − forecast) | **−1.75 GW** | −0.47 GW |
| P10 error | −4.15 GW | −3.17 GW |
| P90 error | +0.43 GW | +1.65 GW |
| Worst hourly shortfall | −6.89 GW | −5.00 GW |

Mean actual wind output over the period was 11.3 GW.

## Findings

1. **Actual wind averaged about 1.75 GW below the forecast.** The bias is present at every lead time, including
   0–3 h ahead (−1.4 GW), so it is not explained by weather uncertainty growing with lead time. FUELHH and WINDFOR
   alone cannot establish the cause. Hypotheses to investigate with Elexon/NESO: curtailment or constraint actions
   (metered output below what the wind allowed) and differences in what the two datasets cover.
2. **An exploratory correction removes much of it in back-test.** Each day, the forecast is scaled by the actual/forecast ratio of the
   last 14 finished days (D-2 back to D-15), which only uses data available at gate closure. That cuts MAE by **33%**.
   A multiplicative correction beat an additive one (MAE 1.36 vs 1.52 GW). Window length mattered: 7 days gave
   1.43 GW and 14 days gave 1.36 GW. This is one month of in-sample model selection, so treat it as a baseline to
   validate on more data, not as proof it will improve future trading.
3. **Error grows with lead time, but slowly.** MAE rises from 1.67 GW (0–3 h) to 2.36 GW (45–48 h). The desk's
   decisions sit at 17–40 h ahead. Moving the decision later in the day helps only a little: MAE is 2.00 GW for an
   11:00 gate and 1.86 GW for 16:00.
4. **The risk is asymmetric.** 90% of hours had a shortfall no worse than 4.2 GW, but over-delivery rarely exceeded
   0.4 GW. The P10 error (−4.2 GW raw, −3.2 GW corrected) is a useful reference for sizing shortfall cover, but it
   is an hourly historical statistic, not a calibrated bound.
5. **Errors cluster on a few days.** The worst days were 28 Jan (MAE 5.3 GW), 12 Jan and 11 Jan (4.9 GW), while
   the best days were under 0.9 GW. Night-time hours (02:00–06:00) are about 0.6 GW worse than the evening.

## Limitations and next steps

- One month of winter data: errors are seasonal, so the correction and band should be re-fitted on a rolling basis.
- Wind only and national only (by design for the pilot). Solar and embedded generation would be the next additions.
- Comparing hourly forecasts with the half-hour starting at the same time ignores the second half-hour. An
  hour-average comparison is a possible refinement.
- The app's P10/P90 band uses the previous 14 settled days' errors (past-only), pooled across lead times. Its
  coverage has not been validated. Summing hourly P10s into a daily energy figure is indicative only, because hourly
  errors are correlated. Lead-dependent or
  weather-regime-dependent bands would be sharper.
- Production: scheduled ingestion into a database, alerting when a new forecast run shifts materially before gate
  closure, and validating the correction on a longer back-test.
