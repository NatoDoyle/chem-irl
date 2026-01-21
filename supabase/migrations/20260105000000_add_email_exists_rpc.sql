-- Migration: Add email_exists RPC function
-- Created: 2026-01-05
-- Purpose: Check if an email exists in auth.users before signup to prevent duplicates
-- Note: This enables user enumeration but is required for UX (redirecting to sign-in)

-- Create function to check if email exists in auth.users
CREATE OR REPLACE FUNCTION public.email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(u.email) = lower(trim(p_email))
  );
$$;

-- Revoke all permissions from PUBLIC (explicit security)
REVOKE ALL ON FUNCTION public.email_exists(text) FROM PUBLIC;

-- Grant EXECUTE permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.email_exists(text) TO authenticated;

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- 1. Verify function exists
-- SELECT to_regprocedure('public.email_exists(text)');
-- Expected: Returns function OID (not NULL)
--
-- 2. Verify permissions
-- SELECT has_function_privilege('anon', 'public.email_exists(text)', 'EXECUTE');
-- SELECT has_function_privilege('authenticated', 'public.email_exists(text)', 'EXECUTE');
-- Expected: Both return true
--
-- 3. Test function (replace with actual email)
-- SELECT public.email_exists('test@example.com');
-- Expected: Returns true if email exists, false otherwise
--
-- 4. If function exists but RPC calls fail, reload PostgREST schema cache:
-- NOTIFY pgrst, 'reload schema';


