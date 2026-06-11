-- ============================================================================
-- Migration: Waitlist D7 referral nudge (lifecycle email #2)
-- Created:   2026-06-11
-- Purpose:   One-time "you're #N — confirmed friends move you up" email, sent
--            ~7 days after signup to confirmed, marketing-consented signups.
--            Sent by the waitlist-nudge edge function (service-role), which is
--            triggered by the CMO's scheduler on the OpenClaw VPS. Closes the
--            DUBLIN_LAUNCH_PLAN lifecycle-email gap (D7 nudge).
--
-- Consent & idempotency:
--   * Batch filter requires consent_marketing IS TRUE and a confirmed email —
--     transactional-only signups never get this.
--   * d7_nudge_sent_at marks each signup exactly once; mark RPC only flips
--     NULL rows, so retried batches cannot double-send-and-double-mark.
--   * waitlist_marketing_unsubscribe_v1 backs the List-Unsubscribe link
--     (HMAC-verified in the edge function) and simply flips consent off.
--
-- Security model: all three RPCs are SECURITY DEFINER, EXECUTE service_role
-- only (PII leaves the DB only toward the edge function).
-- ============================================================================

-- Step 1: Sent marker -----------------------------------------------------
ALTER TABLE waitlist_signups
  ADD COLUMN IF NOT EXISTS d7_nudge_sent_at TIMESTAMPTZ;

-- Step 2: Batch fetch -------------------------------------------------------
CREATE OR REPLACE FUNCTION get_waitlist_nudge_batch_v1(p_limit INT DEFAULT 50)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',                  s.id,
    'email',               s.email,
    'first_name',          s.first_name,
    'position',            s.position,
    'referral_code',       s.referral_code,
    'confirmed_referrals', (SELECT count(*)::int FROM waitlist_referrals r
                            WHERE r.referrer_id = s.id)
  )), '[]'::jsonb)
  FROM (
    SELECT * FROM waitlist_signups
    WHERE source = 'waitlist'
      AND city = 'dublin'
      AND email_confirmed_at IS NOT NULL
      AND consent_marketing IS TRUE
      AND created_at <= now() - interval '7 days'
      AND d7_nudge_sent_at IS NULL
    ORDER BY created_at
    LIMIT p_limit
  ) s;
$$;

-- Step 3: Mark sent (only NULL rows — retries cannot double-mark) -----------
CREATE OR REPLACE FUNCTION mark_waitlist_nudged_v1(p_ids UUID[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE waitlist_signups
  SET d7_nudge_sent_at = now()
  WHERE id = ANY(p_ids) AND d7_nudge_sent_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Step 4: Marketing unsubscribe (consent withdrawal, not erasure) ------------
CREATE OR REPLACE FUNCTION waitlist_marketing_unsubscribe_v1(p_email CITEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found BOOLEAN;
BEGIN
  UPDATE waitlist_signups
  SET consent_marketing = FALSE
  WHERE email = p_email AND consent_marketing IS TRUE;
  -- ok regardless of prior state, as long as the address exists (idempotent)
  SELECT EXISTS (SELECT 1 FROM waitlist_signups WHERE email = p_email) INTO v_found;
  RETURN v_found;
END;
$$;

-- Step 5: Grants -------------------------------------------------------------
REVOKE ALL ON FUNCTION get_waitlist_nudge_batch_v1(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_waitlist_nudge_batch_v1(INT) TO service_role;

REVOKE ALL ON FUNCTION mark_waitlist_nudged_v1(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION mark_waitlist_nudged_v1(UUID[]) TO service_role;

REVOKE ALL ON FUNCTION waitlist_marketing_unsubscribe_v1(CITEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION waitlist_marketing_unsubscribe_v1(CITEXT) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
