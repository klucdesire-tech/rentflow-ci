"use client";
import { useEffect, useMemo, useState } from "react";
import { DIMENSIONS, METRICS, Query, ViewName, Views, dimensionValues, formatCompact, formatValue, metric } from "../bi/semantic";
import {
  DEFAULT_OPTIONS, DX, LegendMode, PivotCell, PivotLayout, PivotResult, RELATIVE_PERIODS,
  computePivot, dimLabel, itemLabel, pivotToHtml, pivotToRows,
} from "../bi/pivot";
import { downloadCsv, toCsv } from "../bi/export";
import { Empty, INK } from "./charts";

/* ─── Styles (alignés sur HermesStudio) ───────────────────────── */
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", border: "1px solid #E9EAEC", minWidth: 0 };
const cardTitle: React.CSSProperties = { fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 2 };
const select: React.CSSProperties = { padding: "7px 9px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: "#fff", color: INK.primary, maxWidth: "100%" };
const btn: React.CSSProperties = { padding: "7px 12px", background: "#1877F2", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" };
const ghost: React.CSSProperties = { ...btn, background: "#F3F4F6", color: "#374151" };
const zoneLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: INK.muted, letterSpacing: ".06em", marginBottom: 6 };

type Zone = "columns" | "rows" | "filters";
const ZONES: { id: Zone; label: string; hint: string }[] = [
  { id: "columns", label: "COLONNES", hint: "Glissez une dimension ici" },
  { id: "rows",    label: "LIGNES",   hint: "Glissez une dimension ici" },
  { id: "filters", label: "FILTRES",  hint: "Dimensions agrégées (non affichées)" },
];
const VIEW_LABEL: Record<ViewName, string> = { rent: "Loyers", occupancy: "Occupation", deposit: "Cautions & baux" };

/* ─── Modèles prêts à l'emploi (comme les favoris DHIS2) ──────── */
const base = (l: Partial<PivotLayout>): PivotLayout => ({
  columns: [], rows: [], filters: [], metrics: [], items: {}, period: "LAST_12_MONTHS", options: { ...DEFAULT_OPTIONS }, ...l,
});

export const PIVOT_PRESETS: { name: string; layout: PivotLayout }[] = [
  { name: "Synthèse financière — ville × année", layout: base({ rows: ["ville"], columns: ["annee", DX], metrics: ["attendu", "encaisse", "taux_recouvrement"], period: "ALL", options: { ...DEFAULT_OPTIONS, subtotals: true } }) },
  { name: "Recouvrement — ville × trimestre", layout: base({ rows: ["ville"], columns: ["trimestre"], filters: [DX], metrics: ["taux_recouvrement"], period: "LAST_4_QUARTERS", options: { ...DEFAULT_OPTIONS, legend: "thresholds" } }) },
  { name: "Impayés — locataire × mois", layout: base({ rows: ["locataire"], columns: ["mois"], filters: [DX], metrics: ["impayes"], options: { ...DEFAULT_OPTIONS, legend: "gradient", compact: true } }) },
  { name: "Occupation — bien × mois", layout: base({ rows: ["bien"], columns: ["mois"], filters: [DX], metrics: ["taux_occupation"], options: { ...DEFAULT_OPTIONS, legend: "thresholds", compact: true } }) },
  { name: "Encaissements — canal × trimestre", layout: base({ rows: ["canal"], columns: ["trimestre"], filters: [DX], metrics: ["encaisse"], period: "LAST_4_QUARTERS", options: { ...DEFAULT_OPTIONS, compact: true } }) },
  { name: "Données en lignes — métrique × ville", layout: base({ rows: [DX, "ville"], columns: ["trimestre"], metrics: ["encaisse", "impayes"], period: "LAST_4_QUARTERS", options: { ...DEFAULT_OPTIONS, subtotals: true, compact: true } }) },
];
export const DEFAULT_PIVOT = PIVOT_PRESETS[0].layout;

/** Requête de l'explorateur → disposition de TCD. */
export function layoutFromQuery(q: Query): PivotLayout {
  const [d0, d1] = q.dimensions ?? [];
  const multi = q.metrics.length > 1;
  return base({
    rows: d0 ? [d0] : multi ? [DX] : [],
    columns: d1 ? (multi ? [d1, DX] : [d1]) : d0 && multi ? [DX] : [],
    filters: multi ? [] : [DX],
    metrics: q.metrics,
    items: { ...(q.filters ?? {}) },
    period: q.from || q.to ? "CUSTOM" : "ALL",
    from: q.from, to: q.to,
  });
}

/* ─── Favoris (préférence locale du navigateur) ───────────────── */
const FAV_KEY = "hermes_pivot_favorites";
const loadFavs = (): { name: string; layout: PivotLayout }[] => {
  try { return JSON.parse(window.localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
};
const saveFavs = (f: { name: string; layout: PivotLayout }[]) => {
  try { window.localStorage.setItem(FAV_KEY, JSON.stringify(f)); } catch { /* stockage indisponible */ }
};

/* ─── Légendes (« legend sets » DHIS2) ────────────────────────── */
const GRADIENT = ["#EAF2FD", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf"];
const THRESH = {
  good: { bg: "#DCFCE7", fg: "#166534", label: "Bon" },
  warn: { bg: "#FEF3C7", fg: "#92400E", label: "Moyen" },
  bad:  { bg: "#FEE2E2", fg: "#991B1B", label: "Faible" },
};

function cellStyle(c: PivotCell, mode: LegendMode, max: Record<string, number>): React.CSSProperties {
  if (mode === "none" || c.value === null || !c.metric) return {};
  const m = metric(c.metric)!;
  if (mode === "thresholds") {
    if (m.format !== "pct") return {};
    const v = m.higherIsBetter ? c.value : 1 - c.value;
    const t = v >= 0.9 ? THRESH.good : v >= 0.7 ? THRESH.warn : THRESH.bad;
    return { background: t.bg, color: t.fg };
  }
  const mx = max[c.metric] || 1;
  const step = Math.min(GRADIENT.length - 1, Math.floor((Math.abs(c.value) / mx) * (GRADIENT.length - 0.001)));
  return { background: GRADIENT[step], color: step >= 4 ? "#fff" : INK.primary };
}

/* ═══ Composant ══════════════════════════════════════════════════ */

export default function PivotTab({ views, now, layout, setLayout }: {
  views: Views; now: Date; layout: PivotLayout; setLayout: (l: PivotLayout) => void;
}) {
  const [active, setActive] = useState<string>(layout.columns[0] ?? layout.rows[0] ?? DX);
  const [search, setSearch] = useState("");
  const [favs, setFavs] = useState<{ name: string; layout: PivotLayout }[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  useEffect(() => setFavs(loadFavs()), []);

  const result = useMemo(() => computePivot(views, layout, now), [views, layout, now]);
  const months = useMemo(() => dimensionValues(views, "mois"), [views]);
  const placed = new Set([...layout.columns, ...layout.rows, ...layout.filters]);
  const zoneOf = (id: string): Zone | null => (layout.columns.includes(id) ? "columns" : layout.rows.includes(id) ? "rows" : layout.filters.includes(id) ? "filters" : null);
  const set = (patch: Partial<PivotLayout>) => setLayout({ ...layout, ...patch, sort: "rows" in patch || "columns" in patch ? undefined : patch.sort ?? layout.sort });
  const setOpt = (patch: Partial<PivotLayout["options"]>) => setLayout({ ...layout, options: { ...layout.options, ...patch } });

  /** Place (ou déplace) une dimension dans une zone, éventuellement avant `before`. */
  const move = (id: string, zone: Zone | null, before?: string) => {
    const strip = (a: string[]) => a.filter(x => x !== id);
    const next = { columns: strip(layout.columns), rows: strip(layout.rows), filters: strip(layout.filters) };
    if (zone) {
      const arr = next[zone];
      const at = before ? arr.indexOf(before) : -1;
      at >= 0 ? arr.splice(at, 0, id) : arr.push(id);
    }
    const items = { ...layout.items };
    if (!zone && id !== DX) delete items[id];
    set({ ...next, items });
    if (zone) setActive(id);
  };
  const swap = () => set({ columns: layout.rows, rows: layout.columns });

  const fmt = (c: PivotCell) => {
    if (!c.metric) return "—";
    const f = metric(c.metric)!.format;
    return layout.options.compact ? formatCompact(c.value, f) : formatValue(c.value, f);
  };
  const title = `HERMES — ${layout.metrics.map(m => metric(m)?.label).join(", ")}`;

  const exportCsv = () => {
    const [head, ...body] = pivotToRows(result, c => (c.value === null ? "" : Math.round(c.value * 10000) / 10000));
    downloadCsv("hermes_tcd.csv", toCsv(head.map(String), body));
  };
  const exportXls = () => {
    const blob = new Blob(["﻿" + pivotToHtml(result, fmt, title)], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "hermes_tcd.xls"; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const saveFav = () => {
    const name = window.prompt("Nom du favori :", title.replace("HERMES — ", ""));
    if (!name) return;
    const next = [...favs.filter(f => f.name !== name), { name, layout }];
    setFavs(next); saveFavs(next);
  };
  const removeFav = (name: string) => { const next = favs.filter(f => f.name !== name); setFavs(next); saveFavs(next); };

  /* ── Sélecteur d'éléments de la dimension active ── */
  const itemPanel = () => {
    if (active === DX) {
      const toggle = (id: string) => {
        const has = layout.metrics.includes(id);
        const next = has ? layout.metrics.filter(m => m !== id) : [...layout.metrics, id];
        if (next.length) set({ metrics: next });
      };
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))", gap: 12 }}>
          {(["rent", "occupancy", "deposit"] as ViewName[]).map(v => (
            <div key={v}>
              <div style={zoneLabel}>{VIEW_LABEL[v].toUpperCase()}</div>
              {METRICS.filter(m => m.view === v).map(m => {
                const idx = layout.metrics.indexOf(m.id);
                return (
                  <label key={m.id} title={m.description} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "3px 0", cursor: "pointer", color: INK.primary }}>
                    <input type="checkbox" checked={idx >= 0} onChange={() => toggle(m.id)} />
                    {m.label}
                    {idx >= 0 && layout.metrics.length > 1 && <span style={{ fontSize: 10, color: INK.muted }}>#{idx + 1}</span>}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      );
    }
    const values = dimensionValues(views, active);
    const chosen = layout.items[active] ?? [];
    const q = search.trim().toLowerCase();
    const shown = values.filter(v => !q || itemLabel(active, v).toLowerCase().includes(q));
    const setItems = (vals: string[]) => {
      const items = { ...layout.items, [active]: vals };
      if (!vals.length) delete items[active];
      set({ items });
    };
    return (
      <>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ ...select, flex: "1 1 160px" }} />
          <button style={{ ...ghost, padding: "6px 10px" }} onClick={() => setItems(shown)}>Tout cocher</button>
          <button style={{ ...ghost, padding: "6px 10px" }} onClick={() => setItems([])}>Tous (aucune restriction)</button>
          <span style={{ fontSize: 11, color: INK.muted }}>{chosen.length ? `${chosen.length} retenu(s) sur ${values.length}` : `Tous les éléments (${values.length})`}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 180px), 1fr))", gap: "2px 12px", maxHeight: 180, overflowY: "auto" }}>
          {shown.map(v => (
            <label key={v} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, padding: "3px 0", cursor: "pointer", color: INK.primary, minWidth: 0 }}>
              <input type="checkbox" checked={chosen.includes(v)} onChange={() => setItems(chosen.includes(v) ? chosen.filter(x => x !== v) : [...chosen, v])} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{itemLabel(active, v)}</span>
            </label>
          ))}
        </div>
      </>
    );
  };

  const chip = (id: string) => {
    const n = id === DX ? layout.metrics.length : layout.items[id]?.length ?? 0;
    const on = active === id;
    return (
      <span key={id} draggable
        onDragStart={e => { e.dataTransfer.setData("text/plain", id); setDragging(id); }}
        onDragEnd={() => setDragging(null)}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); const d = e.dataTransfer.getData("text/plain"); if (d && d !== id) move(d, zoneOf(id), id); setDragging(null); }}
        onClick={() => { setActive(id); setSearch(""); }}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 6px 5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "grab", userSelect: "none",
          background: id === DX ? (on ? "#1D4ED8" : "#DBEAFE") : on ? "#0F172A" : "#F1F5F9", color: on ? "#fff" : id === DX ? "#1E3A8A" : INK.primary,
          border: `1px solid ${on ? "transparent" : "#E2E8F0"}`, opacity: dragging === id ? 0.4 : 1 }}>
        {dimLabel(id)}{n > 0 && <span style={{ fontWeight: 600, opacity: 0.75 }}>({n})</span>}
        <button aria-label={`Retirer ${dimLabel(id)}`} onClick={e => { e.stopPropagation(); if (id !== DX) move(id, null); }}
          disabled={id === DX} title={id === DX ? "« Données » est obligatoire" : "Retirer"}
          style={{ border: "none", background: "transparent", color: "inherit", cursor: id === DX ? "default" : "pointer", fontSize: 13, lineHeight: 1, padding: "0 4px", opacity: id === DX ? 0.3 : 0.7 }}>×</button>
      </span>
    );
  };

  const periodLabel = layout.period === "CUSTOM"
    ? `${layout.from ? itemLabel("mois", layout.from) : "début"} → ${layout.to ? itemLabel("mois", layout.to) : "aujourd'hui"}`
    : RELATIVE_PERIODS.find(p => p.id === layout.period)?.label;

  return (
    <>
      {/* ── Disposition ── */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={cardTitle}>Disposition du tableau croisé</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>Glissez les dimensions entre Colonnes, Lignes et Filtres, ou utilisez les boutons C · L · F. Cliquez une dimension pour choisir ses éléments.</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <select style={select} value="" aria-label="Ouvrir un modèle ou un favori"
              onChange={e => {
                const [kind, name] = e.target.value.split("::");
                const src = kind === "preset" ? PIVOT_PRESETS : favs;
                const f = src.find(x => x.name === name);
                if (f) { setLayout(f.layout); setActive(f.layout.columns[0] ?? f.layout.rows[0] ?? DX); }
              }}>
              <option value="">Ouvrir…</option>
              <optgroup label="Modèles">{PIVOT_PRESETS.map(p => <option key={p.name} value={`preset::${p.name}`}>{p.name}</option>)}</optgroup>
              {favs.length > 0 && <optgroup label="Mes favoris">{favs.map(f => <option key={f.name} value={`fav::${f.name}`}>{f.name}</option>)}</optgroup>}
            </select>
            <button style={ghost} onClick={saveFav}>☆ Enregistrer</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 14 }}>
          {/* Liste des dimensions */}
          <div style={{ border: "1px solid #EEF0F3", borderRadius: 10, padding: 10, maxHeight: 290, overflowY: "auto" }}>
            <div style={zoneLabel}>DIMENSIONS</div>
            {[DX, ...DIMENSIONS.map(d => d.id)].map(id => {
              const z = zoneOf(id);
              return (
                <div key={id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain", id); setDragging(id); }} onDragEnd={() => setDragging(null)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px", borderRadius: 6, cursor: "grab", background: active === id ? "#F1F5F9" : "transparent" }}
                  onClick={() => placed.has(id) && setActive(id)}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: placed.has(id) ? 700 : 500, color: placed.has(id) ? INK.primary : INK.secondary }}>
                    {dimLabel(id)}{dimension_time(id) ? " ⏱" : ""}
                  </span>
                  {(["columns", "rows", "filters"] as Zone[]).map(zn => (
                    <button key={zn} title={`Placer en ${ZONES.find(x => x.id === zn)!.label.toLowerCase()}`}
                      onClick={e => { e.stopPropagation(); move(id, zn); }}
                      style={{ width: 22, height: 22, borderRadius: 5, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
                        border: `1px solid ${z === zn ? "#1877F2" : "#E5E7EB"}`, background: z === zn ? "#1877F2" : "#fff", color: z === zn ? "#fff" : "#64748B" }}>
                      {zn === "columns" ? "C" : zn === "rows" ? "L" : "F"}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          {/* Zones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ZONES.map(zn => (
              <div key={zn.id}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); if (d) move(d, zn.id); setDragging(null); }}
                style={{ border: `1.5px dashed ${dragging ? "#93C5FD" : "#E2E8F0"}`, background: dragging ? "#F8FBFF" : "#FCFCFD", borderRadius: 10, padding: "8px 10px", minHeight: 62 }}>
                <div style={zoneLabel}>{zn.label}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {layout[zn.id].map(chip)}
                  {!layout[zn.id].length && <span style={{ fontSize: 11, color: INK.muted }}>{zn.hint}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Éléments de la dimension active */}
        {placed.has(active) && (
          <div style={{ marginTop: 14, borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
            <div style={{ ...cardTitle, marginBottom: 8 }}>Éléments — {dimLabel(active)}</div>
            {itemPanel()}
          </div>
        )}
      </div>

      {/* ── Options ── */}
      <div style={{ ...card, marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: INK.primary }}>
          Période
          <select style={select} value={layout.period} onChange={e => set({ period: e.target.value })}>
            {RELATIVE_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            <option value="CUSTOM">Période fixe…</option>
          </select>
        </label>
        {layout.period === "CUSTOM" && <>
          <select style={select} value={layout.from ?? ""} onChange={e => set({ from: e.target.value || undefined })} aria-label="Du">
            <option value="">Depuis le début</option>
            {months.map(m => <option key={m} value={m}>Depuis {itemLabel("mois", m)}</option>)}
          </select>
          <select style={select} value={layout.to ?? ""} onChange={e => set({ to: e.target.value || undefined })} aria-label="Au">
            <option value="">Jusqu'à aujourd'hui</option>
            {months.map(m => <option key={m} value={m}>Jusqu'à {itemLabel("mois", m)}</option>)}
          </select>
        </>}
        {([
          ["totals", "Totaux"], ["subtotals", "Sous-totaux"], ["hideEmptyRows", "Masquer lignes vides"],
          ["hideEmptyCols", "Masquer colonnes vides"], ["compact", "Nombres abrégés"],
        ] as const).map(([k, l]) => (
          <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: INK.primary, cursor: "pointer" }}>
            <input type="checkbox" checked={layout.options[k]} onChange={e => setOpt({ [k]: e.target.checked })} />{l}
          </label>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: INK.primary }}>
          Légende
          <select style={select} value={layout.options.legend} onChange={e => setOpt({ legend: e.target.value as LegendMode })}>
            <option value="none">Aucune</option>
            <option value="thresholds">Seuils (taux)</option>
            <option value="gradient">Dégradé</option>
          </select>
        </label>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          <button style={ghost} onClick={swap} title="Inverser lignes et colonnes">⇄ Inverser</button>
          <button style={ghost} onClick={exportCsv} disabled={!!result.error}>CSV</button>
          <button style={btn} onClick={exportXls} disabled={!!result.error}>Exporter Excel</button>
        </div>
      </div>

      {/* ── Tableau ── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={cardTitle}>{title.replace("HERMES — ", "")}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              {periodLabel}
              {layout.filters.filter(f => f !== DX).map(f => ` · ${dimLabel(f)} : ${layout.items[f]?.length ? layout.items[f].map(v => itemLabel(f, v)).join(", ") : "tous"}`).join("")}
              {result.rowDims.length === 1 && " · cliquez un en-tête de colonne pour trier"}
            </div>
          </div>
          <span style={{ fontSize: 11, color: INK.muted }}>{result.rows.length} ligne(s) × {result.cols.length} colonne(s)</span>
        </div>
        {[...result.notes, ...result.warnings].map(w => (
          <div key={w} style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: 8, padding: "7px 12px", fontSize: 12, marginBottom: 8 }}>⚠ {w}</div>
        ))}
        {result.error ? <Empty text={result.error} /> : !result.rows.length || !result.cols.length ? <Empty /> : (
          <PivotGrid p={result} fmt={fmt} legend={layout.options.legend} sort={layout.sort}
            onSort={col => set({ sort: { col, dir: layout.sort?.col === col && layout.sort.dir === "desc" ? "asc" : "desc" } })} />
        )}
        {layout.options.legend !== "none" && !result.error && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: INK.secondary, marginTop: 10 }}>
            {layout.options.legend === "thresholds" ? <>
              <span>Seuils appliqués aux taux :</span>
              {[[THRESH.good, "≥ 90 %"], [THRESH.warn, "70 – 90 %"], [THRESH.bad, "< 70 %"]].map(([t, r]) => {
                const th = t as typeof THRESH.good;
                return <span key={th.label} style={{ display: "flex", gap: 5, alignItems: "center" }}><span style={{ background: th.bg, color: th.fg, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>{th.label}</span>{r as string}</span>;
              })}
            </> : <>
              <span>Intensité relative au maximum de chaque métrique :</span>
              <span style={{ display: "flex" }}>{GRADIENT.map(g => <span key={g} style={{ width: 18, height: 10, background: g }} />)}</span>
              <span>faible → élevée</span>
            </>}
          </div>
        )}
        {favs.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 12, fontSize: 11, color: INK.muted }}>
            Favoris :
            {favs.map(f => (
              <span key={f.name} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "2px 4px 2px 8px" }}>
                <button onClick={() => setLayout(f.layout)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: INK.primary, fontFamily: "inherit", padding: 0 }}>{f.name}</button>
                <button aria-label={`Supprimer ${f.name}`} onClick={() => removeFav(f.name)} style={{ border: "none", background: "none", cursor: "pointer", color: INK.muted, fontSize: 13, padding: "0 3px" }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const dimension_time = (id: string) => DIMENSIONS.find(d => d.id === id)?.time;

/* ─── Rendu du tableau avec en-têtes fusionnés ────────────────── */

function PivotGrid({ p, fmt, legend, sort, onSort }: {
  p: PivotResult; fmt: (c: PivotCell) => string; legend: LegendMode;
  sort?: PivotLayout["sort"]; onSort: (col: number) => void;
}) {
  const rl = Math.max(1, p.rowDims.length), cl = Math.max(1, p.colDims.length);
  const border = "1px solid #E5E7EB";
  const thBase: React.CSSProperties = { border, padding: "6px 9px", fontSize: 11, fontWeight: 700, color: "#334155", background: "#F1F5F9", whiteSpace: "nowrap", textAlign: "center" };
  const kindBg = (k: string) => (k === "total" ? "#E2E8F0" : k === "subtotal" ? "#F1F5F9" : undefined);
  const sortable = p.rowDims.length === 1;

  return (
    <div style={{ overflow: "auto", maxHeight: "70vh", border, borderRadius: 8 }}>
      <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontVariantNumeric: "tabular-nums" }}>
        <thead>
          {Array.from({ length: cl }, (_, L) => (
            <tr key={L}>
              {L === 0 && (
                <th rowSpan={cl} colSpan={rl} style={{ ...thBase, background: "#E9EEF5", textAlign: "left", color: INK.secondary, fontWeight: 600 }}>
                  {p.rowDims.map(dimLabel).join(" / ")}{p.rowDims.length && p.colDims.length ? " \\ " : ""}{p.colDims.map(dimLabel).join(" / ")}
                </th>
              )}
              {!p.colDims.length ? <th style={thBase}>Valeur</th> : p.colHeaders[L].map((h, j) => {
                if (!h) return null;
                const leaf = h.span === 1 && L + h.cross === cl;
                const canSort = sortable && leaf;
                const arrow = canSort && sort?.col === j ? (sort.dir === "desc" ? " ↓" : " ↑") : "";
                return (
                  <th key={j} colSpan={h.span} rowSpan={h.cross} onClick={canSort ? () => onSort(j) : undefined}
                    style={{ ...thBase, background: kindBg(h.kind) ?? thBase.background, cursor: canSort ? "pointer" : undefined }}>
                    {h.text}{arrow}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {p.rows.map((r, i) => (
            <tr key={i}>
              {!p.rowDims.length ? <th style={{ ...thBase, textAlign: "left" }}>Valeur</th> : p.rowDims.map((_, L) => {
                const h = p.rowHeaders[L][i];
                if (!h) return null;
                return (
                  <th key={L} rowSpan={h.span} colSpan={h.cross}
                    style={{ ...thBase, textAlign: "left", verticalAlign: "top", background: kindBg(h.kind) ?? "#F8FAFC", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {h.text}
                  </th>
                );
              })}
              {p.cells[i].map((c, j) => {
                const agg = r.kind !== "data" || p.cols[j].kind !== "data";
                const bg = r.kind === "total" || p.cols[j].kind === "total" ? "#EEF2F7" : agg ? "#F8FAFC" : "#fff";
                return (
                  <td key={j} style={{ border, padding: "6px 9px", fontSize: 12, textAlign: "right", whiteSpace: "nowrap",
                    background: bg, fontWeight: agg ? 700 : 400, color: c.value === null ? INK.muted : "#1F2937",
                    ...(agg ? {} : cellStyle(c, legend, p.maxByMetric)) }}>
                    {fmt(c)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
