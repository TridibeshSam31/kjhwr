// Display helpers. Everything the desk sees is in UK local time.

const UK = "Europe/London";

export const ukTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: UK, hour: "2-digit", minute: "2-digit" });

export const ukDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: UK, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

export const ukDay = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: UK, weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

export const shortDay = (isoDate: string) =>
  new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: UK, day: "numeric", month: "short" });

export const gw = (mw: number | null | undefined, digits = 1) =>
  mw == null ? "–" : `${(mw / 1000).toFixed(digits)} GW`;

export const signedGw = (mw: number, digits = 1) => `${mw > 0 ? "+" : mw < 0 ? "−" : ""}${Math.abs(mw / 1000).toFixed(digits)} GW`;

export const gwh = (mwh: number) => `${Math.round(mwh / 1000).toLocaleString("en-GB")} GWh`;

export const pct = (x: number | null | undefined) => (x == null ? "–" : `${(x * 100).toFixed(0)}%`);
