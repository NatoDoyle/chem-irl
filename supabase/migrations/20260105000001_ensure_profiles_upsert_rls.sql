-- Migration: Ensure profiles RLS policies support upsert operations
-- Created: 2026-01-05
-- Purpose: Ensure INSERT and UPDATE policies are correctly configured for upsert operations
-- Note: This is idempotent - will recreate the policies if they already exist

-- Drop existing policies to recreate with explicit TO authenticated and schema qualification
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate INSERT policy with explicit TO authenticated and schema-qualified table
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Recreate UPDATE policy with explicit TO authenticated, USING, and WITH CHECK clauses
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- Verify both policies exist with correct configuration:
-- SELECT 
--   schemaname,
--   tablename,
--   policyname,
--   permissive,
--   roles,
--   cmd,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'profiles' 
--   AND policyname IN ('Users can insert own profile', 'Users can update own profile')
-- ORDER BY policyname;
-- 
-- Expected for INSERT policy:
--   - cmd = 'INSERT'
--   - roles = '{authenticated}'
--   - with_check should contain auth.uid() = user_id
--
-- Expected for UPDATE policy:
--   - cmd = 'UPDATE'
--   - roles = '{authenticated}'
--   - qual should contain auth.uid() = user_id
--   - with_check should also contain auth.uid() = user_id

