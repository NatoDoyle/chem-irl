-- Age gate enforcement (launch-readiness T1.3).
--
-- Chem IRL is 18+, but until now the app never collected a date of
-- birth: handle_new_user() stamped every new account with the
-- placeholder '2000-01-01' and nothing ever updated it. This migration
-- makes dob honest and enforces the legal boundary server-side:
--
--   1. users.dob becomes nullable — NULL now means "not provided yet"
--      (the placeholder made every account look ~26 instead).
--   2. handle_new_user() inserts NULL dob for new accounts (the only
--      change to its body vs 20250130000001).
--   3. users_dob_18_plus CHECK rejects any under-18 dob at write time.
--      Discovery-feed age filters are NULL-safe: EXTRACT(YEAR FROM
--      age(u.dob)) comparisons on NULL are NULL, so the row is simply
--      excluded from age-filtered feeds until dob is set — and the
--      mandatory AgeDob onboarding step sets it long before a profile
--      can reach the feed.
--   4. profiles.terms_accepted_at records when the signup-screen 18+/ToS
--      attestation happened (profiles.terms_accepted already existed but
--      nothing wrote it; completeSignup() now writes both).
--   5. enforce_age_gate_on_completion(): profiles.completion_pct cannot
--      reach 100 while users.dob IS NULL or terms_accepted is not true,
--      so no client path can finish onboarding around the gate.
--
-- Existing rows keep their historical placeholder dobs (4 pre-gate test
-- accounts); all pass the new CHECK and are not retro-gated. Pre-gate
-- accounts that are still mid-onboarding will need terms_accepted set
-- (or a fresh signup) to complete — acceptable pre-beta.

-- 1 + 3: nullable dob with an adults-only boundary
ALTER TABLE public.users ALTER COLUMN dob DROP NOT NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_dob_18_plus
  CHECK (dob IS NULL OR dob <= (CURRENT_DATE - INTERVAL '18 years'));

-- 2: new accounts start with no dob instead of a fake one
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- 4: attestation timestamp (terms_accepted bool already exists)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

-- 5: belt-and-braces — onboarding cannot complete without dob + terms
CREATE OR REPLACE FUNCTION public.enforce_age_gate_on_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob DATE;
BEGIN
  IF COALESCE(NEW.completion_pct, 0) >= 100
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.completion_pct, 0) < 100) THEN
    SELECT dob INTO v_dob FROM public.users WHERE user_id = NEW.id;
    IF v_dob IS NULL THEN
      RAISE EXCEPTION 'age_gate_dob_required: set a date of birth before completing the profile'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.terms_accepted IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'age_gate_terms_required: accept the terms before completing the profile'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_age_gate_on_completion ON public.profiles;
CREATE TRIGGER trg_enforce_age_gate_on_completion
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_age_gate_on_completion();

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
