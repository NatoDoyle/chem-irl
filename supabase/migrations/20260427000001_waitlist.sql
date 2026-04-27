-- ============================================================================
-- Migration: Waitlist signups, referral attribution, share events
-- Created:   2026-04-27
-- Purpose:   Pre-launch waitlist for the Dublin beta. Captures email + minimal
--           profile, generates per-user referral codes, attributes referrals
--           with gender-weighted scoring, and instruments share events for
--           analytics. See docs/DUBLIN_LAUNCH_PLAN.md §2.1.
--
-- Security model:
--   - All tables have RLS enabled with NO public policies (default deny).
--   - Anon/authenticated callers reach data only through SECURITY DEFINER RPCs
--     that return aggregate or scalar shapes, never PII.
--   - Service-role-only RPCs (claim_waitlist_signup, confirm_waitlist_email,
--     forget_waitlist_signup, apply_referral_score_for_signup) are invoked
--     exclusively from the waitlist edge functions running with the service
--     role key.
-- ============================================================================

-- Step 1: Extensions ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Per-city position sequences ----------------------------------------
-- Dublin is the only city for now. Adding another city later means another
-- sequence + an updated CHECK on waitlist_signups.city.
CREATE SEQUENCE IF NOT EXISTS waitlist_dublin_position_seq;

-- Step 3: Tables --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waitlist_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE NOT NULL
    CHECK (length(email) >= 5 AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  first_name TEXT
    CHECK (first_name IS NULL OR length(first_name) BETWEEN 1 AND 80),
  age_band TEXT
    CHECK (age_band IS NULL OR age_band IN
      ('18-21','22-26','27-31','32-36','37-44','45+')),
  gender TEXT
    CHECK (gender IS NULL OR gender IN
      ('female','male','nonbinary','prefer_not_to_say')),
  city TEXT NOT NULL DEFAULT 'dublin'
    CHECK (city IN ('dublin')),
  why_signup TEXT
    CHECK (why_signup IS NULL OR length(why_signup) <= 500),
  referral_code TEXT UNIQUE NOT NULL
    DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  referred_by_code TEXT
    REFERENCES waitlist_signups(referral_code) ON DELETE SET NULL,
  position INT NOT NULL
    DEFAULT nextval('waitlist_dublin_position_seq'),
  gender_weighted_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  email_confirmed_at TIMESTAMPTZ,
  email_confirmation_token TEXT UNIQUE,
  consent_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  consent_privacy BOOLEAN NOT NULL DEFAULT FALSE,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS waitlist_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL
    REFERENCES waitlist_signups(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL
    REFERENCES waitlist_signups(id) ON DELETE CASCADE,
  referrer_gender TEXT,
  referred_gender TEXT,
  score_awarded NUMERIC(8,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_id, referred_id)
);

CREATE TABLE IF NOT EXISTS waitlist_share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signup_id UUID NOT NULL
    REFERENCES waitlist_signups(id) ON DELETE CASCADE,
  channel TEXT NOT NULL
    CHECK (channel IN ('whatsapp','x','imessage','copy','email','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 4: Indexes -------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_referred_by
  ON waitlist_signups(referred_by_code)
  WHERE referred_by_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_city_gender
  ON waitlist_signups(city, gender);

-- Drives the beta-invite ordering (top scorers, ties broken by signup time).
CREATE INDEX IF NOT EXISTS idx_waitlist_signups_invite_order
  ON waitlist_signups(gender_weighted_score DESC, created_at ASC)
  WHERE email_confirmed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_confirmed
  ON waitlist_signups(email_confirmed_at)
  WHERE email_confirmed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_signups_created
  ON waitlist_signups(created_at);

CREATE INDEX IF NOT EXISTS idx_waitlist_referrals_referrer
  ON waitlist_referrals(referrer_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_share_events_signup
  ON waitlist_share_events(signup_id, created_at DESC);

-- Step 5: Row-Level Security (default deny) ----------------------------------
ALTER TABLE waitlist_signups   ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_share_events ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated. Service role bypasses RLS and is the
-- only path for writes/reads via the RPCs below.

-- Step 6: Public read RPCs (anon + authenticated callable) -------------------

-- Live counter for the marketing site landing page.
CREATE OR REPLACE FUNCTION waitlist_count_dublin()
RETURNS INT
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM waitlist_signups
  WHERE city = 'dublin' AND email_confirmed_at IS NOT NULL;
$$;

-- Lookup position + referred_count by referral_code (success page). The code
-- is a shared secret between user and their post-signup link; no PII returned.
CREATE OR REPLACE FUNCTION waitlist_position_for_code(p_code TEXT)
RETURNS jsonb
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'position', s.position,
    'referred_count', (
      SELECT COUNT(*)::INT FROM waitlist_referrals r
      WHERE r.referrer_id = s.id
    ),
    'gender_weighted_score', s.gender_weighted_score,
    'email_confirmed', (s.email_confirmed_at IS NOT NULL)
  )
  FROM waitlist_signups s
  WHERE s.referral_code = p_code
  LIMIT 1;
$$;

-- Logs a share-button click. Public callable; rate-limit lives in the edge
-- function (this RPC is exposed for static-site callers to attribute shares
-- without going through an edge function).
CREATE OR REPLACE FUNCTION log_waitlist_share(p_code TEXT, p_channel TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup_id UUID;
BEGIN
  IF p_channel NOT IN ('whatsapp','x','imessage','copy','email','other') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_channel');
  END IF;

  SELECT id INTO v_signup_id
  FROM waitlist_signups
  WHERE referral_code = p_code;

  IF v_signup_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_code');
  END IF;

  INSERT INTO waitlist_share_events (signup_id, channel)
  VALUES (v_signup_id, p_channel);

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- Step 7: Service-role-only RPCs ---------------------------------------------

-- Idempotent insert. If the email already exists, returns existing row data
-- without leaking the confirmation token. Otherwise creates the row and
-- returns the new token so the edge function can email it.
CREATE OR REPLACE FUNCTION claim_waitlist_signup(
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
  p_user_agent        TEXT
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

  SELECT * INTO v_existing FROM waitlist_signups WHERE email = p_email;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success',         TRUE,
      'was_new',         FALSE,
      'position',        v_existing.position,
      'referral_code',   v_existing.referral_code,
      'email_confirmed', (v_existing.email_confirmed_at IS NOT NULL)
    );
  END IF;

  -- Validate the referrer code; silently drop if unknown to avoid leaking
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
    email, first_name, age_band, gender, city, why_signup,
    referred_by_code, email_confirmation_token,
    consent_marketing, consent_privacy,
    ip_hash, user_agent
  ) VALUES (
    p_email, p_first_name, p_age_band, p_gender,
    COALESCE(p_city, 'dublin'), p_why_signup,
    p_referred_by_code, v_token,
    COALESCE(p_consent_marketing, FALSE), TRUE,
    p_ip_hash, p_user_agent
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

-- Confirms email by token, marks email_confirmed_at, applies referral score
-- if the user was referred. Token is nulled after use (single-use).
CREATE OR REPLACE FUNCTION confirm_waitlist_email(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup waitlist_signups%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_token');
  END IF;

  SELECT * INTO v_signup FROM waitlist_signups
  WHERE email_confirmation_token = p_token
    AND email_confirmed_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_or_used_token');
  END IF;

  UPDATE waitlist_signups
  SET email_confirmed_at       = NOW(),
      email_confirmation_token = NULL,
      updated_at               = NOW()
  WHERE id = v_signup.id;

  IF v_signup.referred_by_code IS NOT NULL THEN
    PERFORM apply_referral_score_for_signup(v_signup.id);
  END IF;

  RETURN jsonb_build_object(
    'success',       TRUE,
    'position',      v_signup.position,
    'referral_code', v_signup.referral_code
  );
END;
$$;

-- Internal helper: applies the gender-weighted score to the referrer when a
-- referee confirms email. Idempotent: skips if (referrer, referred) pair
-- already exists in waitlist_referrals.
--
-- Scoring (per docs/DUBLIN_LAUNCH_PLAN.md §2.2 — "cross-gender or F->F"):
--   - F -> F:                                          2.0
--   - Cross-gender (F<->M, F<->NB, M<->NB):            2.0
--   - Same-gender M->M, NB->NB:                        1.0
--   - Either side NULL or 'prefer_not_to_say':         1.0  (no boost without
--                                                            explicit signal —
--                                                            avoids gaming via
--                                                            gender omission)
--   - Plateau ×0.25 after the referrer's 5th scoring referral.
CREATE OR REPLACE FUNCTION apply_referral_score_for_signup(p_signup_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup   waitlist_signups%ROWTYPE;
  v_referrer waitlist_signups%ROWTYPE;
  v_score    NUMERIC(8,2);
  v_count    INT;
BEGIN
  SELECT * INTO v_signup FROM waitlist_signups WHERE id = p_signup_id;
  IF NOT FOUND OR v_signup.referred_by_code IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_referrer
  FROM waitlist_signups
  WHERE referral_code = v_signup.referred_by_code;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Defense-in-depth against self-referral (practically blocked at insert).
  IF v_referrer.id = v_signup.id THEN
    RETURN;
  END IF;

  -- Idempotency.
  IF EXISTS (
    SELECT 1 FROM waitlist_referrals
    WHERE referrer_id = v_referrer.id AND referred_id = v_signup.id
  ) THEN
    RETURN;
  END IF;

  IF (v_signup.gender = 'female' AND v_referrer.gender = 'female')
     OR (v_signup.gender   IN ('female','male','nonbinary')
         AND v_referrer.gender IN ('female','male','nonbinary')
         AND v_signup.gender <> v_referrer.gender)
  THEN
    v_score := 2.0;
  ELSE
    v_score := 1.0;
  END IF;

  SELECT COUNT(*)::INT INTO v_count
  FROM waitlist_referrals WHERE referrer_id = v_referrer.id;
  IF v_count >= 5 THEN
    v_score := v_score * 0.25;
  END IF;

  INSERT INTO waitlist_referrals (
    referrer_id, referred_id, referrer_gender, referred_gender, score_awarded
  ) VALUES (
    v_referrer.id, v_signup.id, v_referrer.gender, v_signup.gender, v_score
  );

  UPDATE waitlist_signups
  SET gender_weighted_score = gender_weighted_score + v_score,
      updated_at            = NOW()
  WHERE id = v_referrer.id;
END;
$$;

-- GDPR Article 17 right-to-erasure. The user's email_confirmation_token is
-- the proof of identity. Pre-confirmation users have it from the signup
-- response; post-confirmation deletion is out of scope for v1 (the token
-- is nulled after confirmation; a v2 flow can authenticate via re-sent
-- one-time link).
CREATE OR REPLACE FUNCTION forget_waitlist_signup(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_token');
  END IF;

  DELETE FROM waitlist_signups
  WHERE email_confirmation_token = p_token
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'id', v_id);
END;
$$;

-- Step 8: Grants -------------------------------------------------------------

-- Public read aggregates and share-logging.
GRANT EXECUTE ON FUNCTION waitlist_count_dublin()                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION waitlist_position_for_code(TEXT)        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION log_waitlist_share(TEXT, TEXT)          TO anon, authenticated;

-- Service-role-only. REVOKE from PUBLIC (which includes service_role), then
-- GRANT explicitly to service_role so edge functions can call these.
REVOKE ALL ON FUNCTION claim_waitlist_signup(
  CITEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_waitlist_signup(
  CITEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION confirm_waitlist_email(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION confirm_waitlist_email(TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION forget_waitlist_signup(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION forget_waitlist_signup(TEXT)
  TO service_role;

REVOKE ALL ON FUNCTION apply_referral_score_for_signup(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION apply_referral_score_for_signup(UUID)
  TO service_role;

-- Step 9: PostgREST schema cache reload (per CLAUDE.md project safety rules) -
SELECT pg_notify('pgrst', 'reload schema');
