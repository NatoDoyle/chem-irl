-- Migration: Change profiles.user_id FK to reference auth.users(id)
-- Created: 2025-12-31
-- Purpose: Align profiles FK with auth.users (source of truth) instead of public.users
-- This matches the pattern used for push_tokens and simplifies backfill logic
-- Note: public.users is still used by other tables and functions, but profiles is independent

-- ============================================================================
-- Step 1: Drop existing FK constraint
-- ============================================================================
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- ============================================================================
-- Step 2: Create new FK constraint referencing auth.users(id)
-- ============================================================================
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS references_table
-- FROM pg_constraint WHERE conname='profiles_user_id_fkey';
-- Expected: table_name = 'profiles', references_table = 'users' (in auth schema)