-- ════════════════════════════════════════════════════════════════
-- HERMES — ELT : staging → modèle en étoile
-- Usage : SELECT hermes.refresh_warehouse();   (planifiable via pg_cron)
-- Mêmes règles que src/hermes/warehouse/model.ts
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION hermes.refresh_warehouse(p_today date DEFAULT current_date)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_run bigint;
  v_quality jsonb;
BEGIN
  INSERT INTO hermes.pipeline_runs DEFAULT VALUES RETURNING run_id INTO v_run;

  -- Contrôles qualité (les lignes orphelines sont exclues du chargement)
  SELECT jsonb_build_object(
    'lease_fk_prop', (SELECT count(*) FROM hermes.stg_leases l
                      WHERE NOT EXISTS (SELECT 1 FROM hermes.stg_properties p WHERE p.property_id = l.property_id)),
    'pay_fk_lease',  (SELECT count(*) FROM hermes.stg_payments s
                      WHERE NOT EXISTS (SELECT 1 FROM hermes.stg_leases l WHERE l.lease_id = s.lease_id)),
    'pay_amount_pos',(SELECT count(*) FROM hermes.stg_payments WHERE amount <= 0),
    'lease_end_order',(SELECT count(*) FROM hermes.stg_leases WHERE end_date < start_date)
  ) INTO v_quality;

  TRUNCATE hermes.fact_rent, hermes.fact_occupancy, hermes.fact_deposit,
           hermes.dim_lease, hermes.dim_property, hermes.dim_channel, hermes.dim_date
           RESTART IDENTITY CASCADE;

  -- dim_date : du premier mois observé au mois courant
  INSERT INTO hermes.dim_date
  SELECT to_char(d, 'YYYYMM')::int, extract(year FROM d)::int, extract(month FROM d)::int,
         extract(quarter FROM d)::int, to_char(d, 'YYYY-MM'),
         (ARRAY['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'])[extract(month FROM d)::int]
           || ' ' || extract(year FROM d)::int,
         d::date
  FROM generate_series(
         date_trunc('month', LEAST(
           (SELECT min(start_date) FROM hermes.stg_leases),
           (SELECT min(to_date(period, 'YYYY-MM')) FROM hermes.stg_payments),
           p_today)),
         date_trunc('month', GREATEST(
           (SELECT max(to_date(period, 'YYYY-MM')) FROM hermes.stg_payments),
           p_today)),
         interval '1 month') AS d;

  INSERT INTO hermes.dim_property (property_id, address, city, district, property_type, rooms, list_rent, is_available)
  SELECT property_id, address, COALESCE(NULLIF(city, ''), 'Inconnue'),
         CASE city
           WHEN 'Abidjan' THEN 'Abidjan' WHEN 'Yamoussoukro' THEN 'Yamoussoukro'
           WHEN 'Bouaké' THEN 'Vallée du Bandama' WHEN 'Korhogo' THEN 'Savanes' WHEN 'Man' THEN 'Montagnes'
           WHEN 'Daloa' THEN 'Sassandra-Marahoué' WHEN 'San-Pédro' THEN 'Bas-Sassandra'
           WHEN 'Gagnoa' THEN 'Gôh-Djiboua' WHEN 'Divo' THEN 'Gôh-Djiboua' WHEN 'Abengourou' THEN 'Comoé'
           ELSE 'Autre' END,
         property_type, rooms, list_rent, is_available
  FROM hermes.stg_properties ORDER BY property_id;

  INSERT INTO hermes.dim_lease (lease_id, property_id, tenant_name, start_date, end_date, status, tenure_months, caution_paid, advance_months)
  SELECT l.lease_id, l.property_id, l.tenant_name, l.start_date, l.end_date, l.status,
         GREATEST(0, floor((COALESCE(l.end_date, p_today) - l.start_date) / 30.44))::int,
         l.caution_paid, l.advance_months
  FROM hermes.stg_leases l
  JOIN hermes.stg_properties p USING (property_id)
  ORDER BY l.lease_id;

  INSERT INTO hermes.dim_channel (channel_name, channel_family) VALUES
    ('Orange Money','Mobile money'), ('Wave','Mobile money'), ('MTN MoMo','Mobile money'),
    ('Carte bancaire','Carte'), ('Avance','Avance'), ('Non payé','Aucun');
  INSERT INTO hermes.dim_channel (channel_name, channel_family)
  SELECT DISTINCT method, 'Mobile money' FROM hermes.stg_payments
  WHERE status = 'paid' AND method IS NOT NULL
  ON CONFLICT (channel_name) DO NOTHING;

  INSERT INTO hermes.fact_rent
  SELECT to_char(to_date(s.period, 'YYYY-MM'), 'YYYYMM')::int, l.lease_key, p.property_key, c.channel_key,
         s.amount,
         CASE WHEN s.status = 'paid' THEN s.amount ELSE 0 END,
         CASE WHEN s.status = 'paid' THEN 0 ELSE s.amount END,
         s.status = 'paid',
         s.status = 'unpaid' AND p_today > s.due_date,
         s.status = 'paid' AND COALESCE(s.paid_date - s.due_date, 0) <= 0,
         CASE WHEN s.status = 'paid' THEN s.paid_date - s.due_date END,
         CASE WHEN s.status = 'unpaid' AND p_today > s.due_date THEN p_today - s.due_date END
  FROM hermes.stg_payments s
  JOIN hermes.dim_lease l USING (lease_id)
  JOIN hermes.dim_property p ON p.property_id = l.property_id
  JOIN hermes.dim_channel c ON c.channel_name = CASE WHEN s.status = 'paid' THEN COALESCE(s.method, 'Non payé') ELSE 'Non payé' END;

  -- Occupation : chaque bien, de son premier bail (ou du mois courant) au mois courant
  INSERT INTO hermes.fact_occupancy
  SELECT d.date_key, p.property_key, occ.lease_key, occ.lease_key IS NOT NULL, p.list_rent
  FROM hermes.dim_property p
  JOIN hermes.dim_date d
    ON d.first_day >= date_trunc('month', LEAST(p_today, COALESCE(
         (SELECT min(start_date) FROM hermes.dim_lease x WHERE x.property_id = p.property_id), p_today)))
   AND d.first_day <= date_trunc('month', p_today)
  LEFT JOIN LATERAL (
    SELECT l.lease_key FROM hermes.dim_lease l
    WHERE l.property_id = p.property_id
      AND l.start_date <= (d.first_day + interval '1 month - 1 day')::date
      AND (l.end_date IS NULL OR l.end_date >= d.first_day)
    ORDER BY l.start_date LIMIT 1
  ) occ ON true;

  INSERT INTO hermes.fact_deposit
  SELECT l.lease_key, p.property_key, to_char(l.start_date, 'YYYYMM')::int,
         s.caution_amount, s.caution_paid, s.advance_amount, s.advance_months
  FROM hermes.stg_leases s
  JOIN hermes.dim_lease l USING (lease_id)
  JOIN hermes.dim_property p ON p.property_id = l.property_id;

  UPDATE hermes.pipeline_runs SET
    finished_at = now(),
    status = CASE WHEN (SELECT bool_or((value)::int > 0) FROM jsonb_each_text(v_quality)) THEN 'warning' ELSE 'success' END,
    quality = v_quality,
    rows_loaded = jsonb_build_object(
      'fact_rent', (SELECT count(*) FROM hermes.fact_rent),
      'fact_occupancy', (SELECT count(*) FROM hermes.fact_occupancy),
      'fact_deposit', (SELECT count(*) FROM hermes.fact_deposit))
  WHERE run_id = v_run;

  RETURN v_run;
END;
$$;
