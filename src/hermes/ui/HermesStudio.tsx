"use client";
import { useMemo, useState } from "react";
import { Contract, House } from "@/types";
import { runPipeline, LINEAGE, PipelineRun } from "../engineering/pipeline";
import { TABLES, TableName, Warehouse } from "../warehouse/schema";
import {
  DIMENSIONS, METRICS, Query, QueryResult, Views,
  buildViews, dimension, dimensionValues, formatValue, metric, query,
} from "../bi/semantic";
import { toSql } from "../bi/sql";
import { askHermes, generateInsights, Insight } from "../bi/agent";
import { downloadCsv, resultToCsv, tableToCsv } from "../bi/export";
import { BarList, CellStatus, ColumnChart, Empty, INK, Legend, LineChart, SERIES, STATUS, StatusHeatmap } from "./charts";

/* ─── Styles ──────────────────────────────────────────────────── */
const card: React.CSSProperties = { background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,.06)", border: "1px solid #E9EAEC", minWidth: 0 };
const h1: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: "#1C1E21", letterSpacing: "-0.5px" };
const cardTitle: React.CSSProperties = { fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 2 };
const cardSub: React.CSSProperties = { fontSize: 11, color: "#6B7280", marginBottom: 14 };
const select: React.CSSProperties = { padding: "8px 10px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontFamily: "inherit", background: "#fff", color: INK.primary, maxWidth: "100%" };
const btn: React.CSSProperties = { padding: "8px 14px", background: "#1877F2", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit" };
const ghost: React.CSSProperties = { ...btn, background: "#F3F4F6", color: "#374151" };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 11, color: "#6B7280", fontWeight: 700, background: "#F8FAFC", whiteSpace: "nowrap", position: "sticky", top: 0 };
const td: React.CSSProperties = { padding: "7px 10px", fontSize: 12, color: "#374151", borderTop: "1px solid #F1F5F9", whiteSpace: "nowrap" };
const grid = (min: number): React.CSSProperties => ({ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 14, marginBottom: 14 });

const LEVEL: Record<Insight["level"], { color: string; bg: string; icon: string; label: string }> = {
  good:     { color: STATUS.good,     bg: "#F0FDF4", icon: "✓", label: "Positif" },
  warning:  { color: "#B45309",       bg: "#FFFBEB", icon: "!", label: "Vigilance" },
  critical: { color: STATUS.critical, bg: "#FEF2F2", icon: "✕", label: "Critique" },
  info:     { color: SERIES[0],       bg: "#EFF6FF", icon: "i", label: "Info" },
};

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shift = (now: Date, m: number) => ym(new Date(now.getFullYear(), now.getMonth() + m, 1));

type Tab = "dashboard" | "explorer" | "warehouse" | "pipeline" | "agent";

/* ═══ Composant racine ═══════════════════════════════════════════ */

export default function HermesStudio({ houses, contracts }: { houses: House[]; contracts: Contract[] }) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [runSeq, setRunSeq] = useState(0);
  const [history, setHistory] = useState<PipelineRun[]>([]);
  const [explorerQuery, setExplorerQuery] = useState<Query>({ metrics: ["encaisse", "attendu"], dimensions: ["mois"] });

  const now = useMemo(() => new Date(), [runSeq]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = useMemo(() => runPipeline(houses, contracts, now), [houses, contracts, now]);
  const views = useMemo(() => buildViews(run.warehouse), [run]);
  const insights = useMemo(() => generateInsights(views, run, now), [views, run, now]);

  const rerun = () => { setHistory(h => [run, ...h].slice(0, 9)); setRunSeq(s => s + 1); };
  const explore = (q: Query) => { setExplorerQuery(q); setTab("explorer"); };

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Tableau de bord" },
    { id: "explorer",  label: "Explorateur BI" },
    { id: "agent",     label: `Agent HERMES (${insights.length})` },
    { id: "warehouse", label: "Entrepôt" },
    { id: "pipeline",  label: "Pipeline" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <h1 className="rf-page-title" style={h1}>HERMES Analytics</h1>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
            Data Engineering · Data Warehouse · BI · Dashboards — actualisé {new Date(run.startedAt).toLocaleTimeString("fr-FR")}
          </div>
        </div>
        <PipelineBadge run={run} onClick={() => setTab("pipeline")} />
      </div>

      <div role="tablist" style={{ display: "flex", gap: 4, background: "#E9EBEF", padding: 4, borderRadius: 10, marginBottom: 18, overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            style={{ flex: "1 0 auto", padding: "8px 12px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              background: tab === t.id ? "#fff" : "transparent", color: tab === t.id ? INK.primary : "#64748B", boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <DashboardTab views={views} now={now} onExplore={explore} />}
      {tab === "explorer"  && <ExplorerTab views={views} q={explorerQuery} setQ={setExplorerQuery} now={now} />}
      {tab === "agent"     && <AgentTab insights={insights} onExplore={explore} now={now} />}
      {tab === "warehouse" && <WarehouseTab wh={run.warehouse} />}
      {tab === "pipeline"  && <PipelineTab run={run} history={history} onRun={rerun} />}
    </div>
  );
}

function PipelineBadge({ run, onClick }: { run: PipelineRun; onClick: () => void }) {
  const s = { success: { c: STATUS.good, l: "Pipeline OK", i: "✓" }, warning: { c: "#B45309", l: "Pipeline : avertissements", i: "!" }, quarantine: { c: STATUS.critical, l: "Pipeline : quarantaine", i: "✕" } }[run.status];
  return (
    <button onClick={onClick} style={{ ...ghost, background: "#fff", border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 18, height: 18, borderRadius: 9, background: s.c, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{s.i}</span>
      {s.l}
    </button>
  );
}

/* ═══ Tableau de bord ════════════════════════════════════════════ */

function Kpi({ label, value, prev, fmt, higherIsBetter, hint }: {
  label: string; value: number | null; prev?: number | null; fmt: "money" | "pct" | "days" | "int"; higherIsBetter: boolean; hint: string;
}) {
  const delta = value !== null && prev !== null && prev !== undefined ? value - prev : null;
  const good = delta === null || delta === 0 ? null : (delta > 0) === higherIsBetter;
  const dTxt = delta === null ? null : fmt === "pct" ? `${delta >= 0 ? "+" : "−"}${Math.abs(delta * 100).toFixed(1).replace(".", ",")} pts`
    : prev ? `${delta >= 0 ? "+" : "−"}${Math.abs((delta / prev) * 100).toFixed(0)} %` : null;
  return (
    <div style={{ ...card, padding: "16px 14px" }} title={hint}>
      <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: "clamp(16px, 4.2vw, 22px)", fontWeight: 800, color: INK.primary, letterSpacing: "-0.5px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{formatValue(value, fmt)}</div>
      {dTxt && (
        <div style={{ fontSize: 11, marginTop: 4, color: good === null ? INK.secondary : good ? "#15803D" : "#B91C1C", fontWeight: 700 }}>
          {delta! >= 0 ? "▲" : "▼"} {dTxt} <span style={{ color: INK.muted, fontWeight: 500 }}>vs période préc.</span>
        </div>
      )}
    </div>
  );
}

function DashboardTab({ views, now, onExplore }: { views: Views; now: Date; onExplore: (q: Query) => void }) {
  const [period, setPeriod] = useState<"6" | "12" | "all">("12");
  const [city, setCity] = useState("");

  const n = period === "all" ? 0 : +period;
  const range = n ? { from: shift(now, -(n - 1)), to: ym(now) } : {};
  const prevRange = n ? { from: shift(now, -(2 * n - 1)), to: shift(now, -n) } : null;
  const filters: Record<string, string[]> = city ? { ville: [city] } : {};
  const cities = dimensionValues(views, "ville");

  const kpiIds = ["encaisse", "taux_recouvrement", "impayes_echus", "taux_occupation", "retard_moyen"];
  const cur = query(views, { metrics: kpiIds, filters, ...range });
  const prev = prevRange ? query(views, { metrics: kpiIds, filters, ...prevRange }) : null;

  const monthly = query(views, { metrics: ["attendu", "encaisse", "taux_occupation", "taux_recouvrement"], dimensions: ["mois"], filters, ...range });
  const labels = monthly.rows.map(r => r.labels[0]);
  const byCity = query(views, { metrics: ["taux_recouvrement", "attendu"], dimensions: ["ville"], filters, ...range, sort: { by: "taux_recouvrement", dir: "desc" } });
  const byChannel = query(views, { metrics: ["encaisse"], dimensions: ["canal"], filters: { ...filters, famille_canal: ["Mobile money", "Carte"] }, ...range });
  const debtors = query(views, { metrics: ["impayes_echus", "nb_impayes", "retard_moyen", "ponctualite"], dimensions: ["locataire"], filters: { ...filters, statut_bail: ["Actif"] }, sort: { by: "impayes_echus", dir: "desc" } });

  // Heatmap : 12 derniers mois × locataires ayant une échéance sur la fenêtre
  const months = Array.from({ length: 12 }, (_, i) => shift(now, i - 11));
  const heatRows = useMemo(() => {
    const byLease = new Map<string, Map<string, { status: CellStatus; detail: string }>>();
    views.rent.forEach(r => {
      if (city && r.property?.city !== city) return;
      if (!months.includes(r.date.year_month)) return;
      const f = r.rent!;
      const status: CellStatus = !f.is_paid ? (f.is_overdue ? "overdue" : "pending") : f.paid_on_time ? "ontime" : "late";
      const detail = `${r.lease!.tenant_name} — ${r.date.month_label} : ${formatValue(f.amount_due, "money")} · ` +
        (f.is_paid ? `payé via ${r.channel?.channel_name}${f.days_late && f.days_late > 0 ? ` (+${f.days_late} j)` : ""}` : f.is_overdue ? `impayé depuis ${f.days_overdue} j` : "à venir");
      const key = `${r.lease!.lease_id} · ${r.lease!.tenant_name}`;
      if (!byLease.has(key)) byLease.set(key, new Map());
      byLease.get(key)!.set(r.date.year_month, { status, detail });
    });
    return Array.from(byLease.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([label, cells]) => ({
      label: label.split(" · ")[1],
      cells: months.map(m => cells.get(m) ?? { status: "none" as CellStatus, detail: "Hors bail" }),
    }));
  }, [views, city, months.join()]); // eslint-disable-line react-hooks/exhaustive-deps

  const tot = byChannel.totals[0] ?? 0;

  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 3 }}>
          {([["6", "6 mois"], ["12", "12 mois"], ["all", "Tout"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{ padding: "6px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              background: period === v ? "#0F172A" : "transparent", color: period === v ? "#fff" : "#475569" }}>{l}</button>
          ))}
        </div>
        <select style={select} value={city} onChange={e => setCity(e.target.value)} aria-label="Ville">
          <option value="">Toutes les villes</option>
          {cities.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={grid(170)}>
        {kpiIds.map((id, i) => {
          const m = metric(id)!;
          return <Kpi key={id} label={m.label} value={cur.totals[i]} prev={prev?.totals[i]} fmt={m.format} higherIsBetter={m.higherIsBetter} hint={m.description} />;
        })}
      </div>

      <div style={grid(320)}>
        <div style={card}>
          <div style={cardTitle}>Loyers attendus vs encaissés</div>
          <div style={cardSub}>Par mois d'échéance, en FCFA</div>
          <LineChart labels={labels} format="money" series={[
            { name: "Attendus", values: monthly.rows.map(r => r.values[0]), color: SERIES[0], dashed: true },
            { name: "Encaissés", values: monthly.rows.map(r => r.values[1]), color: SERIES[2] },
          ]} />
          <div style={{ marginTop: 8 }}><Legend items={[{ label: "Attendus (pointillés)", color: SERIES[0] }, { label: "Encaissés", color: SERIES[2] }]} /></div>
        </div>
        <div style={card}>
          <div style={cardTitle}>Taux d'occupation du parc</div>
          <div style={cardSub}>Part des biens loués chaque mois</div>
          <ColumnChart labels={labels} values={monthly.rows.map(r => r.values[2])} format="pct" highlightLast />
        </div>
      </div>

      <div style={grid(300)}>
        <div style={card}>
          <div style={cardTitle}>Recouvrement par ville</div>
          <div style={cardSub}>Encaissé ÷ attendu sur la période</div>
          <BarList format="pct" rows={byCity.rows.map(r => ({ label: r.labels[0], value: r.values[0], hint: `Attendu : ${formatValue(r.values[1], "money")}` }))} />
        </div>
        <div style={card}>
          <div style={cardTitle}>Encaissements par canal</div>
          <div style={cardSub}>Hors avances versées à la signature</div>
          <BarList format="money" total={tot} color={SERIES[1]} rows={byChannel.rows.map(r => ({ label: r.labels[0], value: r.values[0] }))} />
        </div>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={cardTitle}>Historique de paiement — 12 derniers mois</div>
        <div style={cardSub}>Chaque case = une échéance ; survolez pour le détail</div>
        <StatusHeatmap rows={heatRows} months={months.map(m => dimension("mois")!.display!(m).slice(0, 3))} />
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <div><div style={cardTitle}>Locataires actifs — risque d'impayé</div><div style={cardSub}>Tous mois confondus</div></div>
          <button style={ghost} onClick={() => onExplore(debtors.query)}>Ouvrir dans l'explorateur →</button>
        </div>
        <ResultTable r={debtors} />
      </div>
    </>
  );
}

/* ═══ Explorateur BI ═════════════════════════════════════════════ */

function ExplorerTab({ views, q, setQ, now }: { views: Views; q: Query; setQ: (q: Query) => void; now: Date }) {
  const [question, setQuestion] = useState("");
  const [understood, setUnderstood] = useState<string | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [filterDim, setFilterDim] = useState(Object.keys(q.filters ?? {})[0] ?? "ville");

  const res = useMemo(() => query(views, q), [views, q]);
  const months = useMemo(() => dimensionValues(views, "mois"), [views]);
  const filterValues = useMemo(() => dimensionValues(views, filterDim), [views, filterDim]);
  const dims = q.dimensions ?? [];
  const selected = q.filters?.[filterDim] ?? [];

  const toggleMetric = (id: string) => {
    const has = q.metrics.includes(id);
    const metrics = has ? q.metrics.filter(m => m !== id) : [...q.metrics, id];
    if (metrics.length) setQ({ ...q, metrics, sort: has && q.sort?.by === id ? undefined : q.sort });
  };
  const setDim = (i: number, id: string) => {
    const next = [...dims];
    if (id) next[i] = id; else next.splice(i, 1);
    setQ({ ...q, dimensions: Array.from(new Set(next.filter(Boolean))), sort: undefined });
  };
  const toggleFilter = (v: string) => {
    const vals = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
    const filters = { ...(q.filters ?? {}), [filterDim]: vals };
    if (!vals.length) delete filters[filterDim];
    setQ({ ...q, filters });
  };
  const ask = () => {
    const a = askHermes(question, now);
    if (!a) { setUnderstood("Je n'ai pas reconnu de métrique. Essayez : « taux de recouvrement par ville sur 6 mois »."); return; }
    setUnderstood(`Compris : ${a.understood}`);
    setQ(a.query);
  };

  return (
    <>
      <div style={{ ...card, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: INK.primary }}>Demander à HERMES</span>
        <input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === "Enter" && ask()}
          placeholder="ex. impayés par locataire, occupation par mois sur 12 mois, top 3 villes par encaissements…"
          style={{ ...select, flex: "1 1 260px", padding: "9px 12px" }} />
        <button style={btn} onClick={ask}>Analyser</button>
        {understood && <div style={{ flexBasis: "100%", fontSize: 12, color: INK.secondary }}>{understood}</div>}
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ ...cardTitle, marginBottom: 8 }}>Métriques</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {METRICS.map(m => {
            const on = q.metrics.includes(m.id);
            return (
              <button key={m.id} title={m.description} onClick={() => toggleMetric(m.id)}
                style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  border: `1.5px solid ${on ? "#1877F2" : "#E5E7EB"}`, background: on ? "#EFF6FF" : "#fff", color: on ? "#1D4ED8" : "#475569" }}>
                {on ? "✓ " : ""}{m.label}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {[0, 1].map(i => (
            <select key={i} style={select} value={dims[i] ?? ""} onChange={e => setDim(i, e.target.value)} disabled={i === 1 && !dims[0]} aria-label={`Dimension ${i + 1}`}>
              <option value="">{i === 0 ? "Sans ventilation" : "+ 2e dimension"}</option>
              {DIMENSIONS.filter(d => d.id === dims[i] || !dims.includes(d.id)).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          ))}
          <select style={select} value={q.from ?? ""} onChange={e => setQ({ ...q, from: e.target.value || undefined })} aria-label="Du">
            <option value="">Depuis le début</option>
            {months.map(m => <option key={m} value={m}>Depuis {dimension("mois")!.display!(m)}</option>)}
          </select>
          <select style={select} value={q.to ?? ""} onChange={e => setQ({ ...q, to: e.target.value || undefined })} aria-label="Au">
            <option value="">Jusqu'à aujourd'hui</option>
            {months.map(m => <option key={m} value={m}>Jusqu'à {dimension("mois")!.display!(m)}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
          <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 700 }}>Filtre</span>
          <select style={{ ...select, padding: "5px 8px" }} value={filterDim} onChange={e => setFilterDim(e.target.value)} aria-label="Dimension de filtre">
            {DIMENSIONS.filter(d => !d.time).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          {filterValues.map(v => {
            const on = selected.includes(v);
            return (
              <button key={v} onClick={() => toggleFilter(v)}
                style={{ padding: "4px 9px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
                  border: `1px solid ${on ? "#0F172A" : "#E5E7EB"}`, background: on ? "#0F172A" : "#fff", color: on ? "#fff" : "#475569" }}>{v}</button>
            );
          })}
          {Object.keys(q.filters ?? {}).length > 0 && (
            <button style={{ ...ghost, padding: "4px 9px", fontSize: 11 }} onClick={() => setQ({ ...q, filters: {} })}>Effacer les filtres</button>
          )}
        </div>
      </div>

      {res.warnings.map(w => (
        <div key={w} style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: 8, padding: "8px 12px", fontSize: 12, marginBottom: 10 }}>⚠ {w}</div>
      ))}

      <div style={{ ...card, marginBottom: 14 }}>
        <Visual res={res} />
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={cardTitle}>{res.rows.length} ligne(s)</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={ghost} onClick={() => setShowSql(s => !s)}>{showSql ? "Masquer" : "Voir"} le SQL</button>
            <button style={btn} onClick={() => downloadCsv(`hermes_${(q.dimensions ?? []).join("_") || "total"}.csv`, resultToCsv(res))}>Exporter CSV</button>
          </div>
        </div>
        {showSql && (
          <pre style={{ background: "#0F172A", color: "#E2E8F0", borderRadius: 8, padding: 12, fontSize: 11, overflowX: "auto", marginBottom: 12 }}>{toSql(q)}</pre>
        )}
        <ResultTable r={res} onSort={by => setQ({ ...q, sort: { by, dir: q.sort?.by === by && q.sort.dir === "desc" ? "asc" : "desc" } })} />
      </div>
    </>
  );
}

/** Choisit la forme selon la requête : tuiles, courbe temporelle, barres classées ou tableau croisé. */
function Visual({ res }: { res: QueryResult }) {
  const [d0, d1] = res.dimensions;
  const m0 = res.metrics[0];
  if (!m0) return <Empty text="Sélectionnez au moins une métrique." />;

  if (!d0) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 12 }}>
      {res.metrics.map((m, i) => (
        <div key={m.id} title={m.description}>
          <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{m.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: INK.primary }}>{formatValue(res.totals[i], m.format)}</div>
        </div>
      ))}
    </div>
  );

  if (d1) {
    // Tableau croisé : d0 en lignes, d1 en colonnes, première métrique
    const cols = Array.from(new Set(res.rows.map(r => r.labels[1])));
    const rowsL = Array.from(new Set(res.rows.map(r => r.labels[0])));
    const cellOf = new Map(res.rows.map(r => [`${r.labels[0]}|${r.labels[1]}`, r.values[0]]));
    const max = Math.max(1e-9, ...res.rows.map(r => r.values[0] ?? 0));
    const shade = (v: number | null | undefined) => {
      if (v === null || v === undefined) return "transparent";
      const steps = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf"];
      return steps[Math.min(4, Math.floor((v / max) * 4.999))];
    };
    return (
      <>
        <div style={cardTitle}>{m0.label} — {d0.label} × {d1.label}</div>
        <div style={cardSub}>Intensité proportionnelle à la valeur</div>
        <div style={{ overflowX: "auto", maxHeight: 420 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>{d0.label}</th>{cols.map(c => <th key={c} style={{ ...th, textAlign: "right" }}>{c}</th>)}</tr></thead>
            <tbody>
              {rowsL.map(rl => (
                <tr key={rl}>
                  <td style={{ ...td, fontWeight: 600 }}>{rl}</td>
                  {cols.map(c => {
                    const v = cellOf.get(`${rl}|${c}`);
                    const dark = v !== undefined && v !== null && v / max > 0.6;
                    return <td key={c} style={{ ...td, textAlign: "right", background: shade(v), color: dark ? "#fff" : "#374151" }}>{formatValue(v, m0.format)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (d0.time) {
    const same = res.metrics.map((m, i) => ({ m, i })).filter(x => x.m.format === m0.format);
    const others = res.metrics.filter(m => m.format !== m0.format);
    return (
      <>
        <div style={cardTitle}>{same.map(x => x.m.label).join(" · ")} par {d0.label.toLowerCase()}</div>
        <div style={cardSub}>{others.length ? `Une seule échelle : ${others.map(m => m.label).join(", ")} dans le tableau.` : "Survolez pour le détail"}</div>
        <LineChart labels={res.rows.map(r => r.labels[0])} format={m0.format} max={m0.format === "pct" ? 1 : undefined}
          series={same.map((x, k) => ({ name: x.m.label, values: res.rows.map(r => r.values[x.i]), color: SERIES[k] }))} />
        {same.length > 1 && <div style={{ marginTop: 8 }}><Legend items={same.map((x, k) => ({ label: x.m.label, color: SERIES[k] }))} /></div>}
      </>
    );
  }

  return (
    <>
      <div style={cardTitle}>{m0.label} par {d0.label.toLowerCase()}</div>
      <div style={cardSub}>Classement — {res.rows.length} valeur(s){res.rows.length > 15 ? ", 15 premières affichées" : ""}</div>
      <BarList format={m0.format} rows={res.rows.slice(0, 15).map(r => ({ label: r.labels[0], value: r.values[0] }))} />
    </>
  );
}

function ResultTable({ r, onSort }: { r: QueryResult; onSort?: (by: string) => void }) {
  if (!r.rows.length) return <Empty />;
  const arrow = (id: string) => (r.query.sort?.by === id ? (r.query.sort.dir === "desc" ? " ↓" : " ↑") : "");
  return (
    <div style={{ overflowX: "auto", maxHeight: 460, border: "1px solid #F1F5F9", borderRadius: 10 }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            {r.dimensions.map(d => <th key={d.id} style={{ ...th, cursor: onSort ? "pointer" : undefined }} onClick={() => onSort?.(d.id)}>{d.label}{arrow(d.id)}</th>)}
            {r.metrics.map(m => <th key={m.id} title={m.description} style={{ ...th, textAlign: "right", cursor: onSort ? "pointer" : undefined }} onClick={() => onSort?.(m.id)}>{m.label}{arrow(m.id)}</th>)}
          </tr>
        </thead>
        <tbody>
          {r.rows.map(row => (
            <tr key={row.keys.join("|")}>
              {row.labels.map((l, i) => <td key={i} style={{ ...td, fontWeight: 600 }}>{l}</td>)}
              {row.values.map((v, i) => <td key={i} style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatValue(v, r.metrics[i].format)}</td>)}
            </tr>
          ))}
          {r.dimensions.length > 0 && (
            <tr>
              <td colSpan={r.dimensions.length} style={{ ...td, fontWeight: 800, background: "#F8FAFC" }}>Total</td>
              {r.totals.map((v, i) => <td key={i} style={{ ...td, textAlign: "right", fontWeight: 800, background: "#F8FAFC", fontVariantNumeric: "tabular-nums" }}>{formatValue(v, r.metrics[i].format)}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ═══ Agent HERMES ═══════════════════════════════════════════════ */

function AgentTab({ insights, onExplore, now }: { insights: Insight[]; onExplore: (q: Query) => void; now: Date }) {
  const [question, setQuestion] = useState("");
  const [err, setErr] = useState("");
  const ask = () => {
    const a = askHermes(question, now);
    if (a) onExplore(a.query); else setErr("Métrique non reconnue — ex. « encaissements par canal sur 6 mois ».");
  };
  return (
    <>
      <div style={{ ...card, marginBottom: 14, background: "linear-gradient(135deg,#0F172A,#1E293B)", border: "none" }}>
        <div style={{ color: "#F8FAFC", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Agent HERMES</div>
        <div style={{ color: "#94A3B8", fontSize: 12, marginBottom: 12 }}>
          Constats calculés sur l'entrepôt avec les mêmes métriques que les tableaux de bord. Posez une question pour ouvrir l'analyse correspondante.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={question} onChange={e => { setQuestion(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && ask()}
            placeholder="ex. ponctualité par locataire sur 12 mois" style={{ ...select, flex: "1 1 240px", padding: "9px 12px" }} />
          <button style={btn} onClick={ask}>Analyser</button>
        </div>
        {err && <div style={{ color: "#FCA5A5", fontSize: 12, marginTop: 8 }}>{err}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((i, k) => {
          const L = LEVEL[i.level];
          return (
            <div key={k} style={{ ...card, background: L.bg, borderColor: "transparent", borderLeft: `4px solid ${L.color}`, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <span aria-label={L.label} style={{ width: 22, height: 22, borderRadius: 11, background: L.color, color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{L.icon}</span>
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: L.color, textTransform: "uppercase", letterSpacing: ".04em" }}>{L.label}</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: INK.primary }}>{i.title}</div>
                <div style={{ fontSize: 12, color: INK.secondary, marginTop: 2 }}>{i.detail}</div>
              </div>
              {i.query && <button style={{ ...ghost, background: "#fff" }} onClick={() => onExplore(i.query!)}>Explorer →</button>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ═══ Entrepôt ═══════════════════════════════════════════════════ */

function WarehouseTab({ wh }: { wh: Warehouse }) {
  const [sel, setSel] = useState<TableName>("fact_rent");
  const rows = wh[sel] as object[];
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const facts = TABLES.filter(t => t.kind === "fact");
  const dims = TABLES.filter(t => t.kind === "dimension");

  const TableCard = ({ t }: { t: (typeof TABLES)[number] }) => (
    <button onClick={() => setSel(t.name)} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit", borderRadius: 10, padding: "10px 12px",
      border: `1.5px solid ${sel === t.name ? "#1877F2" : "#E5E7EB"}`, background: sel === t.name ? "#EFF6FF" : t.kind === "fact" ? "#fff" : "#F8FAFC" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <code style={{ fontSize: 12, fontWeight: 700, color: INK.primary }}>{t.name}</code>
        <span style={{ fontSize: 11, color: INK.secondary, fontWeight: 700 }}>{wh[t.name].length} l.</span>
      </div>
      <div style={{ fontSize: 10, color: INK.muted, marginTop: 2 }}>grain : {t.grain}</div>
    </button>
  );

  return (
    <>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={cardTitle}>Modèle en étoile</div>
        <div style={cardSub}>Faits au centre, dimensions partagées autour — cliquez une table pour l'inspecter</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: INK.muted, letterSpacing: ".06em" }}>FAITS</div>
            {facts.map(t => <TableCard key={t.name} t={t} />)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: INK.muted, letterSpacing: ".06em" }}>DIMENSIONS</div>
            {dims.map(t => <TableCard key={t.name} t={t} />)}
          </div>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <code style={{ fontSize: 14, fontWeight: 800, color: INK.primary }}>hermes.{sel}</code>
            <div style={{ fontSize: 12, color: INK.secondary, marginTop: 2 }}>{TABLES.find(t => t.name === sel)!.description}</div>
            <div style={{ fontSize: 11, color: INK.muted, marginTop: 4 }}>Lignage : {LINEAGE[sel].join(" · ")}</div>
          </div>
          <button style={btn} onClick={() => downloadCsv(`hermes_${sel}.csv`, tableToCsv(rows))}>Exporter CSV</button>
        </div>
        <div style={{ fontSize: 11, color: INK.muted, marginBottom: 6 }}>{rows.length} ligne(s) · {cols.length} colonne(s){rows.length > 50 ? " · 50 premières affichées" : ""}</div>
        {rows.length ? (
          <div style={{ overflow: "auto", maxHeight: 420, border: "1px solid #F1F5F9", borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>{cols.map(c => <th key={c} style={th}><code>{c}</code></th>)}</tr></thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i}>{cols.map(c => {
                    const v = (r as Record<string, unknown>)[c];
                    return <td key={c} style={{ ...td, fontFamily: "ui-monospace, monospace", fontSize: 11, color: v === null ? INK.muted : "#374151" }}>{v === null ? "NULL" : String(v)}</td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text="Table vide." />}
        <div style={{ fontSize: 11, color: INK.muted, marginTop: 10 }}>
          Déploiement SQL (Postgres / Supabase) : <code>sql/hermes/001_warehouse_schema.sql</code> → <code>002_refresh_warehouse.sql</code> → <code>003_marts.sql</code>
        </div>
      </div>
    </>
  );
}

/* ═══ Pipeline ═══════════════════════════════════════════════════ */

function PipelineTab({ run, history, onRun }: { run: PipelineRun; history: PipelineRun[]; onRun: () => void }) {
  const failed = run.quality.filter(q => q.failed > 0).length;
  return (
    <>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <div style={cardTitle}>Exécution <code>{run.id}</code></div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>
              {new Date(run.startedAt).toLocaleString("fr-FR")} · {run.quality.length - failed}/{run.quality.length} contrôles OK · {run.quarantined} ligne(s) en quarantaine
            </div>
          </div>
          <button style={btn} onClick={onRun}>↻ Relancer le pipeline</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))", gap: 10 }}>
          {run.steps.map((s, i) => (
            <div key={s.step} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, position: "relative" }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: INK.muted, letterSpacing: ".06em" }}>ÉTAPE {i + 1} · {s.step.toUpperCase()}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: INK.primary, margin: "4px 0" }}>{s.label}</div>
              <div style={{ fontSize: 11, color: INK.secondary }}>{s.rowsIn} → <b>{s.rowsOut}</b> lignes · {s.ms.toFixed(1).replace(".", ",")} ms</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 14 }}>
        <div style={cardTitle}>Contrôles qualité</div>
        <div style={cardSub}>Règles « bloquantes » : lignes mises en quarantaine · « avertissement » : signalées seulement</div>
        <div style={{ overflowX: "auto", border: "1px solid #F1F5F9", borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>{["", "Table", "Règle", "Sévérité", "Vérifiées", "Échecs", "Exemples"].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {run.quality.map(q => {
                const ok = q.failed === 0;
                const c = ok ? STATUS.good : q.severity === "error" ? STATUS.critical : "#B45309";
                return (
                  <tr key={q.id}>
                    <td style={td}><span aria-label={ok ? "OK" : "Échec"} style={{ color: c, fontWeight: 800 }}>{ok ? "✓" : q.severity === "error" ? "✕" : "!"}</span></td>
                    <td style={td}><code>{q.table}</code></td>
                    <td style={td}>{q.rule}</td>
                    <td style={td}>{q.severity === "error" ? "Bloquante" : "Avertissement"}</td>
                    <td style={{ ...td, textAlign: "right" }}>{q.checked}</td>
                    <td style={{ ...td, textAlign: "right", color: ok ? INK.secondary : c, fontWeight: ok ? 400 : 800 }}>{q.failed}</td>
                    <td style={{ ...td, color: INK.muted }}>{q.samples.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={card}>
        <div style={cardTitle}>Historique des exécutions (session)</div>
        <div style={cardSub}>Le pipeline se relance automatiquement à chaque modification des données RentFlow</div>
        {[run, ...history].map((h, i) => (
          <div key={h.id + i} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12, padding: "7px 0", borderTop: i ? "1px solid #F1F5F9" : "none", flexWrap: "wrap" }}>
            <code style={{ color: INK.primary, fontWeight: 700 }}>{h.id}</code>
            <span style={{ color: INK.secondary }}>{new Date(h.startedAt).toLocaleTimeString("fr-FR")}</span>
            <span style={{ color: h.status === "success" ? "#15803D" : h.status === "warning" ? "#B45309" : STATUS.critical, fontWeight: 700 }}>
              {h.status === "success" ? "✓ succès" : h.status === "warning" ? "! avertissements" : "✕ quarantaine"}
            </span>
            <span style={{ color: INK.muted }}>{h.warehouse.fact_rent.length} échéances · {h.steps.reduce((a, s) => a + s.ms, 0).toFixed(1).replace(".", ",")} ms</span>
            {i === 0 && <span style={{ fontSize: 10, background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>courante</span>}
          </div>
        ))}
      </div>
    </>
  );
}
