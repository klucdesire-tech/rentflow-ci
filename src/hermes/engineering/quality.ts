import { Staging } from "./staging";

/**
 * HERMES — Data Engineering : contrôles qualité (data contracts).
 * "error" bloque le chargement des lignes fautives, "warning" est signalé seulement.
 */

export type Severity = "error" | "warning";

export interface QualityResult {
  id: string;
  table: keyof Staging;
  rule: string;
  severity: Severity;
  checked: number;
  failed: number;
  samples: string[];      // identifiants des lignes en échec (max 5)
}

interface Rule<T> {
  id: string;
  rule: string;
  severity: Severity;
  test: (row: T, ctx: Ctx) => boolean;   // true = ligne valide
  label: (row: T) => string;
}

interface Ctx {
  propertyIds: Set<string>;
  leaseIds: Set<string>;
  dupProperties: Set<string>;
  dupLeases: Set<string>;
  dupPayments: Set<string>;
}

const dups = (keys: string[]) => {
  const seen = new Set<string>(), d = new Set<string>();
  keys.forEach(k => (seen.has(k) ? d.add(k) : seen.add(k)));
  return d;
};

const PROPERTY_RULES: Rule<Staging["stg_properties"][number]>[] = [
  { id: "prop_pk_unique",  rule: "property_id unique",           severity: "error",   test: (r, c) => !c.dupProperties.has(r.property_id), label: r => r.property_id },
  { id: "prop_rent_pos",   rule: "loyer catalogue > 0",           severity: "warning", test: r => r.list_rent > 0,                          label: r => r.property_id },
  { id: "prop_city_nn",    rule: "ville renseignée",              severity: "warning", test: r => r.city.length > 0,                        label: r => r.property_id },
];

const LEASE_RULES: Rule<Staging["stg_leases"][number]>[] = [
  { id: "lease_pk_unique", rule: "lease_id unique",               severity: "error",   test: (r, c) => !c.dupLeases.has(r.lease_id),        label: r => r.lease_id },
  { id: "lease_fk_prop",   rule: "bien référencé existant",       severity: "error",   test: (r, c) => c.propertyIds.has(r.property_id),    label: r => r.lease_id },
  { id: "lease_start_ok",  rule: "date de début valide",          severity: "error",   test: r => r.start_date !== null,                    label: r => r.lease_id },
  { id: "lease_end_order", rule: "fin ≥ début",                   severity: "warning", test: r => !r.end_date || !r.start_date || r.end_date >= r.start_date, label: r => r.lease_id },
  { id: "lease_closed_end",rule: "bail clôturé avec date de fin", severity: "warning", test: r => r.status !== "closed" || r.end_date !== null, label: r => r.lease_id },
  { id: "lease_tenant_nn", rule: "nom du locataire renseigné",    severity: "warning", test: r => r.tenant_name.length > 0,                 label: r => r.lease_id },
];

const PAYMENT_RULES: Rule<Staging["stg_payments"][number]>[] = [
  { id: "pay_fk_lease",    rule: "bail référencé existant",       severity: "error",   test: (r, c) => c.leaseIds.has(r.lease_id),          label: r => `${r.lease_id}/${r.period}` },
  { id: "pay_period_ok",   rule: "période au format AAAA-MM",     severity: "error",   test: r => r.due_date !== null,                      label: r => `${r.lease_id}/${r.period}` },
  { id: "pay_pk_unique",   rule: "une échéance par bail et mois", severity: "error",   test: (r, c) => !c.dupPayments.has(`${r.lease_id}|${r.period}`), label: r => `${r.lease_id}/${r.period}` },
  { id: "pay_amount_pos",  rule: "montant > 0",                   severity: "warning", test: r => r.amount > 0,                             label: r => `${r.lease_id}/${r.period}` },
  { id: "pay_paid_date",   rule: "paiement avec date valide",     severity: "warning", test: r => r.status !== "paid" || r.paid_date !== null, label: r => `${r.lease_id}/${r.period}` },
  { id: "pay_paid_method", rule: "paiement avec canal",           severity: "warning", test: r => r.status !== "paid" || !!r.method,        label: r => `${r.lease_id}/${r.period}` },
];

function run<T>(table: keyof Staging, rows: T[], rules: Rule<T>[], ctx: Ctx): QualityResult[] {
  return rules.map(rule => {
    const bad = rows.filter(r => !rule.test(r, ctx));
    return { id: rule.id, table, rule: rule.rule, severity: rule.severity, checked: rows.length, failed: bad.length, samples: bad.slice(0, 5).map(rule.label) };
  });
}

export function checkQuality(stg: Staging): { results: QualityResult[]; clean: Staging } {
  const ctx: Ctx = {
    propertyIds: new Set(stg.stg_properties.map(p => p.property_id)),
    leaseIds: new Set(stg.stg_leases.map(l => l.lease_id)),
    dupProperties: dups(stg.stg_properties.map(p => p.property_id)),
    dupLeases: dups(stg.stg_leases.map(l => l.lease_id)),
    dupPayments: dups(stg.stg_payments.map(p => `${p.lease_id}|${p.period}`)),
  };

  const results = [
    ...run("stg_properties", stg.stg_properties, PROPERTY_RULES, ctx),
    ...run("stg_leases", stg.stg_leases, LEASE_RULES, ctx),
    ...run("stg_payments", stg.stg_payments, PAYMENT_RULES, ctx),
  ];

  // Quarantaine : seules les règles bloquantes excluent des lignes.
  const keep = <T,>(rows: T[], rules: Rule<T>[]) => rows.filter(r => rules.every(x => x.severity !== "error" || x.test(r, ctx)));
  const stg_properties = keep(stg.stg_properties, PROPERTY_RULES);
  const stg_leases = keep(stg.stg_leases, LEASE_RULES);
  const keptLeases = new Set(stg_leases.map(l => l.lease_id));
  const stg_payments = keep(stg.stg_payments, PAYMENT_RULES).filter(p => keptLeases.has(p.lease_id));

  return { results, clean: { stg_properties, stg_leases, stg_payments } };
}
