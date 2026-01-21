-- Verification script for get_discovery_feed function
-- Run this after: supabase db push --include-all
-- 
-- Usage:
--   supabase db execute --file scripts/verify_get_discovery_feed.sql
--   OR copy/paste into Supabase SQL Editor

-- 1. Verify function exists
SELECT 
  CASE 
    WHEN to_regprocedure('public.get_discovery_feed(uuid, integer)') IS NOT NULL 
    THEN '✓ Function exists'
    ELSE '✗ Function NOT FOUND'
  END AS function_status,
  to_regprocedure('public.get_discovery_feed(uuid, integer)') AS function_oid;

-- 2. Verify authenticated role has EXECUTE permission
SELECT 
  CASE 
    WHEN has_function_privilege('authenticated', 'public.get_discovery_feed(uuid, integer)', 'EXECUTE')
    THEN '✓ authenticated has EXECUTE'
    ELSE '✗ authenticated MISSING EXECUTE'
  END AS authenticated_permission;

-- 3. Verify PUBLIC does NOT have EXECUTE permission
SELECT 
  CASE 
    WHEN has_function_privilege('public', 'public.get_discovery_feed(uuid, integer)', 'EXECUTE')
    THEN '✗ PUBLIC has EXECUTE (should NOT)'
    ELSE '✓ PUBLIC correctly has NO EXECUTE'
  END AS public_permission;

-- 4. Reload PostgREST schema cache (if needed)
-- Uncomment the line below if function exists but RPC calls still fail
-- NOTIFY pgrst, 'reload schema';


