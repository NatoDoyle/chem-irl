-- ============================================================================
-- Migration: Waitlist UTM capture (WAITLIST_AUDIT.md §4 / P0-3)
-- Created:   2026-06-09
-- Purpose:   Channel attribution for waitlist signups. Adds the five standard
--            utm_* columns to waitlist_signups and a claim_waitlist_signup_v2
--            RPC that records them. Without this, "which channel drove these
--            signups" is unanswerable (campaign params were silently dropped
--            at every layer).
--
-- Versioning: claim_waitlist_signup (11-arg) is left fully intact and the new
--   params land on a _v2 instead. Replacing the original in place with extra
--   parameters would CREATE an overload (both signatures coexist), which makes
--   named-arg PostgREST calls ambiguous — and the repo rule is versioned
--   replacements anyway. Deploy order: apply this migration FIRST, then deploy
--   the waitlist-signup edge function that calls _v2. The already-deployed
--   function keeps using v1 until then, so every intermediate state works.
--
-- Security model: unchanged — SECURITY DEFINER, EXECUTE granted to
--   service_role only (called exclusively from the waitlist-signup edge
--   function). No PII added: utm_* values are campaign labels from the URL.
-- ============================================================================

-- Step 1: Columns -------------------------------------------------------------
-- Nullable; length-capped as defense-in-depth (the edge function also clamps).
ALTER TABLE waitlist_signups
  ADD COLUMN IF NOT EXISTS utm_source   TEXT CHECK (utm_source   IS NULL OR length(utm_source)   <= 120),
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT CHECK (utm_medium   IS NULL OR length(utm_medium)   <= 120),
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT CHECK (utm_campaign IS NULL OR length(utm_campaign) <= 120),
  ADD COLUMN IF NOT EXISTS utm_term     TEXT CHECK (utm_term     IS NULL OR length(utm_term)     <= 120),
  ADD COLUMN IF NOT EXISTS utm_content  TEXT CHECK (utm_content  IS NULL OR length(utm_content)  <= 120);

-- Step 2: claim_waitlist_signup_v2 --------------------------------------------
-- Verbatim from claim_waitlist_signup (migration 20260519161831) plus the five
-- p_utm_* parameters (DEFAULT NULL) written through on INSERT. Return shape
-- identical to v1.

CREATE OR REPLACE FUNCTION claim_waitlist_signup_v2(
  p_email             CITEXT,
  p_first_name        TEXT,
  p_age_band          TEXT,
  p_gender            TEXT,
  p_city              TEXT,
  p_why_signup        TEXT,
  p_referred_by_code  TEXT,
  p_consent_marketing BOOLEAN,
  p_consent_privacy   BOOLEAN,
  p_ip_hash           TEXT,
  p_user_agent        TEXT,
  p_utm_source        TEXT DEFAULT NULL,
  p_utm_medium        TEXT DEFAULT NULL,
  p_utm_campaign      TEXT DEFAULT NULL,
  p_utm_term          TEXT DEFAULT NULL,
  p_utm_content       TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing waitlist_signups%ROWTYPE;
  v_referrer_exists BOOLEAN;
  v_new RECORD;
  v_token TEXT;
BEGIN
  IF p_consent_privacy IS NOT TRUE THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'consent_required');
  END IF;

  -- Scope the existence check to the waitlist row only. A blog row for
  -- this email is no longer a blocker.
  SELECT * INTO v_existing FROM waitlist_signups
  WHERE email = p_email AND source = 'waitlist';
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success',         TRUE,
      'was_new',         FALSE,
      'position',        v_existing.position,
      'referral_code',   v_existing.referral_code,
      'email_confirmed', (v_existing.email_confirmed_at IS NOT NULL)
    );
  END IF;

  -- Validate the referrer code; silently drop if unknown so we don't leak
  -- which codes exist (timing channel still possible — acceptable for v1).
  IF p_referred_by_code IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM waitlist_signups WHERE referral_code = p_referred_by_code
    ) INTO v_referrer_exists;
    IF NOT v_referrer_exists THEN
      p_referred_by_code := NULL;
    END IF;
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO waitlist_signups (
    email, source, first_name, age_band, gender, city, why_signup,
    referred_by_code, email_confirmation_token, confirmation_expires_at,
    consent_marketing, consent_privacy,
    ip_hash, user_agent,
    utm_source, utm_medium, utm_campaign, utm_term, utm_content
  ) VALUES (
    p_email, 'waitlist', p_first_name, p_age_band, p_gender,
    COALESCE(p_city, 'dublin'), p_why_signup,
    p_referred_by_code, v_token, NOW() + INTERVAL '7 days',
    COALESCE(p_consent_marketing, FALSE), TRUE,
    p_ip_hash, p_user_agent,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content
  )
  RETURNING id, position, referral_code INTO v_new;

  RETURN jsonb_build_object(
    'success',                  TRUE,
    'was_new',                  TRUE,
    'id',                       v_new.id,
    'position',                 v_new.position,
    'referral_code',            v_new.referral_code,
    'email_confirmation_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION claim_waitlist_signup_v2(
  CITEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_waitlist_signup_v2(
  CITEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- Step 3: PostgREST schema cache ----------------------------------------------
SELECT pg_notify('pgrst', 'reload schema');
