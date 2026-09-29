"use client";
import { useState } from "react";
import { Format, formatCompact, formatValue } from "../bi/semantic";

/* Palette HERMES — catégorielle en ordre fixe, statuts réservés. */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const STATUS = { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", neutral: "#E5E7EB" };
export const INK = { primary: "#0F172A", secondary: "#475569", muted: "#94A3B8", grid: "#EEF0F3", axis: "#CBD5E1" };

const tipStyle: React.CSSProperties = {
  position: "absolute", pointerEvents: "none", background: "#0F172A", color: "#F8FAFC",
  borderRadius: 8, padding: "8px 10px", fontSize: 11, lineHeight: 1.5, whiteSpace: "nowrap",
  boxShadow: "0 4px 14px rgba(0,0,0,.18)", zIndex: 5, transform: "translate(-50%, calc(-100% - 10px))",
};

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: INK.secondary }}>
      {items.map(i => (
        <span key={i.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: i.color, display: "inline-block" }} />{i.label}
        </span>
      ))}
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/* ─── Courbes (une échelle, crosshair + tooltip) ──────────────── */

export interface Series { name: string; values: (number | null)[]; color?: string; dashed?: boolean }

export function LineChart({ labels, series, format, height = 220, max }: {
  labels: string[]; series: Series[]; format: Format; height?: number; max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, L = 48, Rp = 14, T = 12, B = 26;
  const all = series.flatMap(s => s.values.filter((v): v is number => v !== null));
  const yMax = max ?? niceMax(Math.max(0, ...all));
  const n = labels.length;
  const x = (i: number) => L + (n <= 1 ? (W - L - Rp) / 2 : (i * (W - L - Rp)) / (n - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / yMax);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * yMax);
  const step = Math.max(1, Math.ceil(n / 8));

  if (!n) return <Empty />;
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block", overflow: "visible" }}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - Rp)) * (n - 1)))));
        }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - Rp} y1={y(t)} y2={y(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
            <text x={L - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={INK.muted}>{formatCompact(t, format)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill={INK.muted}>{l}</text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={INK.axis} strokeWidth={1} />}
        {series.map((s, si) => {
          const color = s.color ?? SERIES[si];
          const pts = s.values.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`));
          const segs: string[][] = [[]];
          pts.forEach(p => (p ? segs[segs.length - 1].push(p) : segs.push([])));
          return (
            <g key={s.name}>
              {segs.filter(sg => sg.length).map((sg, k) => (
                <polyline key={k} points={sg.join(" ")} fill="none" stroke={color} strokeWidth={2}
                  strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {hover !== null && s.values[hover] !== null && (
                <circle cx={x(hover)} cy={y(s.values[hover]!)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{ ...tipStyle, left: `${(x(hover) / W) * 100}%`, top: `${(T / H) * 100}%` }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{labels[hover]}</div>
          {series.map((s, si) => (
            <div key={s.name} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color ?? SERIES[si] }} />
              {s.name} : <b>{formatValue(s.values[hover], format)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Colonnes (une série) ────────────────────────────────────── */

export function ColumnChart({ labels, values, format, color = SERIES[0], height = 200, highlightLast }: {
  labels: string[]; values: (number | null)[]; format: Format; color?: string; height?: number; highlightLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, L = 48, Rp = 8, T = 12, B = 26;
  const n = labels.length;
  const yMax = niceMax(Math.max(0, ...values.map(v => v ?? 0)));
  const band = (W - L - Rp) / Math.max(n, 1);
  const bw = Math.max(4, Math.min(36, band - 2));
  const y = (v: number) => T + (H - T - B) * (1 - v / yMax);
  const step = Math.max(1, Math.ceil(n / 10));
  if (!n) return <Empty />;
  return (
    <div style={{ position: "relative" }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" style={{ display: "block", overflow: "visible" }}>
        {[0, 0.5, 1].map(t => (
          <g key={t}>
            <line x1={L} x2={W - Rp} y1={y(t * yMax)} y2={y(t * yMax)} stroke={t === 0 ? INK.axis : INK.grid} />
            <text x={L - 8} y={y(t * yMax) + 3.5} textAnchor="end" fontSize={10} fill={INK.muted}>{formatCompact(t * yMax, format)}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const cx = L + band * i + band / 2;
          const h = v ? Math.max(1, y(0) - y(v)) : 0;
          const r = Math.min(4, bw / 2, h);
          const top = y(0) - h;
          const active = hover === i || (hover === null && highlightLast && i === n - 1);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={L + band * i} y={T} width={band} height={H - T - B} fill="transparent" />
              {h > 0 && (
                <path d={`M${cx - bw / 2},${y(0)} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${y(0)} Z`}
                  fill={color} opacity={hover === null ? (highlightLast && i !== n - 1 ? 0.55 : 1) : active ? 1 : 0.45} />
              )}
              {(i % step === 0 || i === n - 1) && <text x={cx} y={H - 8} textAnchor="middle" fontSize={10} fill={INK.muted}>{labels[i]}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{ ...tipStyle, left: `${((L + band * hover + band / 2) / W) * 100}%`, top: `${(y(values[hover] ?? 0) / H) * 100}%` }}>
          <div style={{ fontWeight: 700 }}>{labels[hover]}</div>
          <div>{formatValue(values[hover], format)}</div>
        </div>
      )}
    </div>
  );
}

/* ─── Barres horizontales classées ────────────────────────────── */

export function BarList({ rows, format, color = SERIES[0], total }: {
  rows: { label: string; value: number | null; hint?: string }[]; format: Format; color?: string; total?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = format === "pct" ? 1 : Math.max(0, ...rows.map(r => r.value ?? 0)) || 1;
  if (!rows.length) return <Empty />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }} onMouseLeave={() => setHover(null)}>
      {rows.map((r, i) => (
        <div key={r.label} onMouseEnter={() => setHover(i)} title={r.hint}
          style={{ display: "grid", gridTemplateColumns: "minmax(80px, 34%) 1fr auto", alignItems: "center", gap: 10, opacity: hover === null || hover === i ? 1 : 0.55 }}>
          <span style={{ fontSize: 12, color: INK.primary, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
          <span style={{ height: 10, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
            <span style={{ display: "block", height: "100%", width: `${Math.max(0, ((r.value ?? 0) / max) * 100)}%`, background: color, borderRadius: 4 }} />
          </span>
          <span style={{ fontSize: 12, color: INK.primary, fontWeight: 700, textAlign: "right", minWidth: 64 }}>
            {formatValue(r.value, format)}
            {total ? <span style={{ color: INK.muted, fontWeight: 500 }}> · {Math.round(((r.value ?? 0) / total) * 100)} %</span> : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Heatmap de statut (locataire × mois) ────────────────────── */

export type CellStatus = "ontime" | "late" | "overdue" | "pending" | "none";
const CELL: Record<CellStatus, { color: string; label: string; glyph: string }> = {
  ontime:  { color: STATUS.good,     label: "Payé à temps",   glyph: "✓" },
  late:    { color: STATUS.warning,  label: "Payé en retard", glyph: "!" },
  overdue: { color: STATUS.critical, label: "Impayé échu",    glyph: "✕" },
  pending: { color: "#CBD5E1",       label: "À venir",        glyph: "·" },
  none:    { color: "#F8FAFC",       label: "Hors bail",      glyph: "" },
};

export function StatusHeatmap({ rows, months }: {
  rows: { label: string; cells: { status: CellStatus; detail: string }[] }[]; months: string[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  if (!rows.length) return <Empty />;
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `140px repeat(${months.length}, minmax(24px, 1fr))`, gap: 2, minWidth: 140 + months.length * 26 }}>
          <span />
          {months.map(m => <span key={m} style={{ fontSize: 9, color: INK.muted, textAlign: "center" }}>{m}</span>)}
          {rows.map(r => [
            <span key={r.label} style={{ fontSize: 11, fontWeight: 600, color: INK.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", alignSelf: "center" }}>{r.label}</span>,
            ...r.cells.map((c, i) => {
              const id = `${r.label}|${i}`;
              return (
                <span key={id} title={c.detail} onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}
                  style={{ height: 24, borderRadius: 4, background: CELL[c.status].color, color: "#fff", fontSize: 11, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center", outline: hover === id ? `2px solid ${INK.primary}` : "none", cursor: "default" }}>
                  {CELL[c.status].glyph}
                </span>
              );
            }),
          ])}
        </div>
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: INK.secondary }}>
        {(["ontime", "late", "overdue", "pending"] as CellStatus[]).map(s => (
          <span key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: CELL[s].color, color: "#fff", fontSize: 9, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{CELL[s].glyph}</span>
            {CELL[s].label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Empty({ text = "Aucune donnée sur cette sélection." }: { text?: string }) {
  return <div style={{ padding: "28px 12px", textAlign: "center", fontSize: 12, color: INK.muted }}>{text}</div>;
}
