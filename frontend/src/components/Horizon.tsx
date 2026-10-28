import { useState } from "react";
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { gw, ukDateTime, ukTime } from "../format";
import { useApi } from "../useApi";
import { AXIS, Card, GRID, gwTick, Loading, Tooltip } from "./common";

export default function Horizon({ day }: { day: string }) {
  const [hours, setHours] = useState(24);
  const fc = useApi(() => api.horizon(day, hours), [day, hours]);
  const dv = useApi(() => api.day(day, "09:20", false), [day]); // reuse for actuals
  if (!fc.data || !dv.data) return <Loading error={fc.error ?? dv.error} />;

  const fcByTime = new Map(fc.data.hourly.map((h) => [h.time, h]));
  const rows = dv.data.actual.map((a) => ({ ...a, forecast: fcByTime.get(a.time)?.forecast ?? null,
    published: fcByTime.get(a.time)?.published ?? null }));

  return (
    <Card
      title="Forecast horizon explorer"
      sub="For each hour, shows the latest forecast published at least N hours before that hour. Drag the slider to see how the forecast sharpens as delivery approaches."
    >
      <div className="controls" style={{ marginBottom: 12 }}>
        <label>
          Published at least <strong style={{ minWidth: 36, color: "var(--ink)" }}>{hours} h</strong> ahead
          <input type="range" min={0} max={48} step={1} value={hours} onChange={(e) => setHours(+e.target.value)}
            aria-label="Forecast horizon in hours" />
        </label>
      </div>
      <div className="legend">
        <span><i className="swatch" style={{ background: "var(--actual)" }} />Actual, GW</span>
        <span><i className="swatch dash" />Forecast ≥ {hours} h ahead</span>
      </div>
      <div style={{ height: 340 }}>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="time" tickFormatter={ukTime} interval={5} {...AXIS} />
            <YAxis tickFormatter={gwTick} width={40} {...AXIS} />
            <RTooltip cursor={{ stroke: "var(--axis)" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const r = payload[0].payload as (typeof rows)[number];
                const tip = [{ label: "Actual", value: gw(r.actual, 2), color: "var(--actual)" }];
                if (r.forecast != null) tip.push({ label: "Forecast", value: gw(r.forecast, 2), color: "var(--forecast)" });
                if (r.published) tip.push({ label: "Published", value: ukDateTime(r.published), color: "" });
                return <Tooltip title={ukTime(r.time)} rows={tip} />;
              }} />
            <Line dataKey="forecast" stroke="var(--forecast)" strokeWidth={2} strokeDasharray="5 3" dot={false}
              connectNulls isAnimationActive={false} />
            <Line dataKey="actual" stroke="var(--actual)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
