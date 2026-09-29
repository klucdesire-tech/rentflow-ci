import { Contract, House } from "@/types";
import { extract, Staging } from "./staging";
import { checkQuality, QualityResult } from "./quality";
import { buildWarehouse } from "../warehouse/model";
import { TableName, Warehouse } from "../warehouse/schema";

/**
 * HERMES — orchestrateur ELT :
 *   extract (sources RentFlow) → staging → contrôles qualité → load (étoile)
 */

export interface StepRun {
  step: "extract" | "quality" | "load";
  label: string;
  ms: number;
  rowsIn: number;
  rowsOut: number;
}

export interface PipelineRun {
  id: string;
  startedAt: string;
  status: "success" | "warning" | "quarantine";   // quarantine = lignes bloquées par une règle "error"
  steps: StepRun[];
  quality: QualityResult[];
  quarantined: number;
  warehouse: Warehouse;
}

/** Lignage : quelles sources alimentent chaque table de l'entrepôt. */
export const LINEAGE: Record<TableName, string[]> = {
  dim_date:       ["stg_payments.period", "stg_leases.start_date"],
  dim_property:   ["rf_houses → stg_properties"],
  dim_lease:      ["rf_contracts → stg_leases"],
  dim_channel:    ["référentiel HERMES", "stg_payments.method"],
  fact_rent:      ["rf_contracts.payments → stg_payments", "dim_lease", "dim_property", "dim_channel"],
  fact_occupancy: ["dim_property", "dim_lease"],
  fact_deposit:   ["rf_contracts.caution/advance → stg_leases"],
};

const rowCount = (s: Staging) => s.stg_properties.length + s.stg_leases.length + s.stg_payments.length;
const clock = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function runPipeline(houses: House[], contracts: Contract[], now: Date = new Date()): PipelineRun {
  const steps: StepRun[] = [];
  const sourceRows = houses.length + contracts.length + contracts.reduce((n, c) => n + Object.keys(c.payments ?? {}).length, 0);

  let t = clock();
  const stg = extract(houses, contracts);
  steps.push({ step: "extract", label: "Extraction & normalisation (staging)", ms: clock() - t, rowsIn: sourceRows, rowsOut: rowCount(stg) });

  t = clock();
  const { results, clean } = checkQuality(stg);
  const quarantined = rowCount(stg) - rowCount(clean);
  steps.push({ step: "quality", label: "Contrôles qualité & quarantaine", ms: clock() - t, rowsIn: rowCount(stg), rowsOut: rowCount(clean) });

  t = clock();
  const warehouse = buildWarehouse(clean, now);
  const whRows = (Object.keys(LINEAGE) as TableName[]).reduce((n, k) => n + warehouse[k].length, 0);
  steps.push({ step: "load", label: "Chargement du modèle en étoile", ms: clock() - t, rowsIn: rowCount(clean), rowsOut: whRows });

  const hasError = results.some(r => r.severity === "error" && r.failed > 0);
  const hasWarn = results.some(r => r.failed > 0);
  return {
    id: `run_${now.getTime().toString(36)}`,
    startedAt: now.toISOString(),
    status: hasError ? "quarantine" : hasWarn ? "warning" : "success",
    steps, quality: results, quarantined, warehouse,
  };
}
