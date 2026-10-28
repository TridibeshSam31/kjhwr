import type { ReactNode } from "react";

export const AXIS = { stroke: "var(--axis)", tickLine: false } as const;
export const GRID = { stroke: "var(--grid)", vertical: false } as const;
export const gwTick = (v: number) => `${+(v / 1000).toFixed(1)}`;

export function Tile({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

export function Card({ title, sub, children }: { title: string; sub?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {sub && <p className="sub">{sub}</p>}
      {children}
    </section>
  );
}

export interface TipRow { label: string; value: string; color?: string; dashed?: boolean }

export function Tooltip({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="tooltip">
      <div className="t">{title}</div>
      {rows.map((r) => (
        <div className="row" key={r.label}>
          <span>
            {r.color && <span className="swatch" style={{ background: r.color, marginRight: 6 }} />}
            {r.label}
          </span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  );
}

export const Loading = ({ error }: { error?: string | null }) =>
  error ? <p className="error">Could not load data: {error}</p> : <p className="muted">Loading…</p>;
