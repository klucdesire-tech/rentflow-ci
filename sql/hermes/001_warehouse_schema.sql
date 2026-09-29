-- ════════════════════════════════════════════════════════════════
-- HERMES — Data Warehouse (Postgres ≥ 13 / Supabase)
-- Couches : staging (stg_*) → étoile (dim_*, fact_*) → marts (mart_*)
-- Le même modèle est calculé en mémoire par src/hermes/warehouse/model.ts
-- ════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS hermes;

-- ─── Staging : copie normalisée des sources opérationnelles ─────
CREATE TABLE IF NOT EXISTS hermes.stg_properties (
  property_id    text PRIMARY KEY,
  address        text NOT NULL,
  city           text NOT NULL,
  property_type  text NOT NULL,
  rooms          int  NOT NULL DEFAULT 0,
  list_rent      numeric(14,0) NOT NULL DEFAULT 0,
  is_available   boolean NOT NULL DEFAULT true,
  _loaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hermes.stg_leases (
  lease_id       text PRIMARY KEY,
  property_id    text NOT NULL,
  tenant_name    text NOT NULL,
  start_date     date NOT NULL,
  end_date       date,
  status         text NOT NULL CHECK (status IN ('active','closed')),
  caution_amount numeric(14,0) NOT NULL DEFAULT 0,
  caution_paid   boolean NOT NULL DEFAULT false,
  advance_amount numeric(14,0) NOT NULL DEFAULT 0,
  advance_months int NOT NULL DEFAULT 0,
  _loaded_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hermes.stg_payments (
  lease_id   text NOT NULL,
  period     char(7) NOT NULL,              -- 'AAAA-MM'
  due_date   date NOT NULL,                 -- le 5 du mois suivant
  paid_date  date,
  status     text NOT NULL CHECK (status IN ('paid','unpaid')),
  method     text,
  amount     numeric(14,0) NOT NULL,
  _loaded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lease_id, period)
);

-- ─── Dimensions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hermes.dim_date (
  date_key    int PRIMARY KEY,              -- AAAAMM
  year        int NOT NULL,
  month       int NOT NULL CHECK (month BETWEEN 1 AND 12),
  quarter     int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year_month  char(7) NOT NULL UNIQUE,
  month_label text NOT NULL,
  first_day   date NOT NULL
);

CREATE TABLE IF NOT EXISTS hermes.dim_property (
  property_key  serial PRIMARY KEY,
  property_id   text NOT NULL UNIQUE,
  address       text NOT NULL,
  city          text NOT NULL,
  district      text NOT NULL,
  property_type text NOT NULL,
  rooms         int NOT NULL,
  list_rent     numeric(14,0) NOT NULL,
  is_available  boolean NOT NULL
);

CREATE TABLE IF NOT EXISTS hermes.dim_lease (
  lease_key      serial PRIMARY KEY,
  lease_id       text NOT NULL UNIQUE,
  property_id    text NOT NULL,
  tenant_name    text NOT NULL,
  start_date     date NOT NULL,
  end_date       date,
  status         text NOT NULL,
  tenure_months  int NOT NULL,
  caution_paid   boolean NOT NULL,
  advance_months int NOT NULL
);

CREATE TABLE IF NOT EXISTS hermes.dim_channel (
  channel_key    serial PRIMARY KEY,
  channel_name   text NOT NULL UNIQUE,
  channel_family text NOT NULL
);

-- ─── Faits ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hermes.fact_rent (
  date_key           int NOT NULL REFERENCES hermes.dim_date,
  lease_key          int NOT NULL REFERENCES hermes.dim_lease,
  property_key       int NOT NULL REFERENCES hermes.dim_property,
  channel_key        int NOT NULL REFERENCES hermes.dim_channel,
  amount_due         numeric(14,0) NOT NULL,
  amount_paid        numeric(14,0) NOT NULL,
  amount_outstanding numeric(14,0) NOT NULL,
  is_paid            boolean NOT NULL,
  is_overdue         boolean NOT NULL,
  paid_on_time       boolean NOT NULL,
  days_late          int,
  days_overdue       int,
  PRIMARY KEY (lease_key, date_key)
);

CREATE TABLE IF NOT EXISTS hermes.fact_occupancy (
  date_key       int NOT NULL REFERENCES hermes.dim_date,
  property_key   int NOT NULL REFERENCES hermes.dim_property,
  lease_key      int REFERENCES hermes.dim_lease,
  is_occupied    boolean NOT NULL,
  potential_rent numeric(14,0) NOT NULL,
  PRIMARY KEY (property_key, date_key)
);

CREATE TABLE IF NOT EXISTS hermes.fact_deposit (
  lease_key      int PRIMARY KEY REFERENCES hermes.dim_lease,
  property_key   int NOT NULL REFERENCES hermes.dim_property,
  date_key       int NOT NULL REFERENCES hermes.dim_date,
  caution_amount numeric(14,0) NOT NULL,
  caution_paid   boolean NOT NULL,
  advance_amount numeric(14,0) NOT NULL,
  advance_months int NOT NULL
);

CREATE INDEX IF NOT EXISTS fact_rent_date_idx      ON hermes.fact_rent (date_key);
CREATE INDEX IF NOT EXISTS fact_rent_property_idx  ON hermes.fact_rent (property_key);
CREATE INDEX IF NOT EXISTS fact_occupancy_date_idx ON hermes.fact_occupancy (date_key);

-- ─── Journal des exécutions du pipeline ─────────────────────────
CREATE TABLE IF NOT EXISTS hermes.pipeline_runs (
  run_id       bigserial PRIMARY KEY,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running',
  rows_loaded  jsonb,
  quality      jsonb
);
