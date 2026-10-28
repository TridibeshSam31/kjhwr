import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { gw, gwh, signedGw, ukDateTime, ukTime } from "../format";
import { useApi } from "../useApi";
import { AXIS, Card, GRID, gwTick, Loading, Tile, Tooltip } from "./common";

interface Row { time: string; actual?: number | null; forecast?: number | null; band?: [number, number] }

export default function DayAhead({ day, gate, corrected, windowDays }:
  { day: string; gate: string; corrected: boolean; windowDays: number }) {
  const { data, error } = useApi(() => api.day(day, gate, corrected), [day, gate, corrected]);
  if (!data) return <Loading error={error} />;

  // Merge 30-min actuals with hourly forecasts on a shared time axis.
  const byTime = new Map<string, Row>(data.actual.map((a) => [a.time, { time: a.time, actual: a.actual }]));
  for (const h of data.hourly) {
    const row = byTime.get(h.time) ?? { time: h.time };
    row.forecast = h.forecast;
    if (h.p10 != null && h.p90 != null) row.band = [h.p10, h.p90];
    byTime.set(h.time, row);
  }
  const rows = [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
  const leads = data.hourly.map((h) => h.lead).filter((x): x is number => x != null);
  const acc = data.accuracy;
  const label = corrected ? "Corrected forecast" : "Forecast";

  return (
    <>
      <div className="tiles">
        <Tile label="Forecast wind energy" value={gwh(data.energyMWh.forecast)}
          note={`Mean ${gw(data.energyMWh.forecast / 24)} across the day`} />
        <Tile label="Indicative low-wind energy" value={gwh(data.energyMWh.p10)}
          note="Sum of hourly forecasts shifted by the past P10 error. A historical-error estimate, not a calibrated daily probability bound" />
        <Tile label="Wind actually delivered" value={gwh(data.energyMWh.actual)}
          note="Known only after the day — shown for back-testing" />
        <Tile label="Forecast error on the day" value={signedGw(acc.bias)}
          note={`Average actual − forecast · typical miss ${gw(acc.mae)}`} />
      </div>

      <Card
        title={`Wind generation · forecast available at gate closure vs actual`}
        sub={<>Decision made at <strong>{ukDateTime(data.gateClosure)}</strong> (UK). Latest forecast then was published{" "}
          {data.forecastPublished.map(ukDateTime).join(", ")} — {Math.round(Math.min(...leads))}–{Math.round(Math.max(...leads))} h ahead.
          {corrected && <> Scaled ×{data.correctionFactor.toFixed(2)} from the last {windowDays} finished days.</>}</>}
      >
        <div className="legend">
          <span><i className="swatch" style={{ background: "var(--actual)" }} />Actual, GW (half-hourly)</span>
          <span><i className="swatch dash" />{label} (hourly)</span>
          <span><i className="swatch box" style={{ background: "var(--band)" }} />Historical error range (P10–P90)</span>
        </div>
        <div style={{ height: 340 }}>
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="time" tickFormatter={ukTime} interval={5} {...AXIS} />
              <YAxis tickFormatter={gwTick} width={40} {...AXIS} />
              <RTooltip
                cursor={{ stroke: "var(--axis)" }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as Row;
                  const tip = [{ label: "Actual", value: gw(r.actual, 2), color: "var(--actual)" }];
                  if (r.forecast != null) tip.push({ label, value: gw(r.forecast, 2), color: "var(--forecast)" });
                  if (r.band) tip.push({ label: "Historical range", value: `${gw(r.band[0])} – ${gw(r.band[1])}`, color: "" });
                  return <Tooltip title={ukTime(r.time)} rows={tip} />;
                }}
              />
              <Area dataKey="band" stroke="none" fill="var(--band)" connectNulls isAnimationActive={false} activeDot={false} />
              <Line dataKey="forecast" stroke="var(--forecast)" strokeWidth={2} strokeDasharray="5 3" dot={false}
                connectNulls isAnimationActive={false} />
              <Line dataKey="actual" stroke="var(--actual)" strokeWidth={2} dot={false} isAnimationActive={false}
                activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="sub" style={{ marginTop: 10, marginBottom: 0 }}>
          The shaded range adds the 10th and 90th percentile forecast errors (P10 {signedGw(data.band.p10)},
          P90 {signedGw(data.band.p90)}) from the previous {windowDays} settled delivery days, the ones known at decision time.
          It is an empirical historical range; its coverage has not been validated as a forecast interval.
        </p>
      </Card>
    </>
  );
}
