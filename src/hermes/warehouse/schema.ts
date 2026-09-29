/**
 * HERMES — Data Warehouse : modèle en étoile (grain mensuel).
 *
 *            dim_date ─┐
 *        dim_property ─┼─ fact_rent        (bail × mois)
 *           dim_lease ─┤  fact_occupancy   (bien × mois)
 *         dim_channel ─┘  fact_deposit     (bail)
 *
 * Le même modèle est décrit en SQL (Postgres / Supabase) dans sql/hermes/.
 */

export interface DimDate {
  date_key: number;        // AAAAMM, ex. 202501
  year: number;
  month: number;           // 1..12
  quarter: number;         // 1..4
  year_month: string;      // "2025-01"
  month_label: string;     // "Jan 2025"
  first_day: string;       // ISO "2025-01-01"
}

export interface DimProperty {
  property_key: number;
  property_id: string;
  address: string;
  city: string;
  district: string;        // district administratif ivoirien
  property_type: string;
  rooms: number;
  list_rent: number;
  is_available: boolean;
}

export interface DimLease {
  lease_key: number;
  lease_id: string;
  property_id: string;
  tenant_name: string;
  start_date: string;      // ISO
  end_date: string | null; // ISO
  status: "active" | "closed";
  tenure_months: number;
  caution_paid: boolean;
  advance_months: number;
}

export interface DimChannel {
  channel_key: number;
  channel_name: string;    // "Orange Money", "Wave", … , "Avance", "Non payé"
  channel_family: "Mobile money" | "Carte" | "Avance" | "Aucun";
}

export interface FactRent {
  date_key: number;
  lease_key: number;
  property_key: number;
  channel_key: number;
  amount_due: number;
  amount_paid: number;
  amount_outstanding: number;
  is_paid: boolean;
  is_overdue: boolean;
  paid_on_time: boolean;
  days_late: number | null;      // paiement effectué : jours après l'échéance (négatif = en avance)
  days_overdue: number | null;   // impayé échu : jours depuis l'échéance
}

export interface FactOccupancy {
  date_key: number;
  property_key: number;
  lease_key: number | null;
  is_occupied: boolean;
  potential_rent: number;
}

export interface FactDeposit {
  lease_key: number;
  property_key: number;
  date_key: number;              // mois de début du bail
  caution_amount: number;
  caution_paid: boolean;
  advance_amount: number;
  advance_months: number;
}

export interface Warehouse {
  dim_date: DimDate[];
  dim_property: DimProperty[];
  dim_lease: DimLease[];
  dim_channel: DimChannel[];
  fact_rent: FactRent[];
  fact_occupancy: FactOccupancy[];
  fact_deposit: FactDeposit[];
  built_at: string;
}

export type TableName = Exclude<keyof Warehouse, "built_at">;

export const TABLES: { name: TableName; kind: "dimension" | "fact"; grain: string; description: string }[] = [
  { name: "fact_rent",      kind: "fact",      grain: "bail × mois", description: "Échéances de loyer : dû, payé, retard, canal." },
  { name: "fact_occupancy", kind: "fact",      grain: "bien × mois", description: "Occupation mensuelle et loyer potentiel de chaque bien." },
  { name: "fact_deposit",   kind: "fact",      grain: "bail",        description: "Cautions et avances versées à la signature." },
  { name: "dim_date",       kind: "dimension", grain: "mois",        description: "Calendrier mensuel (année, trimestre, mois)." },
  { name: "dim_property",   kind: "dimension", grain: "bien",        description: "Biens : adresse, ville, district, type, loyer catalogue." },
  { name: "dim_lease",      kind: "dimension", grain: "bail",        description: "Baux et locataires : dates, statut, ancienneté." },
  { name: "dim_channel",    kind: "dimension", grain: "canal",       description: "Canaux d'encaissement (mobile money, carte, avance)." },
];
