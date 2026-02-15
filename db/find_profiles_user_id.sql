-- Run in Supabase SQL Editor: find any functions/views/triggers/policies
-- referencing the exact substring "profiles.user_id" across all schemas.

-- 1. Functions (via prosrc)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  'function' AS object_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc ILIKE '%profiles.user_id%';

-- 2. Functions (via pg_get_functiondef; more reliable for long bodies)
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  'function' AS object_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) ILIKE '%profiles.user_id%';

-- 3. Views
SELECT
  schemaname AS schema_name,
  viewname AS object_name,
  'view' AS object_type
FROM pg_views
WHERE definition ILIKE '%profiles.user_id%';

-- 4. Materialized views
SELECT
  schemaname AS schema_name,
  matviewname AS object_name,
  'materialized_view' AS object_type
FROM pg_matviews m
JOIN pg_class c ON m.matviewname = c.relname
WHERE pg_get_viewdef(c.oid, true)::text ILIKE '%profiles.user_id%';

-- 5. RLS policies (qual and with_check expressions)
SELECT
  schemaname AS schema_name,
  tablename,
  policyname AS object_name,
  'policy' AS object_type
FROM pg_policies
WHERE qual::text ILIKE '%profiles.user_id%'
   OR with_check::text ILIKE '%profiles.user_id%';
