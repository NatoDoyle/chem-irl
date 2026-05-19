-- Idempotent email confirmation + real link expiry.
--
-- Bug (reported from a real waitlist signup): confirm_waitlist_email_v2 is
-- strictly single-use and NULLs email_confirmation_token on the first GET.
-- Email security scanners (Outlook/Microsoft 365 Safe Links, Gmail,
-- Mimecast, …) prefetch links with GET before the human clicks, burning
-- the one-time token; the human's click then fails with
-- 'invalid_or_used_token'. The "expired" wording shown to users was also
-- misleading — there was never a time-based expiry.
--
-- Fix:
--   1. Add waitlist_signups.confirmation_expires_at (a real 7-day window).
--   2. confirm_waitlist_email_v3: idempotent. Looks up by token ALONE (not
--      filtered on email_confirmed_at) and does NOT null the token on
--      confirm, so a repeat hit with the same token — scanner prefetch
--      then human click — resolves to success (already_confirmed=true)
--      instead of an error. An unconfirmed token past its deadline returns
--      'expired_token'. v2/v1 are left untouched per CLAUDE.md (versioned
--      replacement, not an in-place return-shape change); v3 supersedes v2.
--   3. claim_waitlist_signup / claim_blog_subscribe: stamp
--      confirmation_expires_at on insert and on token re-issue. These are
--      re-created from their latest applied definitions (per_list
--      membership migration 20260429130000) with ONLY that addition —
--      signatures and return shapes are unchanged, so CREATE OR REPLACE
--      here is safe (same pattern per_list itself used).
--   4. forget_waitlist_signup: the token now survives confirmation, so
--      restrict erasure to unconfirmed rows — otherwise a confirmed user's
--      still-present token could delete their row. This preserves the
--      original v1 contract ("post-confirmation deletion is out of scope;
--      the token is nulled after confirmation"). Return shape unchanged.
--
-- All functions remain service_role-only.

-- 1. Real expiry column ------------------------------------------------------

ALTER TABLE public.waitlist_signups
  ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;

-- Backfill: only unconfirmed rows need a deadline. Give them 7 days from
-- creation — links older than that are dead in practice anyway. Confirmed
-- rows stay NULL (they never re-enter the expiry check).
UPDATE public.waitlist_signups
SET confirmation_expires_at = created_at + INTERVAL '7 days'
WHERE email_confirmed_at IS NULL
  AND confirmation_expires_at IS NULL;

-- 2. confirm_waitlist_email_v3 — idempotent ---------------------------------

CREATE OR REPLACE FUNCTION confirm_waitlist_email_v3(p_token TEXT)
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

  -- Look up by token ALONE (not filtered on email_confirmed_at) so an
  -- already-confirmed row is still found and resolves idempotently. This
  -- works because v3 no longer nulls the token on confirm.
  SELECT * INTO v_signup FROM waitlist_signups
  WHERE email_confirmation_token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_or_used_token');
  END IF;

  -- Already confirmed → idempotent success. (A scanner prefetch confirmed
  -- the row; the human's later click lands here. Same success shape as a
  -- fresh confirm, plus already_confirmed=true.)
  IF v_signup.email_confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',           TRUE,
      'already_confirmed', TRUE,
      'email',             v_signup.email::text,
      'source',            v_signup.source,
      'position',          v_signup.position,
      'referral_code',     v_signup.referral_code
    );
  END IF;

  -- Unconfirmed but past its deadline → real, honest expiry.
  IF v_signup.confirmation_expires_at IS NOT NULL
     AND v_signup.confirmation_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'expired_token');
  END IF;

  -- Unconfirmed and in-window → confirm. Keep the token (do NOT null it)
  -- so a follow-up hit with the same token resolves via the
  -- already-confirmed branch above.
  UPDATE waitlist_signups
  SET email_confirmed_at = NOW(),
      updated_at         = NOW()
  WHERE id = v_signup.id;

  -- Referral scoring is waitlist-only (mirrors confirm_waitlist_email_v2's
  -- guard; blog subscribers have no referred_by_code path).
  IF v_signup.source = 'waitlist'
     AND v_signup.referred_by_code IS NOT NULL THEN
    PERFORM apply_referral_score_for_signup(v_signup.id);
  END IF;

  RETURN jsonb_build_object(
    'success',           TRUE,
    'already_confirmed', FALSE,
    'email',             v_signup.email::text,
    'source',            v_signup.source,
    'position',          v_signup.position,
    'referral_code',     v_signup.referral_code
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_waitlist_email_v3(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION confirm_waitlist_email_v3(TEXT)
  TO service_role;

-- 3a. claim_waitlist_signup — stamp confirmation_expires_at -----------------
-- Re-created verbatim from migration 20260429130000 (per_list_membership)
-- with the single addition of confirmation_expires_at on INSERT. Signature
-- and return shape unchanged.

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
    ip_hash, user_agent
  ) VALUES (
    p_email, 'waitlist', p_first_name, p_age_band, p_gender,
    COALESCE(p_city, 'dublin'), p_why_signup,
    p_referred_by_code, v_token, NOW() + INTERVAL '7 days',
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

REVOKE ALL ON FUNCTION claim_waitlist_signup(
  CITEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_waitlist_signup(
  CITEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO service_role;

-- 3b. claim_blog_subscribe — stamp confirmation_expires_at ------------------
-- Re-created verbatim from migration 20260429130000 with confirmation_-
-- expires_at added to both the token re-issue UPDATE and the INSERT.
-- Signature and return shape unchanged.

CREATE OR REPLACE FUNCTION claim_blog_subscribe(
  p_email   CITEXT,
  p_ip_hash TEXT
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing waitlist_signups%ROWTYPE;
  v_token    TEXT;
BEGIN
  -- Only consider the blog row for this email. A waitlist row for the
  -- same address is no longer a blocker — the user can be on both lists.
  SELECT * INTO v_existing FROM waitlist_signups
  WHERE email = p_email AND source = 'blog_subscribe';
  IF FOUND THEN
    -- Existing blog row, not yet confirmed: re-issue the token so a user
    -- who lost the first email can recover by re-submitting. Cross-list
    -- and post-confirm cases never reach here.
    IF v_existing.email_confirmed_at IS NULL THEN
      v_token := encode(extensions.gen_random_bytes(24), 'hex');
      UPDATE waitlist_signups
      SET email_confirmation_token = v_token,
          confirmation_expires_at  = NOW() + INTERVAL '7 days',
          consent_marketing        = TRUE,
          updated_at               = NOW()
      WHERE id = v_existing.id;

      RETURN jsonb_build_object(
        'success',                  TRUE,
        'was_new',                  FALSE,
        'email_confirmation_token', v_token
      );
    END IF;

    -- Already confirmed on the blog list. No-op.
    RETURN jsonb_build_object('success', TRUE, 'was_new', FALSE);
  END IF;

  -- No blog row yet (whether or not a waitlist row exists). Insert one.
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO waitlist_signups (
    email, source, ip_hash, consent_marketing,
    email_confirmation_token, confirmation_expires_at
  ) VALUES (
    p_email, 'blog_subscribe', p_ip_hash, TRUE,
    v_token, NOW() + INTERVAL '7 days'
  );

  RETURN jsonb_build_object(
    'success',                  TRUE,
    'was_new',                  TRUE,
    'email_confirmation_token', v_token
  );
END;
$$;

REVOKE ALL ON FUNCTION claim_blog_subscribe(CITEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_blog_subscribe(CITEXT, TEXT)
  TO service_role;

-- 4. forget_waitlist_signup — unconfirmed-only erasure ----------------------
-- v3 keeps the token after confirmation, so a confirmed user's token still
-- exists. Restrict deletion to unconfirmed rows to preserve the original
-- contract ("post-confirmation deletion is out of scope for v1"). Return
-- shape unchanged from migration 20260427000001.

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
    AND email_confirmed_at IS NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION forget_waitlist_signup(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION forget_waitlist_signup(TEXT)
  TO service_role;

-- 5. PostgREST schema cache reload (per CLAUDE.md project safety rules) ------
SELECT pg_notify('pgrst', 'reload schema');
