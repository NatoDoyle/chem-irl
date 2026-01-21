-- Migration: Fix profiles RLS policies to use 'id' column
-- Created: 2026-01-13
-- Purpose: Ensure RLS policies use the canonical 'id' column
-- Note: Runs AFTER 20260113000001_standardize_profiles_id.sql to ensure 'id' column exists

-- Drop existing policies (safe - will recreate)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate policies using 'id' column (canonical key)
-- Using TO authenticated to match later migrations (20260105000001, 20260105000003)
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- 1. Verify policies exist and check which column they use:
-- SELECT 
--   policyname, 
--   cmd, 
--   qual, 
--   with_check,
--   roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'profiles'
-- ORDER BY policyname;
--
-- Expected: Should see policies with qual/with_check containing "auth.uid() = id"
--           and roles = '{authenticated}'
--
-- 2. Test RLS (as authenticated user):
-- SELECT id, onboarding, terms_accepted
-- FROM public.profiles
-- LIMIT 1;
--
-- Should return your own profile row, not empty or permission denied
