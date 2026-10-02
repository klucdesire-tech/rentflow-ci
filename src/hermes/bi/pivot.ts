import { DIMENSIONS, Views, dimension, metric, query } from "./semantic";

/**
 * HERMES — tableaux croisés dynamiques (TCD), sur le modèle de DHIS2 :
 * chaque dimension (y compris « Données », les métriques) se place en
 * colonnes, en lignes ou en filtre ; périodes relatives ; totaux et
 * sous-totaux recalculés par la couche sémantique (un taux n'est jamais
 * additionné : il est recalculé sur le périmètre du total).
 */

export const DX = "dx";

export type LegendMode = "none" | "thresholds" | "gradient";

export interface PivotOptions {
  totals: boolean;
  subtotals: boolean;
  hideEmptyRows: boolean;
  hideEmptyCols: boolean;
  legend: LegendMode;
  compact: boolean;
}

export interface PivotLayout {
  columns: string[];                 // identifiants de dimension, DX compris
  rows: string[];
  filters: string[];
  metrics: string[];                 // éléments de la dimension « Données »
  items: Record<string, string[]>;   // éléments retenus par dimension (vide = tous)
  period: string;                    // période relative, ou "CUSTOM" (from / to)
  from?: string;                     // "AAAA-MM", période fixe
  to?: string;
  options: PivotOptions;
  sort?: { col: number; dir: "asc" | "desc" };
}

export const DEFAULT_OPTIONS: PivotOptions = {
  totals: true, subtotals: false, hideEmptyRows: true, hideEmptyCols: true, legend: "none", compact: false,
};

/* ─── Périodes relatives (comme DHIS2) ───────────────────────── */

const ym = (y: number, m0: number) => {
  const d = new Date(y, m0, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const RELATIVE_PERIODS: { id: string; label: string; range: (now: Date) => { from?: string; to?: string } }[] = [
  { id: "THIS_MONTH",      label: "Ce mois",              range: n => ({ from: ym(n.getFullYear(), n.getMonth()), to: ym(n.getFullYear(), n.getMonth()) }) },
  { id: "LAST_3_MONTHS",   label: "3 derniers mois",      range: n => ({ from: ym(n.getFullYear(), n.getMonth() - 2), to: ym(n.getFullYear(), n.getMonth()) }) },
  { id: "LAST_6_MONTHS",   label: "6 derniers mois",      range: n => ({ from: ym(n.getFullYear(), n.getMonth() - 5), to: ym(n.getFullYear(), n.getMonth()) }) },
  { id: "LAST_12_MONTHS",  label: "12 derniers mois",     range: n => ({ from: ym(n.getFullYear(), n.getMonth() - 11), to: ym(n.getFullYear(), n.getMonth()) }) },
  { id: "THIS_QUARTER",    label: "Ce trimestre",         range: n => ({ from: ym(n.getFullYear(), n.getMonth() - (n.getMonth() % 3)), to: ym(n.getFullYear(), n.getMonth()) }) },
  { id: "LAST_4_QUARTERS", label: "4 derniers trimestres",range: n => ({ from: ym(n.getFullYear(), n.getMonth() - (n.getMonth() % 3) - 9), to: ym(n.getFullYear(), n.getMonth()) }) },
  { id: "THIS_YEAR",       label: "Cette année",          range: n => ({ from: `${n.getFullYear()}-01`, to: ym(n.getFullYear(), n.getMonth()) }) },
  { id: "LAST_YEAR",       label: "Année dernière",       range: n => ({ from: `${n.getFullYear() - 1}-01`, to: `${n.getFullYear() - 1}-12` }) },
  { id: "ALL",             label: "Toute la période",     range: () => ({}) },
];

export function periodRange(layout: Pick<PivotLayout, "period" | "from" | "to">, now: Date): { from?: string; to?: string } {
  if (layout.period === "CUSTOM") return { from: layout.from, to: layout.to };
  return (RELATIVE_PERIODS.find(p => p.id === layout.period) ?? RELATIVE_PERIODS[RELATIVE_PERIODS.length - 1]).range(now);
}

/* ─── Résultat ───────────────────────────────────────────────── */

export interface AxisEntry {
  kind: "data" | "subtotal" | "total";
  tuple: string[];                   // éléments fixés, dans l'ordre des dimensions de l'axe
}

export interface PivotCell { value: number | null; metric: string | null }

export interface HeaderCell { text: string; span: number; cross: number; kind: AxisEntry["kind"] | "item" }

export interface PivotResult {
  rowDims: string[];
  colDims: string[];
  rows: AxisEntry[];
  cols: AxisEntry[];
  cells: PivotCell[][];              // [ligne][colonne]
  rowHeaders: (HeaderCell | null)[][]; // [niveau][ligne]
  colHeaders: (HeaderCell | null)[][]; // [niveau][colonne]
  maxByMetric: Record<string, number>;
  warnings: string[];
  notes: string[];
  error?: string;
}

export const MAX_CELLS = 40_000;

export function dimLabel(id: string) {
  return id === DX ? "Données" : dimension(id)?.label ?? id;
}

export function itemLabel(dim: string, item: string) {
  if (dim === DX) return metric(item)?.label ?? item;
  return dimension(dim)?.display?.(item) ?? item;
}

const DIM_ORDER = (id: string) => DIMENSIONS.findIndex(d => d.id === id);

export function computePivot(views: Views, layout: PivotLayout, now: Date = new Date()): PivotResult {
  const { rows: rowDims, columns: colDims, options } = layout;
  const metrics = layout.metrics.filter(id => metric(id));
  const warnings = new Set<string>();
  const notes: string[] = [];
  const empty: PivotResult = { rowDims, colDims, rows: [], cols: [], cells: [], rowHeaders: [], colHeaders: [], maxByMetric: {}, warnings: [], notes };

  if (!metrics.length) return { ...empty, error: "Sélectionnez au moins une donnée (métrique)." };
  const dxOnAxis = rowDims.includes(DX) || colDims.includes(DX);
  if (!dxOnAxis && metrics.length > 1) notes.push(`« Données » est en filtre : seule « ${metric(metrics[0])!.label} » est affichée. Placez « Données » en lignes ou en colonnes pour comparer les métriques.`);

  const { from, to } = periodRange(layout, now);

  // Les éléments retenus de toutes les dimensions (axes et filtres) restreignent le périmètre.
  const filters: Record<string, string[]> = {};
  [...rowDims, ...colDims, ...layout.filters].forEach(d => {
    if (d !== DX && layout.items[d]?.length) filters[d] = layout.items[d];
  });

  // Agrégats mis en cache par sous-ensemble de dimensions.
  const cache = new Map<string, Map<string, (number | null)[]>>();
  const agg = (dims: string[]) => {
    const sorted = [...dims].sort((a, b) => DIM_ORDER(a) - DIM_ORDER(b));
    const ck = sorted.join("|");
    let m = cache.get(ck);
    if (!m) {
      const res = query(views, { metrics, dimensions: sorted, filters, from, to });
      res.warnings.forEach(w => warnings.add(w));
      m = new Map(res.rows.map(r => [r.keys.join("\u0000"), r.values]));
      if (!sorted.length) m.set("", res.totals);
      cache.set(ck, m);
    }
    return { sorted, m };
  };

  // Éléments de chaque dimension d'axe
  const itemsOf = (d: string): string[] => {
    if (d === DX) return metrics;
    const chosen = layout.items[d]?.length ? layout.items[d] : Array.from(agg([d]).m.keys());
    const dim = dimension(d);
    return [...chosen].sort((a, b) => (dim?.time ? a.localeCompare(b) : a.localeCompare(b, "fr")));
  };
  const rowItems = rowDims.map(itemsOf);
  const colItems = colDims.map(itemsOf);

  const count = (lists: string[][]) => lists.reduce((n, l) => n * Math.max(1, l.length), 1);
  if (count(rowItems) * count(colItems) > MAX_CELLS) {
    return { ...empty, error: `Le tableau dépasserait ${MAX_CELLS.toLocaleString("fr-FR")} cellules. Retenez moins d'éléments ou déplacez une dimension en filtre.` };
  }

  agg([...rowDims, ...colDims].filter(d => d !== DX)); // remonte les avertissements du niveau le plus fin

  const valueAt = (assign: Record<string, string>): PivotCell => {
    const met = assign[DX] ?? (metrics.length === 1 || !dxOnAxis ? metrics[0] : null);
    if (!met) return { value: null, metric: null };
    const { sorted, m } = agg(Object.keys(assign).filter(d => d !== DX));
    const vals = m.get(sorted.map(d => assign[d]).join("\u0000"));
    return { value: vals ? vals[metrics.indexOf(met)] : null, metric: met };
  };

  const rowsAll = buildEntries(rowDims, rowItems, options, metrics.length);
  const colsAll = buildEntries(colDims, colItems, options, metrics.length);

  const assignOf = (dims: string[], e: AxisEntry) => Object.fromEntries(e.tuple.map((v, i) => [dims[i], v]));
  const cellAt = (r: AxisEntry, c: AxisEntry) => valueAt({ ...assignOf(rowDims, r), ...assignOf(colDims, c) });

  // Masquage des lignes / colonnes vides (évalué sur les cellules de données)
  const dataCols = colsAll.filter(c => c.kind === "data");
  let rows = rowsAll;
  if (options.hideEmptyRows && rowDims.length) {
    const keep = new Set(rowsAll.filter(r => r.kind === "data" && dataCols.some(c => cellAt(r, c).value !== null)).map(r => r.tuple.join("\u0000")));
    rows = pruneEntries(rowsAll, keep);
  }
  let cols = colsAll;
  if (options.hideEmptyCols && colDims.length) {
    const dataRows = rows.filter(r => r.kind === "data");
    const keep = new Set(colsAll.filter(c => c.kind === "data" && dataRows.some(r => cellAt(r, c).value !== null)).map(c => c.tuple.join("\u0000")));
    cols = pruneEntries(colsAll, keep);
  }

  let cells = rows.map(r => cols.map(c => cellAt(r, c)));

  // Tri par une colonne (une seule dimension en lignes, comme DHIS2)
  if (layout.sort && rowDims.length === 1 && layout.sort.col < cols.length) {
    const { col, dir } = layout.sort;
    const order = rows.map((r, i) => i).filter(i => rows[i].kind === "data");
    order.sort((a, b) => (dir === "asc" ? 1 : -1) * ((cells[a][col].value ?? -Infinity) - (cells[b][col].value ?? -Infinity)));
    const tail = rows.map((r, i) => i).filter(i => rows[i].kind !== "data");
    const idx = [...order, ...tail];
    rows = idx.map(i => rows[i]);
    cells = idx.map(i => cells[i]);
  }

  const maxByMetric: Record<string, number> = {};
  rows.forEach((r, i) => cols.forEach((c, j) => {
    const { value, metric: m } = cells[i][j];
    if (r.kind === "data" && c.kind === "data" && m && value !== null) maxByMetric[m] = Math.max(maxByMetric[m] ?? 0, Math.abs(value));
  }));

  return {
    rowDims, colDims, rows, cols, cells,
    rowHeaders: headerGrid(rowDims, rows),
    colHeaders: headerGrid(colDims, cols),
    maxByMetric, warnings: Array.from(warnings), notes,
  };
}

/** Ordre DHIS2 : éléments, sous-totaux après chaque groupe, total à la fin. */
function buildEntries(dims: string[], items: string[][], o: PivotOptions, nMetrics: number): AxisEntry[] {
  if (!dims.length) return [{ kind: "data", tuple: [] }];
  const dxIdx = dims.indexOf(DX);
  // Un total qui mélangerait plusieurs métriques n'a pas de sens : on ne le produit pas.
  const resolvable = (fixed: number) => dxIdx < 0 || dxIdx < fixed || nMetrics === 1;
  const out: AxisEntry[] = [];
  const walk = (level: number, prefix: string[]) => {
    for (const it of items[level]) {
      const t = [...prefix, it];
      if (level === dims.length - 1) out.push({ kind: "data", tuple: t });
      else {
        walk(level + 1, t);
        if (o.subtotals && resolvable(t.length)) out.push({ kind: "subtotal", tuple: t });
      }
    }
  };
  walk(0, []);
  if (o.totals && resolvable(0)) out.push({ kind: "total", tuple: [] });
  return out;
}

/** Retire les entrées de données vides et les sous-totaux devenus orphelins. */
function pruneEntries(entries: AxisEntry[], keepData: Set<string>): AxisEntry[] {
  const kept = entries.filter(e => e.kind !== "data" || keepData.has(e.tuple.join("\u0000")));
  const data = kept.filter(e => e.kind === "data");
  return kept.filter(e => e.kind !== "subtotal" || data.some(d => e.tuple.every((v, i) => d.tuple[i] === v)));
}

/** Cellules d'en-tête fusionnées : headers[niveau][entrée], null = cellule couverte. */
function headerGrid(dims: string[], entries: AxisEntry[]): (HeaderCell | null)[][] {
  const n = dims.length;
  const grid: (HeaderCell | null)[][] = Array.from({ length: n }, () => Array(entries.length).fill(null));
  for (let L = 0; L < n; L++) {
    let i = 0;
    while (i < entries.length) {
      const e = entries[i];
      if (e.kind === "total") {
        if (L === 0) grid[L][i] = { text: "Total", span: 1, cross: n, kind: "total" };
        i++; continue;
      }
      const k = e.tuple.length;
      if (e.kind === "subtotal" && L >= k) {
        if (L === k) grid[L][i] = { text: "Sous-total", span: 1, cross: n - k, kind: "subtotal" };
        i++; continue;
      }
      let j = i + 1;
      while (j < entries.length && entries[j].kind !== "total" && entries[j].tuple.length > L
        && entries[j].tuple.slice(0, L + 1).every((v, x) => v === e.tuple[x])) j++;
      grid[L][i] = { text: itemLabel(dims[L], e.tuple[L]), span: j - i, cross: 1, kind: "item" };
      i = j;
    }
  }
  return grid;
}

/* ─── Exports ────────────────────────────────────────────────── */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Tableau HTML avec cellules fusionnées, ouvrable dans Excel (.xls). */
export function pivotToHtml(p: PivotResult, fmt: (c: PivotCell) => string, title: string): string {
  const rl = Math.max(1, p.rowDims.length), cl = Math.max(1, p.colDims.length);
  const head: string[] = [];
  for (let L = 0; L < cl; L++) {
    const cells: string[] = [];
    if (L === 0) cells.push(`<th rowspan="${cl}" colspan="${rl}">${esc(p.rowDims.map(dimLabel).join(" / "))}</th>`);
    if (!p.colDims.length) cells.push(`<th>Valeur</th>`);
    else p.colHeaders[L].forEach(h => h && cells.push(`<th colspan="${h.span}" rowspan="${h.cross}">${esc(h.text)}</th>`));
    head.push(`<tr>${cells.join("")}</tr>`);
  }
  const body = p.rows.map((r, i) => {
    const cells: string[] = [];
    if (!p.rowDims.length) cells.push(`<th>Valeur</th>`);
    else for (let L = 0; L < p.rowDims.length; L++) {
      const h = p.rowHeaders[L][i];
      if (h) cells.push(`<th rowspan="${h.span}" colspan="${h.cross}">${esc(h.text)}</th>`);
    }
    p.cells[i].forEach(c => cells.push(`<td style="text-align:right">${esc(fmt(c))}</td>`));
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body><h3>${esc(title)}</h3>` +
    `<table border="1" cellspacing="0" cellpadding="4">${head.join("")}${body.join("")}</table></body></html>`;
}

/** CSV « à plat » : une ligne d'en-tête par niveau de colonne. */
export function pivotToRows(p: PivotResult, raw: (c: PivotCell) => string | number): (string | number)[][] {
  const rl = Math.max(1, p.rowDims.length);
  const colLabel = (e: AxisEntry, L: number) =>
    e.kind === "total" ? (L === 0 ? "Total" : "") : L < e.tuple.length ? itemLabel(p.colDims[L], e.tuple[L]) : L === e.tuple.length ? "Sous-total" : "";
  const rowLabel = (e: AxisEntry, L: number) =>
    e.kind === "total" ? (L === 0 ? "Total" : "") : L < e.tuple.length ? itemLabel(p.rowDims[L], e.tuple[L]) : L === e.tuple.length ? "Sous-total" : "";
  const header: (string | number)[][] = p.colDims.length
    ? p.colDims.map((d, L) => [...Array(rl).fill("").map((_, i) => (L === p.colDims.length - 1 ? (p.rowDims[i] ? dimLabel(p.rowDims[i]) : "") : "")), ...p.cols.map(c => colLabel(c, L))])
    : [[...Array(rl).fill(""), "Valeur"]];
  const body = p.rows.map((r, i) => [
    ...(p.rowDims.length ? p.rowDims.map((_, L) => rowLabel(r, L)) : ["Valeur"]),
    ...p.cells[i].map(raw),
  ]);
  return [...header, ...body];
}
