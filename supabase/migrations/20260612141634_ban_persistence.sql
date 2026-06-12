-- Ban persistence (launch-readiness T1.11).
--
-- Verified gap: reports.accused_id / reports.reporter_id /
-- enforcements.accused_id / blocks.* are all ON DELETE CASCADE, so a
-- banned user could delete their account (delete-account edge function →
-- auth.admin.deleteUser → cascades), erase every report and enforcement
-- against them, and re-register clean with the same email.
--
-- Fix: a durable enforcement_bans table that deliberately has NO foreign
-- keys (it must survive the deletion of everything it references):
--   1. enforcement_bans stores sha256 hashes of the banned identifiers
--      (lowercased email, raw phone) — no plaintext PII is retained after
--      account deletion, satisfying GDPR data-minimisation while keeping
--      the ban enforceable (legitimate-interest basis: fraud/abuse
--      prevention).
--   2. record_enforcement_ban() trigger writes a ban row whenever an
--      enforcements row lands with a ban action (temporary_ban /
--      permanent_ban / device_ban). temporary_ban + ttl_days → expires_at.
--   3. handle_new_user() (v3) refuses auth signups whose email/phone hash
--      matches an active ban — the INSERT into auth.users aborts, so the
--      OTP signup fails before any app rows exist.
--   4. delete-account needs NO changes: it never touches this table and
--      nothing cascades into it.
--
-- Unban = DELETE FROM public.enforcement_bans WHERE ban_id = … (service
-- role / Studio), or let expires_at lapse for temporary bans.

-- 1. Durable ban table (intentionally no FKs)
CREATE TABLE IF NOT EXISTS public.enforcement_bans (
  ban_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash TEXT,
  phone_hash TEXT,
  -- Snapshot of the banned account at enforcement time; NOT a foreign key
  -- (the row must outlive the account).
  banned_user_id UUID,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL = permanent
  expires_at TIMESTAMPTZ,
  CONSTRAINT enforcement_bans_identifier_present
    CHECK (email_hash IS NOT NULL OR phone_hash IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS enforcement_bans_email_hash_idx
  ON public.enforcement_bans (email_hash) WHERE email_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS enforcement_bans_phone_hash_idx
  ON public.enforcement_bans (phone_hash) WHERE phone_hash IS NOT NULL;

-- System table: RLS on, no policies. Only SECURITY DEFINER functions and
-- the service role touch it (same pattern as scoring_events et al.).
ALTER TABLE public.enforcement_bans ENABLE ROW LEVEL SECURITY;

-- 2. Write path: enforcement with a ban action → durable ban row
CREATE OR REPLACE FUNCTION public.record_enforcement_ban()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
BEGIN
  IF NEW.action::text NOT IN ('temporary_ban', 'permanent_ban', 'device_ban') THEN
    RETURN NEW;
  END IF;

  SELECT u.email, u.phone INTO v_email, v_phone
  FROM public.users u
  WHERE u.user_id = NEW.accused_id;

  -- Account already gone (or no identifiers): nothing durable to record.
  IF v_email IS NULL AND v_phone IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.enforcement_bans
    (email_hash, phone_hash, banned_user_id, action, reason, expires_at)
  VALUES (
    CASE WHEN v_email IS NULL THEN NULL
         ELSE encode(extensions.digest(lower(v_email), 'sha256'), 'hex') END,
    CASE WHEN v_phone IS NULL THEN NULL
         ELSE encode(extensions.digest(v_phone, 'sha256'), 'hex') END,
    NEW.accused_id,
    NEW.action::text,
    NEW.reason,
    CASE WHEN NEW.action::text = 'temporary_ban' AND NEW.ttl_days IS NOT NULL
         THEN COALESCE(NEW.created_at, now()) + make_interval(days => NEW.ttl_days)
         ELSE NULL END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_enforcement_ban ON public.enforcements;
CREATE TRIGGER trg_record_enforcement_ban
  AFTER INSERT OR UPDATE OF action ON public.enforcements
  FOR EACH ROW
  EXECUTE FUNCTION public.record_enforcement_ban();

-- 3. Check path: handle_new_user v3 — body identical to the age-gate
-- version (20260611163555) plus the active-ban gate at the top. Raising
-- here aborts the auth.users INSERT, so a banned identifier cannot even
-- create an auth account (the OTP signup call fails server-side).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refuse signups from actively banned identifiers.
  IF EXISTS (
    SELECT 1
    FROM public.enforcement_bans b
    WHERE (b.expires_at IS NULL OR b.expires_at > now())
      AND (
        (NEW.email IS NOT NULL
          AND b.email_hash = encode(extensions.digest(lower(NEW.email), 'sha256'), 'hex'))
        OR
        (NEW.phone IS NOT NULL
          AND b.phone_hash = encode(extensions.digest(NEW.phone, 'sha256'), 'hex'))
      )
  ) THEN
    RAISE EXCEPTION 'signup_blocked: account creation is not permitted'
      USING ERRCODE = '28000';
  END IF;

  -- Insert into users table (if not exists)
  INSERT INTO public.users (user_id, email, phone, created_at, updated_at, dob, gender, orientation)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    NOW(),
    NOW(),
    NULL,
    'other'::user_gender,
    'other'::user_orientation
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into profiles table (profiles uses id, not user_id)
  INSERT INTO public.profiles (id, prompts, availability, photos, completion_pct, signup_completed, created_at, updated_at)
  VALUES (
    NEW.id,
    '{}'::JSONB,
    '{}'::JSONB,
    '[]'::JSONB,
    0,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 4. Backfill: persist any pre-existing ban enforcements (no-op today —
-- enforcements is empty in prod — but correct by construction).
INSERT INTO public.enforcement_bans
  (email_hash, phone_hash, banned_user_id, action, reason, expires_at)
SELECT
  CASE WHEN u.email IS NULL THEN NULL
       ELSE encode(extensions.digest(lower(u.email), 'sha256'), 'hex') END,
  CASE WHEN u.phone IS NULL THEN NULL
       ELSE encode(extensions.digest(u.phone, 'sha256'), 'hex') END,
  e.accused_id,
  e.action::text,
  e.reason,
  CASE WHEN e.action::text = 'temporary_ban' AND e.ttl_days IS NOT NULL
       THEN COALESCE(e.created_at, now()) + make_interval(days => e.ttl_days)
       ELSE NULL END
FROM public.enforcements e
JOIN public.users u ON u.user_id = e.accused_id
WHERE e.action::text IN ('temporary_ban', 'permanent_ban', 'device_ban')
  AND (u.email IS NOT NULL OR u.phone IS NOT NULL);

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
