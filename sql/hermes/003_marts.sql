-- ════════════════════════════════════════════════════════════════
-- HERMES — Marts BI : vues dénormalisées consommées par
-- src/hermes/bi/sql.ts, Metabase, Superset, Power BI ou Looker Studio.
-- Les libellés sont identiques à la couche sémantique en mémoire.
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW hermes.mart_rent AS
SELECT
  d.year_month, d.year || '-T' || d.quarter AS year_quarter, d.year,
  p.city, p.district, p.property_type,
  p.property_id || ' · ' || p.address AS property_label,
  l.tenant_name,
  CASE l.status WHEN 'closed' THEN 'Clôturé' ELSE 'Actif' END AS lease_status,
  c.channel_name, c.channel_family,
  CASE
    WHEN NOT f.is_paid AND f.is_overdue THEN 'Impayé échu'
    WHEN NOT f.is_paid THEN 'À venir'
    WHEN f.paid_on_time THEN 'Payé à temps'
    ELSE 'Payé en retard'
  END AS payment_status,
  f.*
FROM hermes.fact_rent f
JOIN hermes.dim_date d     USING (date_key)
JOIN hermes.dim_property p USING (property_key)
JOIN hermes.dim_lease l    USING (lease_key)
JOIN hermes.dim_channel c  USING (channel_key);

CREATE OR REPLACE VIEW hermes.mart_occupancy AS
SELECT
  d.year_month, d.year || '-T' || d.quarter AS year_quarter, d.year,
  p.city, p.district, p.property_type,
  p.property_id || ' · ' || p.address AS property_label,
  COALESCE(l.tenant_name, '(vacant)') AS tenant_name,
  f.*
FROM hermes.fact_occupancy f
JOIN hermes.dim_date d     USING (date_key)
JOIN hermes.dim_property p USING (property_key)
LEFT JOIN hermes.dim_lease l USING (lease_key);

CREATE OR REPLACE VIEW hermes.mart_deposit AS
SELECT
  d.year_month, d.year || '-T' || d.quarter AS year_quarter, d.year,
  p.city, p.district, p.property_type,
  p.property_id || ' · ' || p.address AS property_label,
  l.tenant_name,
  CASE l.status WHEN 'closed' THEN 'Clôturé' ELSE 'Actif' END AS lease_status,
  f.*
FROM hermes.fact_deposit f
JOIN hermes.dim_date d     USING (date_key)
JOIN hermes.dim_property p USING (property_key)
JOIN hermes.dim_lease l    USING (lease_key);

-- KPI mensuels prêts à brancher sur un outil de dashboarding
CREATE OR REPLACE VIEW hermes.kpi_monthly AS
SELECT
  r.year_month,
  SUM(r.amount_due)                                                  AS loyers_attendus,
  SUM(r.amount_paid)                                                 AS loyers_encaisses,
  SUM(r.amount_paid)::numeric
    / NULLIF(SUM(r.amount_due) FILTER (WHERE r.is_paid OR r.is_overdue), 0) AS taux_recouvrement,
  SUM(r.amount_outstanding) FILTER (WHERE r.is_overdue)              AS impayes_echus,
  COUNT(*) FILTER (WHERE r.paid_on_time)::numeric
    / NULLIF(COUNT(*) FILTER (WHERE r.is_paid), 0)                   AS ponctualite,
  (SELECT AVG(o.is_occupied::int) FROM hermes.mart_occupancy o
    WHERE o.year_month = r.year_month)                               AS taux_occupation
FROM hermes.mart_rent r
GROUP BY r.year_month
ORDER BY r.year_month;
