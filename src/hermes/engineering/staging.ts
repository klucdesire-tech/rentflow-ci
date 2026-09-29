import { Contract, House } from "@/types";

/**
 * HERMES — Data Engineering : couche staging.
 * Extrait les données opérationnelles de RentFlow et les normalise
 * (dates ISO, montants numériques, clés explicites) sans règle métier.
 */

export interface StgProperty {
  property_id: string;
  address: string;
  city: string;
  property_type: string;
  rooms: number;
  list_rent: number;
  is_available: boolean;
}

export interface StgLease {
  lease_id: string;
  property_id: string;
  tenant_name: string;
  start_date: string | null;  // ISO
  end_date: string | null;    // ISO
  status: "active" | "closed";
  caution_amount: number;
  caution_paid: boolean;
  advance_amount: number;
  advance_months: number;
}

export interface StgPayment {
  lease_id: string;
  period: string;             // "AAAA-MM"
  due_date: string | null;    // ISO
  paid_date: string | null;   // ISO
  status: "paid" | "unpaid";
  method: string | null;
  amount: number;
}

export interface Staging {
  stg_properties: StgProperty[];
  stg_leases: StgLease[];
  stg_payments: StgPayment[];
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m1: number, d: number) => `${y}-${pad2(m1)}-${pad2(d)}`;

/** Accepte "AAAA-MM-JJ" et "JJ/MM/AAAA" (format fr-FR utilisé par l'app). */
export function parseDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return valid(+m[3], +m[2], +m[1]);
  return null;
}

function valid(y: number, m1: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, m1 - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m1 - 1 || dt.getUTCDate() !== d) return null;
  return isoDate(y, m1, d);
}

/** Clé de paiement de l'app "AAAA-M" (mois 0-indexé) → "AAAA-MM". */
export function periodFromKey(key: string): string | null {
  const m = /^(\d{4})-(\d{1,2})$/.exec(key);
  if (!m || +m[2] > 11) return null;
  return `${m[1]}-${pad2(+m[2] + 1)}`;
}

/** Échéance RentFlow : le 5 du mois suivant la période. */
export function dueDateOf(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return m === 12 ? isoDate(y + 1, 1, 5) : isoDate(y, m + 1, 5);
}

export function extract(houses: House[], contracts: Contract[]): Staging {
  const stg_properties: StgProperty[] = houses.map(h => ({
    property_id: h.id,
    address: (h.address ?? "").trim(),
    city: (h.city ?? "").trim(),
    property_type: (h.type ?? "").trim(),
    rooms: Number(h.rooms) || 0,
    list_rent: Number(h.rent) || 0,
    is_available: !!h.available,
  }));

  const stg_leases: StgLease[] = contracts.map(c => ({
    lease_id: c.id,
    property_id: c.houseId,
    tenant_name: (c.tenantName ?? "").trim(),
    start_date: parseDate(c.startDate),
    end_date: parseDate(c.endDate),
    status: c.status,
    caution_amount: Number(c.caution?.amount) || 0,
    caution_paid: !!c.caution?.paid,
    advance_amount: Number(c.advance?.amount) || 0,
    advance_months: Number(c.advance?.months) || 0,
  }));

  const stg_payments: StgPayment[] = contracts.flatMap(c =>
    Object.entries(c.payments ?? {}).map(([key, p]) => {
      const period = periodFromKey(key) ?? key;
      return {
        lease_id: c.id,
        period,
        due_date: periodFromKey(key) ? dueDateOf(period) : null,
        paid_date: p.status === "paid" ? parseDate(p.date) : null,
        status: p.status,
        method: p.status === "paid" ? (p.method ?? null) : null,
        amount: Number(p.amount) || 0,
      };
    })
  );

  return { stg_properties, stg_leases, stg_payments };
}
