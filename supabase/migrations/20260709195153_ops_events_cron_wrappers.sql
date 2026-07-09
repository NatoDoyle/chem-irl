-- ops_events + logged pg_cron wrappers: cron-job outcomes -> Bronto.
--
-- Until now the three scheduled jobs (match expiry sweep, daily score
-- materialization, stale-match detection) ran blind — no durable record of
-- when they ran, what they did, or how they failed. This migration:
--
--   1. Adds public.ops_events, an append-only operational event log
--      (service-role only) drained to Bronto by telemetry-ship
--      (layer 'db'; see 20260709194434_telemetry_ship_pipeline.sql).
--   2. Adds versioned wrapper functions run_*_v1() that call the existing
--      functions UNCHANGED (repo rule: never alter an applied function's
--      shape in place) and record an ok/error ops_events row with counts.
--      On failure the wrapper records the error and returns normally: a
--      re-raise from inside the EXCEPTION handler would abort the outer
--      transaction and roll the just-inserted error row back with it, so
--      failure visibility lives in ops_events/Bronto rather than
--      cron.job_run_details.
--   3. Re-points the cron jobs at the wrappers. NOTE: BOTH historical
--      expire-job names may exist in a given project —
--      'expire_matches_hourly' (20260322230000, scheduled unguarded) and
--      'expire-matches-hourly' (20260326000001) — so both are unscheduled
--      if present before the canonical job is created.
--   4. Seeds the telemetry-ship cursor for ops_events (guarded: the cursor
--      table arrives in 20260709194434, which sorts before this file).

-- --- 1. ops_events (service-role only) ---------------------------------------

CREATE TABLE IF NOT EXISTS public.ops_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event TEXT NOT NULL,      -- 'expire_matches' | 'materialize_scores' | 'stale_match_events'
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No policies on purpose: written by SECURITY DEFINER wrappers, read by the
-- service-role telemetry-ship drain.
ALTER TABLE public.ops_events ENABLE ROW LEVEL SECURITY;

-- Keyset-drain support for telemetry-ship.
CREATE INDEX IF NOT EXISTS idx_ops_events_created_id
  ON public.ops_events (created_at, id);

-- --- 2. Logged wrappers -------------------------------------------------------

-- expire_matches() RETURNS void (20260326000001), so the affected count is
-- measured with the same predicate immediately before the sweep.
CREATE OR REPLACE FUNCTION public.run_expire_matches_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM matches WHERE status = 'open' AND expires_at < NOW();
  PERFORM expire_matches();
  INSERT INTO ops_events (event, status, payload)
  VALUES ('expire_matches', 'ok', jsonb_build_object('expired_count', v_count));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO ops_events (event, status, payload)
  VALUES ('expire_matches', 'error', jsonb_build_object('error', SQLERRM));
END;
$$;

-- materialize_scores() RETURNS TABLE(success BOOLEAN, message TEXT) and
-- already traps its own errors into that shape.
CREATE OR REPLACE FUNCTION public.run_materialize_scores_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row FROM materialize_scores();
  INSERT INTO ops_events (event, status, payload)
  VALUES (
    'materialize_scores',
    CASE WHEN v_row.success THEN 'ok' ELSE 'error' END,
    jsonb_build_object('message', v_row.message)
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO ops_events (event, status, payload)
  VALUES ('materialize_scores', 'error', jsonb_build_object('error', SQLERRM));
END;
$$;

-- emit_stale_match_events() RETURNS INTEGER (events emitted).
CREATE OR REPLACE FUNCTION public.run_stale_match_events_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  v_count := emit_stale_match_events();
  INSERT INTO ops_events (event, status, payload)
  VALUES ('stale_match_events', 'ok', jsonb_build_object('stale_count', v_count));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO ops_events (event, status, payload)
  VALUES ('stale_match_events', 'error', jsonb_build_object('error', SQLERRM));
END;
$$;

-- Cron-only entry points — not client-callable (20260609183221 convention).
REVOKE EXECUTE ON FUNCTION public.run_expire_matches_v1() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_materialize_scores_v1() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_stale_match_events_v1() FROM PUBLIC, anon, authenticated;

-- --- 3. Re-point cron at the wrappers (same cadences) -------------------------

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_matches_hourly') THEN
      PERFORM cron.unschedule('expire_matches_hourly');
    END IF;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-matches-hourly') THEN
      PERFORM cron.unschedule('expire-matches-hourly');
    END IF;
    PERFORM cron.schedule('expire_matches_hourly', '0 * * * *', 'SELECT run_expire_matches_v1();');

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'materialize_scores_daily') THEN
      PERFORM cron.unschedule('materialize_scores_daily');
    END IF;
    PERFORM cron.schedule('materialize_scores_daily', '0 0 * * *', 'SELECT run_materialize_scores_v1();');

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'stale_matches_daily') THEN
      PERFORM cron.unschedule('stale_matches_daily');
    END IF;
    PERFORM cron.schedule('stale_matches_daily', '5 0 * * *', 'SELECT run_stale_match_events_v1();');
  END IF;
END;
$do$;

-- --- 4. Activate the telemetry-ship drain for ops_events ----------------------
-- Guarded so this migration is order-independent of 20260709194434 (which
-- creates the cursor table); if the guard skips, re-running the INSERT after
-- that migration is applied activates the source (documented in the runbook).

DO $do$
BEGIN
  IF to_regclass('public.telemetry_ship_cursors') IS NOT NULL THEN
    INSERT INTO public.telemetry_ship_cursors (source, last_id)
    VALUES ('ops_events', '0')
    ON CONFLICT (source) DO NOTHING;
  END IF;
END;
$do$;

SELECT pg_notify('pgrst', 'reload schema');
