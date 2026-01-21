-- Migration: Harden public.users lifecycle (FK, nullable phone, trigger)
-- Created: 2026-01-20

-- 1) Ensure phone is nullable (safe if already nullable)
ALTER TABLE public.users
  ALTER COLUMN phone DROP NOT NULL;

-- 2) Add FK public.users(user_id) -> auth.users(id) with ON DELETE CASCADE
--    First, ensure there are no orphan rows; if any, raise an error with guidance.
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.users u
  LEFT JOIN auth.users au ON au.id = u.user_id
  WHERE au.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Found % orphan public.users row(s). Delete or fix them before adding FK. Run: SELECT u.* FROM public.users u LEFT JOIN auth.users au ON au.id = u.user_id WHERE au.id IS NULL;', orphan_count;
  END IF;

  -- Drop existing FK if any, then add canonical FK
  ALTER TABLE public.users
    DROP CONSTRAINT IF EXISTS users_user_id_fkey;

  ALTER TABLE public.users
    ADD CONSTRAINT users_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES auth.users(id)
      ON DELETE CASCADE;
END $$;

-- 3) Harden handle_new_user trigger function
--    - Upsert into public.users with NEW.id, NEW.email, NEW.phone
--    - Insert into public.profiles (id) with safe defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert into users table
  INSERT INTO public.users (user_id, email, phone, created_at, updated_at, dob, gender, orientation)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    NOW(),
    NOW(),
    '2000-01-01'::DATE, -- Default DOB (should be updated during onboarding)
    'other'::user_gender, -- Default gender (should be updated during onboarding)
    'other'::user_orientation -- Default orientation (should be updated during onboarding)
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  -- Insert into profiles table (if not exists) using 'id' column
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

-- =========================================================================
-- Verification SQL (run after migration):
-- =========================================================================
-- 1) Check phone nullability
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone';
--
-- 2) Check FK
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.users'::regclass AND contype = 'f';
--
-- 3) Check handle_new_user definition
-- SELECT proname, pg_get_functiondef(oid)
-- FROM pg_proc
-- JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
-- WHERE n.nspname = 'public' AND proname = 'handle_new_user';
--
-- 4) Test trigger by creating a test user in auth.users (via Supabase UI) and
--    verifying that public.users and public.profiles rows are created.
