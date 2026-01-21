-- Migration: Audit and cleanup profiles RLS policies
-- Created: 2026-01-05
-- Purpose: Ensure only the intended INSERT/UPDATE policies exist on public.profiles
-- Note: This migration is idempotent and safe to run multiple times

-- ============================================================================
-- Step 1: List all existing policies on public.profiles (for verification)
-- ============================================================================
-- Run this query BEFORE applying the migration to see current state:
-- SELECT 
--   policyname,
--   cmd,
--   roles,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'profiles'
-- ORDER BY policyname, cmd;
--
-- Note: Look for policies with cmd IN ('INSERT', 'UPDATE', 'ALL')
-- FOR ALL policies apply to INSERT/UPDATE operations and must be handled

-- ============================================================================
-- Step 2: Drop any INSERT/UPDATE policies that are not the intended ones
-- ============================================================================
-- Drop policies by name (safe - only drops if they exist)

-- Drop the original policies from 20240102000000_rls.sql if they still exist
-- (These may not have TO authenticated or proper WITH CHECK clauses)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Drop any other INSERT/UPDATE/ALL policies that might exist (defensive cleanup)
-- This will drop any policies with INSERT/UPDATE/ALL commands that don't match our intended names
-- Note: FOR ALL policies apply to INSERT/UPDATE operations, so they must be handled too
-- Using lower(cmd) for case-insensitive matching
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND lower(cmd) IN ('insert', 'update', 'all')
      AND policyname NOT IN ('Users can insert own profile', 'Users can update own profile')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    RAISE NOTICE 'Dropped unexpected policy: %', pol.policyname;
  END LOOP;
END $$;

-- ============================================================================
-- Step 3: Recreate the intended policies (ensures they exist with correct config)
-- ============================================================================
-- Recreate the policies with explicit TO authenticated, USING, and WITH CHECK clauses
-- This ensures they are properly configured for upsert operations

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- 1. Verify INSERT/UPDATE/ALL policies (should be exactly 2 rows):
-- SELECT 
--   policyname,
--   cmd,
--   roles,
--   permissive,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'profiles'
--   AND lower(cmd) IN ('insert', 'update', 'all')
-- ORDER BY policyname;
--
-- Expected results (exactly 2 rows):
-- 1. policyname = 'Users can insert own profile'
--    - cmd = 'INSERT'
--    - roles = '{authenticated}'
--    - with_check contains: auth.uid() = user_id
--
-- 2. policyname = 'Users can update own profile'
--    - cmd = 'UPDATE'
--    - roles = '{authenticated}'
--    - qual contains: auth.uid() = user_id
--    - with_check contains: auth.uid() = user_id
--
-- If you see any other INSERT/UPDATE/ALL policies, they should be reviewed and removed.
-- Note: FOR ALL policies apply to INSERT/UPDATE operations, so they are included in this check.
--
-- 2. Verify SELECT/ALL read policies (for completeness):
-- SELECT 
--   policyname,
--   cmd,
--   roles,
--   permissive,
--   qual,
--   with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' 
--   AND tablename = 'profiles'
--   AND lower(cmd) IN ('select', 'all')
-- ORDER BY policyname;
--
-- Expected: At least one SELECT policy (typically "Users can view own profile")
-- Note: This migration does NOT drop cmd='SELECT' policies, but it DOES drop cmd='ALL' policies
--       that don't match our intended INSERT/UPDATE policy names. Since FOR ALL policies apply
--       to all operations (including SELECT), dropping an ALL policy may affect read access.
--       This query helps verify that read access remains intact after the migration.

