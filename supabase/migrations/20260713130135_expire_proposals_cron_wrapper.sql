-- Schedule the 72h proposal-expiry sweep (it was never running) + log it.
--
-- expire_proposals() has existed since 20260319000001 as a SECURITY DEFINER
-- sweep (flips overdue 'active' proposals to 'expired' and emits
-- proposal_expired scoring events), and that migration describes it as an
-- already-scheduled hourly cron ("no cron change needed here"). That job only
-- ever existed outside migration management, if at all: pg_cron was first
-- ENABLED on this project on 2026-07-09, and cron.job contains no proposals
-- job (verified against production 2026-07-13). Net effect: the status flip
-- and its scoring events never ran. Read paths were safe regardless —
-- confirm_proposal() re-checks expires_at < NOW() (20260513155725) — so this
-- is a liveness/analytics fix, not a security one. The first run will sweep
-- the accumulated backlog in one pass.
--
-- Follows 20260709195153_ops_events_cron_wrappers.sql: a versioned run_*_v1
-- wrapper records an ok/error ops_events row (drained to Bronto by
-- telemetry-ship, layer 'db'), recording-and-swallowing failures because a
-- re-raise from the EXCEPTION handler would roll the error row back with the
-- outer transaction. Scheduled at :30 to interleave with the match sweep
-- at :00.

-- expire_proposals() RETURNS TABLE(expired_count INTEGER, message TEXT).
CREATE OR REPLACE FUNCTION public.run_expire_proposals_v1()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT * INTO v_row FROM expire_proposals();
  INSERT INTO ops_events (event, status, payload)
  VALUES (
    'expire_proposals',
    'ok',
    jsonb_build_object('expired_count', v_row.expired_count, 'message', v_row.message)
  );
EXCEPTION WHEN OTHERS THEN
  INSERT INTO ops_events (event, status, payload)
  VALUES ('expire_proposals', 'error', jsonb_build_object('error', SQLERRM));
END;
$$;

-- Cron-only entry point — not client-callable (20260609183221 convention).
REVOKE EXECUTE ON FUNCTION public.run_expire_proposals_v1() FROM PUBLIC, anon, authenticated;

-- Guarded scheduling, mirroring the other wrappers.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire_proposals_hourly') THEN
      PERFORM cron.unschedule('expire_proposals_hourly');
    END IF;
    PERFORM cron.schedule('expire_proposals_hourly', '30 * * * *', 'SELECT run_expire_proposals_v1();');
  END IF;
END;
$do$;

SELECT pg_notify('pgrst', 'reload schema');
