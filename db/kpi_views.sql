-- KPI Views for Chem IRL
-- Based on Data Pack v1 metrics definitions

-- Proposal-Confirm within 24h rate (last 7 days)
CREATE OR REPLACE VIEW proposal_confirm_24h
WITH (security_invoker=true) AS
WITH props AS (
  SELECT 
    p.proposal_id, 
    p.created_at, 
    c.created_at AS confirm_at
  FROM proposals p
  LEFT JOIN confirms c USING (proposal_id)
  WHERE p.created_at >= NOW() - INTERVAL '7 days'
),
agg AS (
  SELECT 
    COUNT(*) FILTER (WHERE confirm_at IS NOT NULL AND confirm_at <= created_at + INTERVAL '24 hours') AS confirmed_24h,
    COUNT(*) AS proposals
  FROM props
)
SELECT 
  confirmed_24h::DECIMAL / NULLIF(proposals, 0) AS rate_24h,
  confirmed_24h,
  proposals
FROM agg;

-- Confirm-Show rate (last 30 days)
CREATE OR REPLACE VIEW confirm_show_rate
WITH (security_invoker=true) AS
SELECT 
  COUNT(*) FILTER (WHERE s1.went AND s2.went)::DECIMAL / NULLIF(COUNT(*), 0) AS show_rate,
  COUNT(*) FILTER (WHERE s1.went AND s2.went) AS confirmed_shows,
  COUNT(*) AS total_confirms
FROM (
  SELECT DISTINCT ON (match_id) match_id
  FROM confirms
  WHERE created_at >= NOW() - INTERVAL '30 days'
) conf
JOIN surveys s1 USING (match_id)
JOIN surveys s2 USING (match_id)
WHERE s1.user_id <> s2.user_id;

-- Median Time-to-Date (days)
CREATE OR REPLACE VIEW median_ttd
WITH (security_invoker=true) AS
WITH dates AS (
  SELECT 
    m.match_id,
    DATE_TRUNC('day', LEAST(s1.created_at, s2.created_at)) AS went_day,
    DATE_TRUNC('day', m.created_at) AS match_day
  FROM matches m
  JOIN surveys s1 USING (match_id)
  JOIN surveys s2 USING (match_id)
  WHERE s1.went AND s2.went
    AND s1.created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (went_day - match_day)) AS median_ttd_days,
  COUNT(*) AS total_dates
FROM dates;

-- Payer share & ARPPU (30d)
CREATE OR REPLACE VIEW payer_metrics
WITH (security_invoker=true) AS
WITH payers AS (
  SELECT DISTINCT user_id
  FROM purchases
  WHERE created_at >= NOW() - INTERVAL '30 days' 
    AND refunded = false
),
revenue AS (
  SELECT SUM(amount_eur) AS eur
  FROM purchases
  WHERE created_at >= NOW() - INTERVAL '30 days' 
    AND refunded = false
),
active AS (
  SELECT COUNT(DISTINCT user_id) AS mau
  FROM (
    SELECT user_a AS user_id FROM matches WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION ALL 
    SELECT user_b AS user_id FROM matches WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION ALL 
    SELECT sender_id AS user_id FROM proposals WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION ALL 
    SELECT confirmer_id AS user_id FROM confirms WHERE created_at >= NOW() - INTERVAL '30 days'
    UNION ALL 
    SELECT user_id FROM purchases WHERE created_at >= NOW() - INTERVAL '30 days'
  ) u
)
SELECT 
  (SELECT COUNT(*) FROM payers)::DECIMAL / NULLIF(active.mau, 0) AS payer_share,
  revenue.eur / GREATEST(1, (SELECT COUNT(*) FROM payers)) AS arppu,
  revenue.eur AS total_revenue,
  (SELECT COUNT(*) FROM payers) AS total_payers,
  active.mau
FROM active, revenue;

-- Reopen-Confirm rate (48h)
CREATE OR REPLACE VIEW reopen_confirm_rate
WITH (security_invoker=true) AS
WITH ro AS (
  SELECT 
    proposal_id, 
    match_id, 
    created_at AS reopened_at
  FROM proposals
  WHERE status = 'reopened' 
    AND created_at >= NOW() - INTERVAL '30 days'
),
co AS (
  SELECT proposal_id, created_at AS confirm_at 
  FROM confirms
)
SELECT 
  COUNT(*) FILTER (WHERE co.confirm_at <= ro.reopened_at + INTERVAL '48 hours')::DECIMAL / NULLIF(COUNT(*), 0) AS reopen_confirm_rate,
  COUNT(*) FILTER (WHERE co.confirm_at <= ro.reopened_at + INTERVAL '48 hours') AS confirmed_reopens,
  COUNT(*) AS total_reopens
FROM ro 
LEFT JOIN co USING (proposal_id);

-- Confirmed dates per WAU (north star metric)
CREATE OR REPLACE VIEW confirmed_dates_per_wau
WITH (security_invoker=true) AS
WITH weekly_active AS (
  SELECT COUNT(DISTINCT user_id) AS wau
  FROM (
    SELECT user_a AS user_id FROM matches WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT user_b AS user_id FROM matches WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT sender_id AS user_id FROM proposals WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT confirmer_id AS user_id FROM confirms WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT user_id FROM purchases WHERE created_at >= NOW() - INTERVAL '7 days'
  ) u
),
confirmed_dates AS (
  SELECT COUNT(DISTINCT match_id) AS dates
  FROM surveys s1
  JOIN surveys s2 USING (match_id)
  WHERE s1.went AND s2.went
    AND s1.user_id <> s2.user_id
    AND s1.created_at >= NOW() - INTERVAL '7 days'
)
SELECT 
  confirmed_dates.dates::DECIMAL / NULLIF(weekly_active.wau, 0) AS confirmed_dates_per_wau,
  confirmed_dates.dates,
  weekly_active.wau
FROM confirmed_dates, weekly_active;

-- Report rate per 1k WAU
CREATE OR REPLACE VIEW report_metrics
WITH (security_invoker=true) AS
WITH weekly_active AS (
  SELECT COUNT(DISTINCT user_id) AS wau
  FROM (
    SELECT user_a AS user_id FROM matches WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT user_b AS user_id FROM matches WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT sender_id AS user_id FROM proposals WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT confirmer_id AS user_id FROM confirms WHERE created_at >= NOW() - INTERVAL '7 days'
    UNION ALL 
    SELECT user_id FROM purchases WHERE created_at >= NOW() - INTERVAL '7 days'
  ) u
),
reports_7d AS (
  SELECT COUNT(*) AS total_reports
  FROM reports
  WHERE created_at >= NOW() - INTERVAL '7 days'
)
SELECT 
  (reports_7d.total_reports * 1000.0) / NULLIF(weekly_active.wau, 0) AS report_rate_per_1k_wau,
  reports_7d.total_reports,
  weekly_active.wau
FROM reports_7d, weekly_active;

-- Moderation SLA hit rate
CREATE OR REPLACE VIEW moderation_sla
WITH (security_invoker=true) AS
SELECT 
  COUNT(*) FILTER (WHERE e.created_at <= r.sla_deadline)::DECIMAL / NULLIF(COUNT(*), 0) AS sla_hit_rate,
  COUNT(*) FILTER (WHERE e.created_at <= r.sla_deadline) AS resolved_on_time,
  COUNT(*) AS total_reports,
  AVG(EXTRACT(EPOCH FROM (COALESCE(e.created_at, NOW()) - r.created_at)) / 3600) AS avg_resolution_hours
FROM reports r
LEFT JOIN enforcements e ON r.case_id = e.case_id
WHERE r.created_at >= NOW() - INTERVAL '30 days';

-- Daily KPI summary view
CREATE OR REPLACE VIEW daily_kpi_summary
WITH (security_invoker=true) AS
SELECT 
  CURRENT_DATE AS date,
  (SELECT rate_24h FROM proposal_confirm_24h) AS proposal_confirm_24h_rate,
  (SELECT show_rate FROM confirm_show_rate) AS confirm_show_rate,
  (SELECT median_ttd_days FROM median_ttd) AS median_ttd_days,
  (SELECT payer_share FROM payer_metrics) AS payer_share,
  (SELECT arppu FROM payer_metrics) AS arppu,
  (SELECT confirmed_dates_per_wau FROM confirmed_dates_per_wau) AS confirmed_dates_per_wau,
  (SELECT report_rate_per_1k_wau FROM report_metrics) AS report_rate_per_1k_wau,
  (SELECT sla_hit_rate FROM moderation_sla) AS moderation_sla_hit_rate;

-- Function to refresh daily KPIs (for cron job)
CREATE OR REPLACE FUNCTION refresh_daily_kpis()
RETURNS VOID
LANGUAGE SQL
SET search_path = public
AS $$
  -- This function can be called by pg_cron to refresh materialized views
  -- or update daily summary tables
  SELECT 1; -- Placeholder - implement based on needs
$$;




