import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { api, type AccuracyReport, type Stats } from "../api";
import { gw, pct, shortDay, signedGw } from "../format";
import { useApi } from "../useApi";
import { AXIS, Card, GRID, gwTick, Loading, Tile, Tooltip } from "./common";

export default function Accuracy({ gate, corrected, onPickDay }:
  { gate: string; corrected: boolean; onPickDay: (d: string) => void }) {
  const raw = useApi(() => api.accuracy(gate, false), [gate]);
  const cor = useApi(() => api.accuracy(gate, true), [gate]);
  if (!raw.data || !cor.data) return <Loading error={raw.error ?? cor.error} />;
  const r = corrected ? cor.data : raw.data;
  const o = r.overall;
  const which = corrected ? "corrected forecast" : "forecast";
  const improvement = 1 - cor.data.overall.mae / raw.data.overall.mae;

  return (
    <>
      <div className="tiles">
        <Tile label="Typical hourly miss (MAE)" value={gw(o.mae, 2)}
          note={`${pct(o.nmae)} of average wind output (${gw(o.meanActual)})`} />
        <Tile label="Systematic bias" value={signedGw(o.bias, 2)}
          note={o.bias < 0 ? "Wind came in below forecast on average" : "Wind came in above forecast on average"} />
        <Tile label="Plan-for shortfall (P10)" value={signedGw(o.p10, 1)}
          note="In 9 of 10 hours the shortfall vs forecast was no worse than this" />
        <Tile label="Worst hourly shortfall" value={signedGw(o.maxShortfall, 1)} note={`Across ${o.n} hours in the pilot`} />
      </div>

      <Card title="What this means for the buying desk">
        <ul className="insights">
          <li>Using the {which} available at {gate} on D-1 (lead time {Math.round(r.leadRange[0])}–{Math.round(r.leadRange[1])} h),
            a typical hour is off by <strong>{gw(o.mae)}</strong>; the RMSE is {gw(o.rmse)}.</li>
          <li>The raw Elexon forecast <strong>over-states wind by {gw(-raw.data.overall.bias)}</strong> on average — even a few hours
            ahead. Constraint/curtailment of wind farms is a likely driver: a forecast of
            what the wind <em>could</em> produce is not what is metered.</li>
          <li>A simple, look-ahead-free correction (scale by the last 14 finished days' actual/forecast ratio) cuts the
            typical miss by <strong>{pct(improvement)}</strong>: {gw(raw.data.overall.mae, 2)} → {gw(cor.data.overall.mae, 2)}.</li>
          <li>Errors are skewed to the downside: hedge to the <strong>P10</strong> level ({signedGw(o.p10)} from forecast)
            rather than the forecast itself when shortfalls are costly.</li>
        </ul>
      </Card>

      <div className="grid2">
        <Card title="Accuracy vs how far ahead the forecast was made"
          sub="All forecasts for January delivery days, grouped in 3-hour lead-time buckets, in GW. Dashed lines: your decision window.">
          <LeadChart r={r} />
        </Card>
        <Card title="Distribution of hourly errors" sub="Actual − forecast, 1 GW bins. Left of zero = shortfall to cover.">
          <Histogram r={r} />
        </Card>
      </div>

      <div className="grid2">
        <Card title="Error by delivery day" sub="Mean absolute error per day, GW. Click a bar to open that day.">
          <DayChart r={r} onPickDay={onPickDay} />
        </Card>
        <Card title="Error by hour of day" sub="Mean absolute error by UK delivery hour, GW.">
          <HourChart r={r} />
        </Card>
      </div>

      <div className="grid2">
        <Card title="Raw vs corrected forecast" sub={`Decision forecast at ${gate} UK on D-1, all ${o.n} January hours.`}>
          <Compare raw={raw.data.overall} cor={cor.data.overall} />
        </Card>
      </div>
    </>
  );
}

const statTip = (title: string, s: Stats) => (
  <Tooltip title={title} rows={[
    { label: "MAE", value: gw(s.mae, 2) },
    { label: "Bias", value: signedGw(s.bias, 2) },
    { label: "P10 / P90", value: `${signedGw(s.p10)} / ${signedGw(s.p90)}` },
    { label: "Hours", value: String(s.n) },
  ]} />
);

function LeadChart({ r }: { r: AccuracyReport }) {
  const data = r.byLead.map((b) => ({ ...b, mid: b.leadFrom + 1.5 }));
  return (
    <>
      <div className="legend">
        <span><i className="swatch" style={{ background: "var(--actual)" }} />MAE</span>
        <span><i className="swatch" style={{ background: "var(--forecast)" }} />P10 shortfall (absolute)</span>
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 14 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="mid" type="number" domain={[0, 48]} ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]} {...AXIS}
              label={{ value: "Hours ahead", position: "insideBottom", dy: 14, fill: "var(--muted)", fontSize: 12 }} />
            <YAxis tickFormatter={gwTick} width={40} {...AXIS} domain={[0, "auto"]} />
            {/* Decision window */}
            <ReferenceLine x={r.leadRange[0]} stroke="var(--axis)" strokeDasharray="3 3" />
            <ReferenceLine x={r.leadRange[1]} stroke="var(--axis)" strokeDasharray="3 3"
              label={{ value: "decision window", position: "insideTopRight", fill: "var(--muted)", fontSize: 11 }} />
            <RTooltip content={({ active, payload }) => active && payload?.length
              ? statTip(`${payload[0].payload.leadFrom}–${payload[0].payload.leadTo} h ahead`, payload[0].payload) : null} />
            <Line dataKey="mae" stroke="var(--actual)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey={(d: Stats) => -d.p10} name="p10" stroke="var(--forecast)" strokeWidth={2} dot={{ r: 3 }}
              isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

function Histogram({ r }: { r: AccuracyReport }) {
  return (
    <div style={{ height: 284 }}>
      <ResponsiveContainer>
        <BarChart data={r.histogram} margin={{ top: 8, right: 8, left: 0, bottom: 14 }} barCategoryGap={2}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="from" tickFormatter={(v) => `${v / 1000}`} {...AXIS}
            label={{ value: "GW (actual − forecast)", position: "insideBottom", dy: 14, fill: "var(--muted)", fontSize: 12 }} />
          <YAxis width={40} {...AXIS} />
          <RTooltip cursor={{ fill: "var(--grid)" }} content={({ active, payload }) => active && payload?.length ? (
            <Tooltip title={`${signedGw(payload[0].payload.from)} to ${signedGw(payload[0].payload.to)}`}
              rows={[{ label: "Hours", value: String(payload[0].payload.count) }]} />) : null} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {r.histogram.map((b) => <Cell key={b.from} fill={b.from < 0 ? "var(--forecast)" : "var(--actual)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DayChart({ r, onPickDay }: { r: AccuracyReport; onPickDay: (d: string) => void }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={r.byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="day" tickFormatter={shortDay} interval={6} {...AXIS} />
          <YAxis tickFormatter={gwTick} width={40} {...AXIS} />
          <RTooltip cursor={{ fill: "var(--grid)" }}
            content={({ active, payload }) => active && payload?.length ? statTip(shortDay(payload[0].payload.day), payload[0].payload) : null} />
          <Bar dataKey="mae" fill="var(--actual)" radius={[4, 4, 0, 0]} isAnimationActive={false} cursor="pointer"
            onClick={(d: { day: string }) => onPickDay(d.day)} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourChart({ r }: { r: AccuracyReport }) {
  return (
    <div style={{ height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={r.byHour} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`} interval={3} {...AXIS} />
          <YAxis tickFormatter={gwTick} width={40} {...AXIS} />
          <RTooltip cursor={{ fill: "var(--grid)" }}
            content={({ active, payload }) => active && payload?.length
              ? statTip(`${String(payload[0].payload.hour).padStart(2, "0")}:00 UK`, payload[0].payload) : null} />
          <Bar dataKey="mae" fill="var(--actual)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Compare({ raw, cor }: { raw: Stats; cor: Stats }) {
  const rows: [string, (s: Stats) => string][] = [
    ["Mean absolute error", (s) => gw(s.mae, 2)],
    ["Root mean square error", (s) => gw(s.rmse, 2)],
    ["Bias (actual − forecast)", (s) => signedGw(s.bias, 2)],
    ["MAE as % of mean output", (s) => pct(s.nmae)],
    ["P10 error (plan-for shortfall)", (s) => signedGw(s.p10, 2)],
    ["P90 error", (s) => signedGw(s.p90, 2)],
    ["Worst hourly shortfall", (s) => signedGw(s.maxShortfall, 2)],
  ];
  return (
    <div className="scroll">
      <table className="data">
        <thead><tr><th>Metric</th><th>Elexon forecast</th><th>Corrected</th></tr></thead>
        <tbody>{rows.map(([k, f]) => <tr key={k}><td>{k}</td><td>{f(raw)}</td><td>{f(cor)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
