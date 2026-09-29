import { DIMENSIONS, METRICS, Query, Views, formatValue, query } from "./semantic";
import { PipelineRun } from "../engineering/pipeline";

/**
 * HERMES — agent d'analyse, désormais branché sur la couche sémantique :
 * ses constats et ses réponses sont calculés par les mêmes métriques
 * que les tableaux de bord (une seule source de vérité).
 */

export interface Insight {
  level: "good" | "warning" | "critical" | "info";
  title: string;
  detail: string;
  query?: Query;          // requête à ouvrir dans l'explorateur
}

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shift = (now: Date, months: number) => ym(new Date(now.getFullYear(), now.getMonth() + months, 1));

export function generateInsights(views: Views, run: PipelineRun, now: Date = new Date()): Insight[] {
  const out: Insight[] = [];
  const val = (q: Query, i = 0) => query(views, q).totals[i];

  // 1. Tendance du recouvrement : 3 derniers mois clos vs 3 précédents
  const recent = { from: shift(now, -3), to: shift(now, -1) };
  const before = { from: shift(now, -6), to: shift(now, -4) };
  const rNow = val({ metrics: ["taux_recouvrement"], ...recent });
  const rBefore = val({ metrics: ["taux_recouvrement"], ...before });
  if (rNow !== null && rBefore !== null) {
    const delta = (rNow - rBefore) * 100;
    out.push({
      level: delta >= 0 ? "good" : delta < -10 ? "critical" : "warning",
      title: `Recouvrement ${delta >= 0 ? "en hausse" : "en baisse"} de ${Math.abs(delta).toFixed(1).replace(".", ",")} pts`,
      detail: `${formatValue(rNow, "pct")} sur les 3 derniers mois clos contre ${formatValue(rBefore, "pct")} sur les 3 mois précédents.`,
      query: { metrics: ["taux_recouvrement", "encaisse", "attendu"], dimensions: ["mois"], from: before.from, to: recent.to },
    });
  }

  // 2. Plus gros débiteur
  const debt = query(views, { metrics: ["impayes_echus", "nb_impayes"], dimensions: ["locataire"], filters: { statut_bail: ["Actif"] }, sort: { by: "impayes_echus", dir: "desc" }, limit: 1 });
  const top = debt.rows[0];
  const totalDebt = val({ metrics: ["impayes_echus"] }) ?? 0;
  if (top && (top.values[0] ?? 0) > 0) {
    const share = totalDebt ? (top.values[0]! / totalDebt) : 0;
    out.push({
      level: share > 0.5 ? "critical" : "warning",
      title: `${top.labels[0]} concentre ${formatValue(share, "pct")} des impayés échus`,
      detail: `${formatValue(top.values[0], "money")} sur ${top.values[1]} échéance(s). Total échu du parc : ${formatValue(totalDebt, "money")}.`,
      query: { metrics: ["impayes_echus", "nb_impayes", "retard_moyen"], dimensions: ["locataire"], sort: { by: "impayes_echus", dir: "desc" } },
    });
  } else {
    out.push({ level: "good", title: "Aucun impayé échu", detail: "Tous les loyers échus sont réglés." });
  }

  // 3. Ville la moins performante
  const cities = query(views, { metrics: ["taux_recouvrement", "attendu"], dimensions: ["ville"], sort: { by: "taux_recouvrement", dir: "asc" } });
  if (cities.rows.length > 1) {
    const worst = cities.rows[0], best = cities.rows[cities.rows.length - 1];
    out.push({
      level: "info",
      title: `${worst.labels[0]} : recouvrement le plus faible`,
      detail: `${formatValue(worst.values[0], "pct")} contre ${formatValue(best.values[0], "pct")} à ${best.labels[0]}, sur tout l'historique.`,
      query: { metrics: ["taux_recouvrement", "encaisse", "impayes"], dimensions: ["ville"] },
    });
  }

  // 4. Coût de la vacance sur 12 mois
  const vac = query(views, { metrics: ["perte_vacance", "taux_occupation"], from: shift(now, -11), to: ym(now) });
  if ((vac.totals[0] ?? 0) > 0) {
    out.push({
      level: (vac.totals[1] ?? 1) < 0.7 ? "warning" : "info",
      title: `Vacance : ${formatValue(vac.totals[0], "money")} de loyers perdus sur 12 mois`,
      detail: `Taux d'occupation moyen ${formatValue(vac.totals[1], "pct")}.`,
      query: { metrics: ["perte_vacance", "taux_occupation"], dimensions: ["bien"], from: shift(now, -11), to: ym(now) },
    });
  }

  // 5. Canal dominant
  const ch = query(views, { metrics: ["encaisse"], dimensions: ["canal"], filters: { famille_canal: ["Mobile money", "Carte"] } });
  const chTotal = ch.totals[0] ?? 0;
  if (ch.rows.length && chTotal > 0) {
    out.push({
      level: "info",
      title: `${ch.rows[0].labels[0]} : ${formatValue(ch.rows[0].values[0]! / chTotal, "pct")} des encaissements`,
      detail: `Canal principal hors avances. ${ch.rows.length} canaux actifs.`,
      query: { metrics: ["encaisse", "echeances"], dimensions: ["canal"] },
    });
  }

  // 6. Prévision du mois prochain : loyers actifs × ponctualité récente
  const due = val({ metrics: ["attendu"], from: ym(now), to: ym(now), filters: { statut_bail: ["Actif"] } }) ?? 0;
  if (due > 0 && rNow !== null) {
    out.push({
      level: "info",
      title: `Prévision : ${formatValue(due * rNow, "money")} encaissés sur ${formatValue(due, "money")} attendus`,
      detail: `Projection = loyers actifs du mois × taux de recouvrement des 3 derniers mois (${formatValue(rNow, "pct")}).`,
    });
  }

  // 7. Qualité des données
  const failed = run.quality.filter(q => q.failed > 0);
  if (failed.length) {
    out.push({
      level: failed.some(q => q.severity === "error") ? "critical" : "warning",
      title: `${failed.length} contrôle(s) qualité en échec`,
      detail: failed.map(q => `${q.rule} (${q.failed})`).join(" · ") + (run.quarantined ? ` — ${run.quarantined} ligne(s) en quarantaine.` : ""),
    });
  }

  return out;
}

/* ─── Questions en langage naturel → requête sémantique ───────── */

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const METRIC_SYNONYMS: Record<string, string[]> = {
  encaisse: ["encaisse", "percu", "recette", "revenu", "chiffre", " paye"],
  attendu: ["attendu", " dus ", "facture"],
  impayes_echus: ["retard de paiement", "echu"],
  impayes: ["impaye", "dette", "reste", "arriere"],
  taux_recouvrement: ["recouvrement", "taux de paiement"],
  ponctualite: ["ponctu", "a temps", "a l'heure"],
  retard_moyen: ["retard moyen", "delai", "jours de retard"],
  taux_occupation: ["occupation", "occupe", "rempli"],
  perte_vacance: ["vacance", "vacant", "perte"],
  cautions: ["caution"],
  nouveaux_baux: ["nouveaux baux", "signature", "nouveau bail"],
  echeances: ["echeance", "nombre de loyer"],
};

const DIM_SYNONYMS: Record<string, string[]> = {
  mois: ["par mois", "mensuel", "evolution", "tendance", "chaque mois"],
  trimestre: ["trimestre"],
  annee: ["par an ", "par annee", "annuel"],
  ville: ["ville", "par commune"],
  district: ["district", "region"],
  type_bien: ["type", "categorie de bien"],
  bien: ["par bien", "par maison", "par logement", "maison", "logement"],
  locataire: ["locataire", "client", "qui "],
  canal: ["canal", "moyen de paiement", "methode", "operateur"],
  statut_paiement: ["statut"],
};

export function askHermes(question: string, now: Date = new Date()): { query: Query; understood: string } | null {
  const q = ` ${norm(question)} `;
  const mets = Object.entries(METRIC_SYNONYMS).filter(([, syn]) => syn.some(s => q.includes(s))).map(([id]) => id);
  if (!mets.length) return null;
  // "impayés" et "impayés échus" se recoupent : on garde le plus précis.
  const metrics = mets.includes("impayes_echus") ? mets.filter(m => m !== "impayes") : mets;
  const dims = Object.entries(DIM_SYNONYMS).filter(([, syn]) => syn.some(s => q.includes(s))).map(([id]) => id).slice(0, 2);

  const out: Query = { metrics: metrics.slice(0, 3), dimensions: dims };
  const n = /(\d+)\s*(derniers?\s*)?mois/.exec(q);
  if (n) { out.from = shift(now, -(+n[1] - 1)); out.to = ym(now); }
  else if (q.includes("cette annee")) { out.from = `${now.getFullYear()}-01`; out.to = ym(now); }
  else if (q.includes("ce mois")) { out.from = out.to = ym(now); }
  const topN = /top\s*(\d+)/.exec(q);
  if (topN) out.limit = +topN[1];

  const m = out.metrics.map(id => METRICS.find(x => x.id === id)!.label).join(", ");
  const d = dims.map(id => DIMENSIONS.find(x => x.id === id)!.label.toLowerCase()).join(" × ");
  return { query: out, understood: d ? `${m} par ${d}` : m };
}
