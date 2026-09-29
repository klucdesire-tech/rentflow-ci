import { MONTHS_SHORT } from "@/lib/data";
import {
  DimChannel, DimDate, DimLease, DimProperty,
  FactDeposit, FactOccupancy, FactRent, Warehouse,
} from "../warehouse/schema";

/**
 * HERMES — couche sémantique BI.
 * Définit une seule fois les métriques et dimensions métier ; tous les
 * tableaux de bord, l'explorateur et l'agent passent par `query()`.
 */

export type ViewName = "rent" | "occupancy" | "deposit";
export type Format = "money" | "pct" | "int" | "days";

/** Ligne "large" : un fait joint à ses dimensions. */
export interface WideRow {
  date: DimDate;
  property?: DimProperty;
  lease?: DimLease;
  channel?: DimChannel;
  rent?: FactRent;
  occ?: FactOccupancy;
  dep?: FactDeposit;
}

export type Views = Record<ViewName, WideRow[]>;

export function buildViews(wh: Warehouse): Views {
  const date = new Map(wh.dim_date.map(d => [d.date_key, d]));
  const prop = new Map(wh.dim_property.map(p => [p.property_key, p]));
  const lease = new Map(wh.dim_lease.map(l => [l.lease_key, l]));
  const chan = new Map(wh.dim_channel.map(c => [c.channel_key, c]));
  return {
    rent: wh.fact_rent.map(f => ({ date: date.get(f.date_key)!, property: prop.get(f.property_key), lease: lease.get(f.lease_key), channel: chan.get(f.channel_key), rent: f })),
    occupancy: wh.fact_occupancy.map(f => ({ date: date.get(f.date_key)!, property: prop.get(f.property_key), lease: f.lease_key ? lease.get(f.lease_key) : undefined, occ: f })),
    deposit: wh.fact_deposit.map(f => ({ date: date.get(f.date_key)!, property: prop.get(f.property_key), lease: lease.get(f.lease_key), dep: f })),
  };
}

/* ─── Dimensions ─────────────────────────────────────────────── */

export interface DimensionDef {
  id: string;
  label: string;
  time?: boolean;
  views: ViewName[];
  get: (r: WideRow) => string;
  display?: (v: string) => string;
}

const ALL: ViewName[] = ["rent", "occupancy", "deposit"];

export const DIMENSIONS: DimensionDef[] = [
  { id: "mois",       label: "Mois",           time: true, views: ALL, get: r => r.date.year_month,
    display: v => `${MONTHS_SHORT[+v.slice(5, 7) - 1]} ${v.slice(0, 4)}` },
  { id: "trimestre",  label: "Trimestre",      time: true, views: ALL, get: r => `${r.date.year}-T${r.date.quarter}` },
  { id: "annee",      label: "Année",          time: true, views: ALL, get: r => String(r.date.year) },
  { id: "ville",      label: "Ville",          views: ALL, get: r => r.property?.city ?? "Inconnue" },
  { id: "district",   label: "District",       views: ALL, get: r => r.property?.district ?? "Autre" },
  { id: "type_bien",  label: "Type de bien",   views: ALL, get: r => r.property?.property_type ?? "Inconnu" },
  { id: "bien",       label: "Bien",           views: ALL, get: r => r.property ? `${r.property.property_id} · ${r.property.address}` : "—" },
  { id: "locataire",  label: "Locataire",      views: ALL, get: r => r.lease?.tenant_name ?? "(vacant)" },
  { id: "statut_bail",label: "Statut du bail", views: ["rent", "deposit"], get: r => r.lease?.status === "closed" ? "Clôturé" : "Actif" },
  { id: "canal",      label: "Canal",          views: ["rent"], get: r => r.channel?.channel_name ?? "Non payé" },
  { id: "famille_canal", label: "Famille de canal", views: ["rent"], get: r => r.channel?.channel_family ?? "Aucun" },
  { id: "statut_paiement", label: "Statut paiement", views: ["rent"],
    get: r => !r.rent!.is_paid ? (r.rent!.is_overdue ? "Impayé échu" : "À venir") : r.rent!.paid_on_time ? "Payé à temps" : "Payé en retard" },
];

export const dimension = (id: string) => DIMENSIONS.find(d => d.id === id);

/* ─── Métriques ──────────────────────────────────────────────── */

export interface MetricDef {
  id: string;
  label: string;
  view: ViewName;
  format: Format;
  description: string;
  /** true si une hausse est une bonne nouvelle (sert aux insights). */
  higherIsBetter: boolean;
  compute: (rows: WideRow[]) => number | null;
}

const sum = (rows: WideRow[], f: (r: WideRow) => number) => rows.reduce((a, r) => a + f(r), 0);
const ratio = (n: number, d: number) => (d > 0 ? n / d : null);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const R = (r: WideRow) => r.rent!;
const O = (r: WideRow) => r.occ!;
const D = (r: WideRow) => r.dep!;

export const METRICS: MetricDef[] = [
  { id: "encaisse",     label: "Loyers encaissés",    view: "rent", format: "money", higherIsBetter: true,
    description: "Somme des loyers payés (y compris avances).", compute: rows => sum(rows, r => R(r).amount_paid) },
  { id: "attendu",      label: "Loyers attendus",     view: "rent", format: "money", higherIsBetter: true,
    description: "Somme des loyers dus sur la période.", compute: rows => sum(rows, r => R(r).amount_due) },
  { id: "impayes",      label: "Impayés",             view: "rent", format: "money", higherIsBetter: false,
    description: "Montant restant à recouvrer.", compute: rows => sum(rows, r => R(r).amount_outstanding) },
  { id: "impayes_echus",label: "Impayés échus",       view: "rent", format: "money", higherIsBetter: false,
    description: "Impayés dont l'échéance est dépassée.", compute: rows => sum(rows, r => (R(r).is_overdue ? R(r).amount_outstanding : 0)) },
  { id: "taux_recouvrement", label: "Taux de recouvrement", view: "rent", format: "pct", higherIsBetter: true,
    description: "Encaissé ÷ attendu, hors échéances pas encore arrivées à terme.",
    compute: rows => ratio(sum(rows, r => R(r).amount_paid), sum(rows, r => (R(r).is_paid || R(r).is_overdue ? R(r).amount_due : 0))) },
  { id: "ponctualite",  label: "Ponctualité",         view: "rent", format: "pct", higherIsBetter: true,
    description: "Part des paiements reçus au plus tard à l'échéance.",
    compute: rows => { const p = rows.filter(r => R(r).is_paid); return ratio(p.filter(r => R(r).paid_on_time).length, p.length); } },
  { id: "retard_moyen", label: "Retard moyen",        view: "rent", format: "days", higherIsBetter: false,
    description: "Jours moyens entre échéance et paiement (paiements hors avance, 0 si en avance).",
    compute: rows => avg(rows.filter(r => R(r).is_paid && r.channel?.channel_name !== "Avance").map(r => Math.max(0, R(r).days_late ?? 0))) },
  { id: "echeances",    label: "Échéances",           view: "rent", format: "int", higherIsBetter: true,
    description: "Nombre d'échéances de loyer.", compute: rows => rows.length },
  { id: "nb_impayes",   label: "Échéances impayées",  view: "rent", format: "int", higherIsBetter: false,
    description: "Nombre d'échéances non réglées.", compute: rows => rows.filter(r => !R(r).is_paid).length },
  { id: "taux_occupation", label: "Taux d'occupation", view: "occupancy", format: "pct", higherIsBetter: true,
    description: "Mois-biens occupés ÷ mois-biens disponibles.", compute: rows => ratio(rows.filter(r => O(r).is_occupied).length, rows.length) },
  { id: "revenu_potentiel", label: "Revenu potentiel", view: "occupancy", format: "money", higherIsBetter: true,
    description: "Loyer catalogue × mois-biens (parc 100 % loué).", compute: rows => sum(rows, r => O(r).potential_rent) },
  { id: "perte_vacance", label: "Perte de vacance",   view: "occupancy", format: "money", higherIsBetter: false,
    description: "Loyer catalogue des mois-biens vacants.", compute: rows => sum(rows, r => (O(r).is_occupied ? 0 : O(r).potential_rent)) },
  { id: "cautions",     label: "Cautions encaissées", view: "deposit", format: "money", higherIsBetter: true,
    description: "Cautions versées à la signature.", compute: rows => sum(rows, r => (D(r).caution_paid ? D(r).caution_amount : 0)) },
  { id: "cautions_dues",label: "Cautions non versées", view: "deposit", format: "money", higherIsBetter: false,
    description: "Cautions prévues mais non versées.", compute: rows => sum(rows, r => (D(r).caution_paid ? 0 : D(r).caution_amount)) },
  { id: "nouveaux_baux",label: "Nouveaux baux",       view: "deposit", format: "int", higherIsBetter: true,
    description: "Baux signés sur la période.", compute: rows => rows.length },
];

export const metric = (id: string) => METRICS.find(m => m.id === id);

export function formatValue(v: number | null | undefined, f: Format): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  switch (f) {
    case "money": return new Intl.NumberFormat("fr-FR").format(Math.round(v)) + " FCFA";
    case "pct":   return `${(v * 100).toFixed(1).replace(".", ",")} %`;
    case "days":  return `${v.toFixed(1).replace(".", ",")} j`;
    default:      return new Intl.NumberFormat("fr-FR").format(Math.round(v));
  }
}

/** Format compact pour axes et étiquettes : 1,2 M · 150 k · 87 %. */
export function formatCompact(v: number | null, f: Format): string {
  if (v === null) return "—";
  if (f === "pct") return `${Math.round(v * 100)} %`;
  if (f === "days") return `${Math.round(v)} j`;
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",")} M`;
  if (a >= 1e3) return `${Math.round(v / 1e3)} k`;
  return String(Math.round(v));
}

/* ─── Moteur de requêtes (OLAP en mémoire) ───────────────────── */

export interface Query {
  metrics: string[];
  dimensions?: string[];
  filters?: Record<string, string[]>;
  from?: string;          // "AAAA-MM" inclus
  to?: string;            // "AAAA-MM" inclus
  sort?: { by: string; dir: "asc" | "desc" };
  limit?: number;
}

export interface ResultRow {
  keys: string[];         // valeurs brutes des dimensions
  labels: string[];       // valeurs affichées
  values: (number | null)[];
}

export interface QueryResult {
  query: Query;
  dimensions: DimensionDef[];
  metrics: MetricDef[];
  rows: ResultRow[];
  totals: (number | null)[];
  warnings: string[];
}

export function query(views: Views, q: Query): QueryResult {
  const dims = (q.dimensions ?? []).map(id => dimension(id)).filter((d): d is DimensionDef => !!d);
  const mets = q.metrics.map(id => metric(id)).filter((m): m is MetricDef => !!m);
  const warnings: string[] = [];
  const filters = Object.entries(q.filters ?? {}).filter(([, v]) => v.length > 0);

  const groups = new Map<string, { keys: string[]; byView: Partial<Record<ViewName, WideRow[]>> }>();
  const totalsRows: Partial<Record<ViewName, WideRow[]>> = {};

  for (const view of Array.from(new Set(mets.map(m => m.view)))) {
    const inapplicable = [...dims.map(d => d.id), ...filters.map(([id]) => id)]
      .map(id => dimension(id)).filter(d => d && !d.views.includes(view));
    if (inapplicable.length) {
      const names = mets.filter(m => m.view === view).map(m => m.label).join(", ");
      warnings.push(`${names} : non ventilable par ${inapplicable.map(d => d!.label).join(", ")}.`);
      continue;
    }
    const rows = views[view].filter(r =>
      (!q.from || r.date.year_month >= q.from) &&
      (!q.to || r.date.year_month <= q.to) &&
      filters.every(([id, vals]) => vals.includes(dimension(id)!.get(r))));
    totalsRows[view] = rows;
    for (const r of rows) {
      const keys = dims.map(d => d.get(r));
      const k = keys.join("\u0000");
      const g = groups.get(k) ?? { keys, byView: {} };
      (g.byView[view] ??= []).push(r);
      groups.set(k, g);
    }
  }

  const evalMetric = (m: MetricDef, byView: Partial<Record<ViewName, WideRow[]>>) => {
    if (!(m.view in totalsRows)) return null;
    const rows = byView[m.view];
    return rows ? m.compute(rows) : m.compute([]);
  };

  let rows: ResultRow[] = Array.from(groups.values()).map(g => ({
    keys: g.keys,
    labels: g.keys.map((k, i) => dims[i].display?.(k) ?? k),
    values: mets.map(m => evalMetric(m, g.byView)),
  }));

  const sortBy = q.sort?.by;
  const mi = sortBy ? mets.findIndex(m => m.id === sortBy) : -1;
  const di = sortBy ? dims.findIndex(d => d.id === sortBy) : -1;
  const dir = q.sort?.dir === "asc" ? 1 : -1;
  if (mi >= 0) rows.sort((a, b) => dir * ((a.values[mi] ?? -Infinity) - (b.values[mi] ?? -Infinity)));
  else if (di >= 0) rows.sort((a, b) => dir * a.keys[di].localeCompare(b.keys[di]));
  else if (dims[0]?.time) rows.sort((a, b) => a.keys.join().localeCompare(b.keys.join()));
  else if (mets.length) rows.sort((a, b) => (b.values[0] ?? -Infinity) - (a.values[0] ?? -Infinity));

  if (q.limit) rows = rows.slice(0, q.limit);

  return { query: q, dimensions: dims, metrics: mets, rows, totals: mets.map(m => evalMetric(m, totalsRows)), warnings };
}

/** Valeurs distinctes d'une dimension (pour les filtres). */
export function dimensionValues(views: Views, id: string): string[] {
  const d = dimension(id);
  if (!d) return [];
  const set = new Set<string>();
  d.views.forEach(v => views[v].forEach(r => set.add(d.get(r))));
  return Array.from(set).sort((a, b) => a.localeCompare(b, "fr"));
}
