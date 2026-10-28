import { useEffect, useState } from "react";
import { api } from "./api";
import Accuracy from "./components/Accuracy";
import DayAhead from "./components/DayAhead";
import Horizon from "./components/Horizon";
import { Loading } from "./components/common";
import { ukDateTime, ukDay } from "./format";
import { useApi } from "./useApi";

const TABS = ["Day-ahead decision", "Forecast accuracy", "Horizon explorer"] as const;
type Tab = (typeof TABS)[number];
const GATES = ["06:00", "09:20", "11:00", "13:00", "16:00"];
const SLUGS: Record<string, Tab> = { decision: TABS[0], accuracy: TABS[1], horizon: TABS[2] };
const slugOf = (t: Tab) => Object.keys(SLUGS).find((k) => SLUGS[k] === t)!;

export default function App() {
  const { data: meta, error } = useApi(api.meta, []);
  // Tab is mirrored in the URL hash so views can be bookmarked / linked (#accuracy).
  const [tab, setTabState] = useState<Tab>(SLUGS[location.hash.slice(1)] ?? TABS[0]);
  const setTab = (t: Tab) => { setTabState(t); history.replaceState(null, "", `#${slugOf(t)}`); };
  const [day, setDay] = useState("2026-01-15");
  const [gate, setGate] = useState("09:20");
  const [corrected, setCorrected] = useState(false);

  useEffect(() => { if (meta) setGate(meta.defaultGate); }, [meta]);
  if (!meta) return <div className="wrap"><Loading error={error} /></div>;

  const days = meta.deliveryDays;
  const i = days.indexOf(day);
  const pickDay = (d: string) => { setDay(d); setTab("Day-ahead decision"); };

  return (
    <div className="wrap">
      <header className="top">
        <div>
          <h1>Wind Day-Ahead Monitor</h1>
          <p>GB national wind generation · forecast vs actual · purchase decisions for January 2026</p>
        </div>
        <div className="controls">
          <label title="Time on the day before delivery when the day-ahead purchase is locked in">
            Decision time (D-1, UK)
            <select value={gate} onChange={(e) => setGate(e.target.value)}>
              {GATES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </label>
          <label title={`Scale the forecast by the actual/forecast ratio of the last ${meta.correctionWindowDays} finished days`}>
            <input type="checkbox" checked={corrected} onChange={(e) => setCorrected(e.target.checked)} />
            Bias-corrected forecast
          </label>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>{t}</button>)}
      </nav>

      {tab !== "Forecast accuracy" && (
        <div className="daybar">
          <button className="nav" disabled={i <= 0} onClick={() => setDay(days[i - 1])} aria-label="Previous day">←</button>
          <strong>{ukDay(day)}</strong>
          <button className="nav" disabled={i >= days.length - 1} onClick={() => setDay(days[i + 1])} aria-label="Next day">→</button>
          <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Delivery day">
            {days.map((d) => <option key={d} value={d}>{ukDay(d)}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 13 }}>Delivery day</span>
        </div>
      )}

      {tab === "Day-ahead decision" && <DayAhead day={day} gate={gate} corrected={corrected} windowDays={meta.correctionWindowDays} />}
      {tab === "Forecast accuracy" && <Accuracy gate={gate} corrected={corrected} onPickDay={pickDay} />}
      {tab === "Horizon explorer" && <Horizon day={day} />}

      <footer>
        Source: {meta.source} (national level). Snapshot fetched {ukDateTime(meta.dataFetchedAt)}.
        Decision time is an assumption to confirm with the desk; GB day-ahead auctions close in the morning of D-1.
        Forecasts are hourly and compared with the actual half-hour starting at the same time.
      </footer>
    </div>
  );
}
