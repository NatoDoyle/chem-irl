-- Migration: Harden profiles SELECT RLS policy
-- Created: 2026-01-05
-- Purpose: Change "Users can view own profile" policy from roles={public} to roles={authenticated}
-- Note: This ensures only authenticated users can SELECT their own profile, not unauthenticated users

-- Drop the existing policy (may have roles={public})
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate the policy with explicit TO authenticated
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- Verify the policy exists with roles={authenticated}:
-- SELECT 
--   policyname,
--   cmd,
--   roles,
--   permissive,
--   qual
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'profiles' 
--   AND policyname = 'Users can view own profile';
--
-- Expected result:
--   - policyname = 'Users can view own profile'
--   - cmd = 'SELECT'
--   - roles = '{authenticated}' (not '{public}')
--   - qual contains: auth.uid() = user_id


