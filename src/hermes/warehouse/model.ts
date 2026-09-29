import { Staging, isoDate, pad2 } from "../engineering/staging";
import { MONTHS_SHORT } from "@/lib/data";
import {
  DimChannel, DimDate, DimLease, DimProperty,
  FactDeposit, FactOccupancy, FactRent, Warehouse,
} from "./schema";

/** HERMES — transformation staging → modèle en étoile. */

const DISTRICTS: Record<string, string> = {
  "Abidjan": "Abidjan", "Yamoussoukro": "Yamoussoukro",
  "Bouaké": "Vallée du Bandama", "Korhogo": "Savanes", "Man": "Montagnes",
  "Daloa": "Sassandra-Marahoué", "San-Pédro": "Bas-Sassandra",
  "Gagnoa": "Gôh-Djiboua", "Divo": "Gôh-Djiboua", "Abengourou": "Comoé",
};

const CHANNELS: Omit<DimChannel, "channel_key">[] = [
  { channel_name: "Orange Money",   channel_family: "Mobile money" },
  { channel_name: "Wave",           channel_family: "Mobile money" },
  { channel_name: "MTN MoMo",       channel_family: "Mobile money" },
  { channel_name: "Carte bancaire", channel_family: "Carte" },
  { channel_name: "Avance",         channel_family: "Avance" },
  { channel_name: "Non payé",       channel_family: "Aucun" },
];

const DAY = 86_400_000;
const toTime = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const daysBetween = (fromIso: string, toIso: string) => Math.round((toTime(toIso) - toTime(fromIso)) / DAY);

export const dateKeyOf = (iso: string) => +iso.slice(0, 4) * 100 + +iso.slice(5, 7);
const nextKey = (k: number) => (k % 100 === 12 ? (Math.floor(k / 100) + 1) * 100 + 1 : k + 1);

function lastDayIso(key: number) {
  const y = Math.floor(key / 100), m = key % 100;
  return isoDate(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}

export function dimDateRow(key: number): DimDate {
  const year = Math.floor(key / 100), month = key % 100;
  return {
    date_key: key, year, month, quarter: Math.ceil(month / 3),
    year_month: `${year}-${pad2(month)}`,
    month_label: `${MONTHS_SHORT[month - 1]} ${year}`,
    first_day: isoDate(year, month, 1),
  };
}

export function buildWarehouse(stg: Staging, now: Date = new Date()): Warehouse {
  const todayIso = isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const currentKey = dateKeyOf(todayIso);

  // ── dim_property
  const dim_property: DimProperty[] = stg.stg_properties.map((p, i) => ({
    property_key: i + 1,
    property_id: p.property_id,
    address: p.address,
    city: p.city || "Inconnue",
    district: DISTRICTS[p.city] ?? "Autre",
    property_type: p.property_type || "Inconnu",
    rooms: p.rooms,
    list_rent: p.list_rent,
    is_available: p.is_available,
  }));
  const propByKey = new Map(dim_property.map(p => [p.property_id, p]));

  // ── dim_lease
  const dim_lease: DimLease[] = stg.stg_leases.map((l, i) => {
    const start = l.start_date!;
    const end = l.end_date ?? todayIso;
    return {
      lease_key: i + 1,
      lease_id: l.lease_id,
      property_id: l.property_id,
      tenant_name: l.tenant_name || "—",
      start_date: start,
      end_date: l.end_date,
      status: l.status,
      tenure_months: Math.max(0, Math.floor(daysBetween(start, end) / 30.44)),
      caution_paid: l.caution_paid,
      advance_months: l.advance_months,
    };
  });
  const leaseById = new Map(dim_lease.map(l => [l.lease_id, l]));

  // ── dim_channel
  const dim_channel: DimChannel[] = CHANNELS.map((c, i) => ({ ...c, channel_key: i + 1 }));
  const channelKey = (name: string | null) => {
    const found = dim_channel.find(c => c.channel_name === (name ?? "Non payé"));
    if (found) return found.channel_key;
    const added: DimChannel = { channel_key: dim_channel.length + 1, channel_name: name!, channel_family: "Mobile money" };
    dim_channel.push(added);
    return added.channel_key;
  };

  // ── fact_rent
  const fact_rent: FactRent[] = stg.stg_payments.map(p => {
    const lease = leaseById.get(p.lease_id)!;
    const prop = propByKey.get(lease.property_id);
    const due = p.due_date!;
    const isPaid = p.status === "paid";
    const daysLate = isPaid && p.paid_date ? daysBetween(due, p.paid_date) : null;
    const isOverdue = !isPaid && todayIso > due;
    return {
      date_key: dateKeyOf(`${p.period}-01`),
      lease_key: lease.lease_key,
      property_key: prop?.property_key ?? 0,
      channel_key: channelKey(isPaid ? p.method : null),
      amount_due: p.amount,
      amount_paid: isPaid ? p.amount : 0,
      amount_outstanding: isPaid ? 0 : p.amount,
      is_paid: isPaid,
      is_overdue: isOverdue,
      paid_on_time: isPaid && (daysLate ?? 0) <= 0,
      days_late: daysLate,
      days_overdue: isOverdue ? daysBetween(due, todayIso) : null,
    };
  });

  // ── fact_occupancy : chaque bien, de son premier bail (ou du mois courant) au mois courant
  const fact_occupancy: FactOccupancy[] = [];
  for (const prop of dim_property) {
    const leases = dim_lease.filter(l => l.property_id === prop.property_id);
    const firstKey = Math.min(currentKey, ...leases.map(l => dateKeyOf(l.start_date)));
    for (let k = firstKey; k <= currentKey; k = nextKey(k)) {
      const first = dimDateRow(k).first_day, last = lastDayIso(k);
      const lease = leases.find(l => l.start_date <= last && (!l.end_date || l.end_date >= first));
      fact_occupancy.push({
        date_key: k,
        property_key: prop.property_key,
        lease_key: lease?.lease_key ?? null,
        is_occupied: !!lease,
        potential_rent: prop.list_rent,
      });
    }
  }

  // ── fact_deposit
  const fact_deposit: FactDeposit[] = stg.stg_leases.map(l => {
    const lease = leaseById.get(l.lease_id)!;
    return {
      lease_key: lease.lease_key,
      property_key: propByKey.get(l.property_id)?.property_key ?? 0,
      date_key: dateKeyOf(lease.start_date),
      caution_amount: l.caution_amount,
      caution_paid: l.caution_paid,
      advance_amount: l.advance_amount,
      advance_months: l.advance_months,
    };
  });

  // ── dim_date : couvre toutes les clés des faits
  const keys = [...fact_rent, ...fact_occupancy, ...fact_deposit].map(f => f.date_key);
  const minKey = keys.length ? Math.min(...keys) : currentKey;
  const maxKey = Math.max(currentKey, ...keys);
  const dim_date: DimDate[] = [];
  for (let k = minKey; k <= maxKey; k = nextKey(k)) dim_date.push(dimDateRow(k));

  return { dim_date, dim_property, dim_lease, dim_channel, fact_rent, fact_occupancy, fact_deposit, built_at: now.toISOString() };
}
