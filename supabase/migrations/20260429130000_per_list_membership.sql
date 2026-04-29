-- Per-list membership: same email can be on both blog and waitlist.
--
-- Until now waitlist_signups had a single UNIQUE constraint on email, which
-- meant a user who subscribed to the blog with their address could not
-- separately join the launch waitlist with that same address — claim_*
-- looked up by email alone, found the existing row regardless of source,
-- and returned was_new=false without re-issuing a confirmation token.
-- Real users hit this; testing surfaced it.
--
-- Fix:
--   1. Drop UNIQUE(email) and add UNIQUE(email, source). The two lists are
--      now truly independent. A given email can have at most one row per
--      list. Existing data already satisfies the new constraint (every
--      email today has exactly one row, one source), so no data conflicts.
--   2. Update claim_waitlist_signup and claim_blog_subscribe to scope the
--      "is this email already in the list?" lookup by source. Function
--      signatures and return shapes are unchanged — this is a behavior
--      refinement (cross-list signups now go through the new-row INSERT
--      branch and emit a confirmation token).
--   3. Tighten waitlist_count_dublin() to count waitlist-only confirmed
--      rows. Pre-existing bug: it currently counts confirmed blog rows too.

-- 1. Constraint swap ---------------------------------------------------------

-- Drop the email-only uniqueness, looking up the constraint by column-set so
-- this works regardless of the auto-generated name (defaults to
-- waitlist_signups_email_key for an inline UNIQUE).
DO $$
DECLARE v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.waitlist_signups'::regclass
    AND contype = 'u'
    AND (
      SELECT array_agg(attname::text ORDER BY attname::text)
      FROM pg_attribute
      WHERE attrelid = conrelid AND attnum = ANY(conkey)
    ) = ARRAY['email'];

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.waitlist_signups DROP CONSTRAINT %I',
      v_constraint_name
    );
  END IF;
END $$;

-- Add the new compound uniqueness. Idempotent guard so re-running this
-- migration (which should never happen) doesn't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.waitlist_signups'::regclass
      AND conname = 'waitlist_signups_email_source_key'
  ) THEN
    ALTER TABLE public.waitlist_signups
      ADD CONSTRAINT waitlist_signups_email_source_key UNIQUE (email, source);
  END IF;
END $$;

-- 2. claim_waitlist_signup — scope lookup to source='waitlist' --------------

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
    referred_by_code, email_confirmation_token,
    consent_marketing, consent_privacy,
    ip_hash, user_agent
  ) VALUES (
    p_email, 'waitlist', p_first_name, p_age_band, p_gender,
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

-- 3. claim_blog_subscribe — scope lookup to source='blog_subscribe' ---------

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
    email, source, ip_hash, consent_marketing, email_confirmation_token
  ) VALUES (
    p_email, 'blog_subscribe', p_ip_hash, TRUE, v_token
  );

  RETURN jsonb_build_object(
    'success',                  TRUE,
    'was_new',                  TRUE,
    'email_confirmation_token', v_token
  );
END;
$$;

-- 4. waitlist_count_dublin — exclude blog subscribers -----------------------
--
-- The public counter on the marketing landing page is "Dublin waitlist
-- signups." Confirmed blog subscribers shouldn't inflate that number.

CREATE OR REPLACE FUNCTION waitlist_count_dublin()
RETURNS INT
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM waitlist_signups
  WHERE city = 'dublin'
    AND source = 'waitlist'
    AND email_confirmed_at IS NOT NULL;
$$;

-- 5. Schema cache reload -----------------------------------------------------

SELECT pg_notify('pgrst', 'reload schema');
