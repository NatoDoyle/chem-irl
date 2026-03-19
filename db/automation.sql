-- Server-Side Automation Functions and Scheduled Jobs
-- Implements proposal expiry and daily scoring automation using pg_cron

-- ============================================================================
-- FUNCTION 1: Expire Proposals
-- ============================================================================
-- Expires active proposals past their deadline and emits proposal_expired scoring events.
-- Idempotent: Can be run multiple times safely (only updates proposals that need updating)
CREATE OR REPLACE FUNCTION expire_proposals()
RETURNS TABLE(
  expired_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  WITH expiring AS (
    UPDATE proposals
    SET status = 'expired'
    WHERE expires_at < NOW()
      AND status = 'active'
    RETURNING proposal_id, match_id, sender_id
  ),
  emit_events AS (
    INSERT INTO scoring_events (user_id, event_type, payload)
    SELECT sender_id, 'proposal_expired',
      jsonb_build_object('match_id', match_id, 'proposal_id', proposal_id)
    FROM expiring
  )
  SELECT COUNT(*) INTO v_expired_count FROM expiring;

  RETURN QUERY SELECT
    v_expired_count,
    format('Expired %s proposal(s)', v_expired_count)::TEXT;
END;
$$;

-- ============================================================================
-- FUNCTION 2: Run Daily Scoring (DEPRECATED — replaced by materialize_scores)
-- ============================================================================
-- Kept for rollback compatibility. Active cron now calls materialize_scores().
CREATE OR REPLACE FUNCTION run_daily_scoring()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_count INTEGER;
BEGIN
  PERFORM update_daily_action_speed();
  SELECT COUNT(DISTINCT user_id) INTO v_user_count
  FROM scores_daily
  WHERE day = CURRENT_DATE;

  RETURN QUERY SELECT
    TRUE,
    format('Daily scoring completed for %s users', v_user_count)::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      FALSE,
      format('Daily scoring failed: %s', SQLERRM)::TEXT;
END;
$$;

-- ============================================================================
-- FUNCTION 3: Emit Stale Match Events
-- ============================================================================
-- Detects matches >72h old with no proposals and emits match_stale events.
-- Idempotent: won't emit duplicate events for the same match+user.
CREATE OR REPLACE FUNCTION emit_stale_match_events()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER := 0;
  v_partial INTEGER;
BEGIN
  INSERT INTO scoring_events (user_id, event_type, payload)
  SELECT m.user_a, 'match_stale', jsonb_build_object('match_id', m.match_id)
  FROM matches m
  WHERE m.status = 'open'
    AND m.created_at < NOW() - INTERVAL '72 hours'
    AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.match_id = m.match_id)
    AND NOT EXISTS (
      SELECT 1 FROM scoring_events se
      WHERE se.user_id = m.user_a AND se.event_type = 'match_stale'
        AND (se.payload->>'match_id')::UUID = m.match_id
    );
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_count := v_count + v_partial;

  INSERT INTO scoring_events (user_id, event_type, payload)
  SELECT m.user_b, 'match_stale', jsonb_build_object('match_id', m.match_id)
  FROM matches m
  WHERE m.status = 'open'
    AND m.created_at < NOW() - INTERVAL '72 hours'
    AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.match_id = m.match_id)
    AND NOT EXISTS (
      SELECT 1 FROM scoring_events se
      WHERE se.user_id = m.user_b AND se.event_type = 'match_stale'
        AND (se.payload->>'match_id')::UUID = m.match_id
    );
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_count := v_count + v_partial;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- PG_CRON SETUP
-- ============================================================================
-- Note: pg_cron must be enabled in Supabase first
-- Supabase enables pg_cron on their managed instances, but you may need to enable it

-- Enable pg_cron extension (if not already enabled)
-- Note: Supabase may already have this enabled, but this is safe to run
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule: Expire proposals every hour (checks for expired proposals and updates status)
-- Cron expression: '0 * * * *' = At minute 0 of every hour
-- Note: If job already exists, unschedule it first with: SELECT cron.unschedule('expire_proposals_hourly');
SELECT cron.schedule(
  'expire_proposals_hourly',
  '0 * * * *',  -- Every hour at minute 0
  $$SELECT expire_proposals();$$
);

-- Schedule: Daily score materialization at midnight UTC (v2 event-sourced scoring)
-- Cron expression: '0 0 * * *' = At 00:00 UTC every day
SELECT cron.schedule(
  'materialize_scores_daily',
  '0 0 * * *',  -- Daily at midnight UTC
  $$SELECT materialize_scores();$$
);

-- Schedule: Stale match detection at 00:05 UTC daily
SELECT cron.schedule(
  'stale_matches_daily',
  '5 0 * * *',  -- Daily at 00:05 UTC
  $$SELECT emit_stale_match_events();$$
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- View all scheduled cron jobs
-- SELECT * FROM cron.job ORDER BY jobid;

-- View cron job execution history (last 50 runs)
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 50;

-- Check for currently expired proposals that should be expired
-- SELECT proposal_id, expires_at, status, created_at
-- FROM proposals
-- WHERE expires_at < NOW() AND status = 'active';

-- Check how many proposals were expired today
-- SELECT COUNT(*) as expired_today
-- FROM proposals
-- WHERE status = 'expired'
--   AND DATE(updated_at) = CURRENT_DATE;

-- Check daily scoring ran today (should see scores for today)
-- SELECT COUNT(DISTINCT user_id) as users_with_scores_today
-- FROM scores_daily
-- WHERE day = CURRENT_DATE;

-- Check last time daily scoring ran (latest score date)
-- SELECT MAX(day) as latest_score_date, COUNT(DISTINCT user_id) as user_count
-- FROM scores_daily;

