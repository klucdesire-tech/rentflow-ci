import { Query, ViewName, dimension, metric } from "./semantic";

/**
 * Traduit une requête sémantique en SQL Postgres sur les marts HERMES
 * (sql/hermes/002_marts.sql). Garantit que le calcul en mémoire et le
 * calcul en entrepôt partagent la même définition.
 */

const MART: Record<ViewName, string> = {
  rent: "hermes.mart_rent",
  occupancy: "hermes.mart_occupancy",
  deposit: "hermes.mart_deposit",
};

export const METRIC_SQL: Record<string, string> = {
  encaisse:          "SUM(amount_paid)",
  attendu:           "SUM(amount_due)",
  impayes:           "SUM(amount_outstanding)",
  impayes_echus:     "SUM(amount_outstanding) FILTER (WHERE is_overdue)",
  taux_recouvrement: "SUM(amount_paid)::numeric / NULLIF(SUM(amount_due) FILTER (WHERE is_paid OR is_overdue), 0)",
  ponctualite:       "COUNT(*) FILTER (WHERE paid_on_time)::numeric / NULLIF(COUNT(*) FILTER (WHERE is_paid), 0)",
  retard_moyen:      "AVG(GREATEST(days_late, 0)) FILTER (WHERE is_paid AND channel_name <> 'Avance')",
  echeances:         "COUNT(*)",
  nb_impayes:        "COUNT(*) FILTER (WHERE NOT is_paid)",
  taux_occupation:   "AVG(is_occupied::int)",
  revenu_potentiel:  "SUM(potential_rent)",
  perte_vacance:     "SUM(potential_rent) FILTER (WHERE NOT is_occupied)",
  cautions:          "SUM(caution_amount) FILTER (WHERE caution_paid)",
  cautions_dues:     "SUM(caution_amount) FILTER (WHERE NOT caution_paid)",
  nouveaux_baux:     "COUNT(*)",
};

export const DIM_SQL: Record<string, string> = {
  mois: "year_month", trimestre: "year_quarter", annee: "year",
  ville: "city", district: "district", type_bien: "property_type", bien: "property_label",
  locataire: "tenant_name", statut_bail: "lease_status", canal: "channel_name",
  famille_canal: "channel_family", statut_paiement: "payment_status",
};

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

export function toSql(q: Query): string {
  const dims = (q.dimensions ?? []).filter(id => dimension(id));
  const byView = new Map<ViewName, string[]>();
  q.metrics.forEach(id => {
    const m = metric(id);
    if (m) byView.set(m.view, [...(byView.get(m.view) ?? []), id]);
  });

  return Array.from(byView.entries()).map(([view, mets]) => {
    const where: string[] = [];
    if (q.from) where.push(`year_month >= ${lit(q.from)}`);
    if (q.to) where.push(`year_month <= ${lit(q.to)}`);
    Object.entries(q.filters ?? {}).forEach(([id, vals]) => {
      if (vals.length && DIM_SQL[id]) where.push(`${DIM_SQL[id]} IN (${vals.map(lit).join(", ")})`);
    });
    const select = [...dims.map(d => `  ${DIM_SQL[d]} AS ${d}`), ...mets.map(m => `  ${METRIC_SQL[m]} AS ${m}`)].join(",\n");
    const lines = [`SELECT\n${select}`, `FROM ${MART[view]}`];
    if (where.length) lines.push(`WHERE ${where.join("\n  AND ")}`);
    if (dims.length) lines.push(`GROUP BY ${dims.map((_, i) => i + 1).join(", ")}`);
    if (q.sort) lines.push(`ORDER BY ${q.sort.by} ${q.sort.dir.toUpperCase()}`);
    else if (dims.length) lines.push(`ORDER BY 1`);
    if (q.limit) lines.push(`LIMIT ${q.limit}`);
    return lines.join("\n") + ";";
  }).join("\n\n");
}
