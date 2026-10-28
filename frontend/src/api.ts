// Typed client for the FastAPI backend. All MW values; times are ISO UTC strings.

export interface Stats {
  n: number;
  mae: number;
  rmse: number;
  bias: number;
  nmae: number | null;
  p10: number;
  p50: number;
  p90: number;
  maxShortfall: number;
  maxSurplus: number;
  meanActual: number;
}

export interface Meta {
  deliveryDays: string[];
  defaultGate: string;
  correctionWindowDays: number;
  dataFetchedAt: string;
  source: string;
}

export interface DayView {
  day: string;
  gateClosure: string;
  correctionFactor: number;
  forecastPublished: string[];
  band: { p10: number; p90: number };
  hourly: { time: string; forecast: number | null; p10: number | null; p90: number | null; lead: number | null }[];
  actual: { time: string; actual: number | null }[];
  energyMWh: { forecast: number; p10: number; actual: number };
  accuracy: Stats;
}

export interface HorizonView {
  day: string;
  horizon: number;
  hourly: { time: string; forecast: number | null; published: string | null }[];
}

export interface AccuracyReport {
  gateClosure: string;
  corrected: boolean;
  overall: Stats;
  leadRange: [number, number];
  byDay: ({ day: string } & Stats)[];
  byHour: ({ hour: number } & Stats)[];
  byLead: ({ leadFrom: number; leadTo: number } & Stats)[];
  histogram: { from: number; to: number; count: number }[];
}

async function get<T>(path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`/api/${path}?${qs}`);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  meta: () => get<Meta>("meta"),
  day: (day: string, gate: string, corrected: boolean) => get<DayView>("day", { day, gate, corrected }),
  horizon: (day: string, hours: number) => get<HorizonView>("horizon", { day, hours }),
  accuracy: (gate: string, corrected: boolean) => get<AccuracyReport>("accuracy", { gate, corrected }),
};
