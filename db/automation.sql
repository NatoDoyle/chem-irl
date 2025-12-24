-- Server-Side Automation Functions and Scheduled Jobs
-- Implements proposal expiry and daily scoring automation using pg_cron

-- ============================================================================
-- FUNCTION 1: Expire Proposals
-- ============================================================================
-- Safely updates proposals.status to 'expired' for proposals where expires_at < NOW()
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
  -- Update proposals that are expired but not already marked as expired
  -- Only update 'active' proposals to avoid overwriting 'confirmed' status
  WITH updated AS (
    UPDATE proposals
    SET status = 'expired'
    WHERE expires_at < NOW()
      AND status = 'active'  -- Only expire active proposals (confirmed ones should stay confirmed)
    RETURNING proposal_id
  )
  SELECT COUNT(*) INTO v_expired_count FROM updated;

  RETURN QUERY SELECT
    v_expired_count,
    format('Expired %s proposal(s)', v_expired_count)::TEXT;
END;
$$;

-- ============================================================================
-- FUNCTION 2: Run Daily Scoring
-- ============================================================================
-- Wrapper function that calls update_daily_action_speed() and returns status
-- This allows pg_cron to see the result and log it
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
  -- Call the existing update_daily_action_speed function
  PERFORM update_daily_action_speed();

  -- Count how many users have scores for today to verify it ran
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

-- Schedule: Daily scoring at midnight UTC
-- Cron expression: '0 0 * * *' = At 00:00 UTC every day
-- Note: If job already exists, unschedule it first with: SELECT cron.unschedule('daily_scoring_midnight');
SELECT cron.schedule(
  'daily_scoring_midnight',
  '0 0 * * *',  -- Daily at midnight UTC
  $$SELECT run_daily_scoring();$$
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

