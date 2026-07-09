-- Telemetry ship pipeline: DB -> Bronto (service chem-irl-app).
--
-- The `telemetry-ship` edge function drains event tables to Bronto in
-- batches. This migration provides its plumbing:
--
--   1. pg_net extension (async outbound HTTP from Postgres — used ONLY to
--      invoke the edge function; the Bronto API key never enters the DB).
--   2. telemetry_ship_cursors — per-source keyset cursor (created_at, id)
--      with at-least-once semantics: the function advances a cursor only
--      after a successful ship, via a compare-and-swap on the previous
--      cursor value. Seeded at epoch so the first runs backfill history.
--   3. Keyset indexes on the drained tables.
--   4. A minutely pg_cron job that POSTs to the function. The function URL
--      and the x-webhook-secret are read from Vault BY NAME
--      (telemetry_ship_url / telemetry_ship_secret) — no secret material
--      in this file. Create both Vault rows BEFORE `db push` (see
--      docs/infrastructure/BRONTO_APP_OBSERVABILITY.md); if they are
--      missing, the job errors harmlessly in cron.job_run_details until
--      they exist (strictly fail-open — nothing user-facing depends on it).
--
-- The ops_events source (cron-job outcomes) is added by a follow-up
-- migration; the function skips cursor rows whose table doesn't exist yet.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- --- Cursor table (service-role only) --------------------------------------

CREATE TABLE IF NOT EXISTS public.telemetry_ship_cursors (
  source TEXT PRIMARY KEY,
  last_created_at TIMESTAMPTZ NOT NULL DEFAULT 'epoch'::timestamptz,
  -- Text so one column serves uuid PKs (analytics/scoring) and bigint PKs
  -- (ops_events); PostgREST casts the filter literal to the column type.
  last_id TEXT NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No policies on purpose: only the service-role client (telemetry-ship)
-- may read or advance cursors.
ALTER TABLE public.telemetry_ship_cursors ENABLE ROW LEVEL SECURITY;

INSERT INTO public.telemetry_ship_cursors (source)
VALUES ('analytics_events'), ('scoring_events')
ON CONFLICT (source) DO NOTHING;

-- --- Keyset-drain indexes ---------------------------------------------------
-- analytics_events has (event, created_at DESC) + (user_id) indexes and
-- scoring_events has per-user shapes — neither serves a pure
-- (created_at, id) keyset walk.

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_id
  ON public.analytics_events (created_at, id);
CREATE INDEX IF NOT EXISTS idx_scoring_events_created_id
  ON public.scoring_events (created_at, event_id);

-- --- Minutely cron -> edge function -----------------------------------------

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'telemetry_ship_minutely') THEN
      PERFORM cron.schedule(
        'telemetry_ship_minutely',
        '* * * * *',
        $cmd$
        SELECT net.http_post(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets
                  WHERE name = 'telemetry_ship_url'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-webhook-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets
                                 WHERE name = 'telemetry_ship_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 15000
        );
        $cmd$
      );
    END IF;
  END IF;
END;
$do$;

SELECT pg_notify('pgrst', 'reload schema');
