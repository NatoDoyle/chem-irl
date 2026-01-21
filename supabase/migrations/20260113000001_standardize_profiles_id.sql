-- Migration: Standardize profiles to use 'id' as primary key (matching auth.users(id))
-- Created: 2026-01-13
-- Purpose: Change profiles from user_id PK to id PK, aligning with auth.users(id) pattern
-- This migration safely renames user_id -> id if needed, but does NOT drop user_id column

DO $$
DECLARE
  has_user_id boolean;
  has_id boolean;
  fk text;
  orphan_count integer;
  duplicate_count integer;
BEGIN
  -- Check which columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id'
  ) INTO has_user_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='id'
  ) INTO has_id;

  -- ============================================================================
  -- Handle case where both user_id and id exist: backfill id from user_id
  -- ============================================================================
  IF has_user_id AND has_id THEN
    RAISE NOTICE 'Both user_id and id exist, backfilling id from user_id where NULL';
    EXECUTE 'UPDATE public.profiles SET id = user_id WHERE id IS NULL';
  END IF;

  -- ============================================================================
  -- Drop FKs from profiles to auth.users (only) before attempting PK changes
  -- This allows us to recreate the canonical profiles_id_fkey later
  -- Note: We do NOT drop other FKs (if any exist) to avoid destructive changes
  -- ============================================================================
  FOR fk IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.profiles'::regclass
      AND c.contype = 'f'
      AND c.confrelid = 'auth.users'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', fk);
  END LOOP;

  -- ============================================================================
  -- Case 1: user_id exists, id does not -> rename user_id to id (preferred)
  -- ============================================================================
  IF has_user_id AND NOT has_id THEN
    RAISE NOTICE 'Renaming profiles.user_id to profiles.id';

    -- Drop PK (will recreate on id)
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey';

    -- Rename user_id -> id
    EXECUTE 'ALTER TABLE public.profiles RENAME COLUMN user_id TO id';
  END IF;

  -- ============================================================================
  -- At this point, id must exist
  -- ============================================================================
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='id'
  ) THEN
    RAISE EXCEPTION 'profiles table must have an id column after standardization';
  END IF;

  -- ============================================================================
  -- Preflight check: detect orphaned profiles (profiles without matching auth.users)
  -- This catches both NULL ids and ids that don't exist in auth.users
  -- Run BEFORE setting NOT NULL and creating PK
  -- ============================================================================
  SELECT COUNT(*) INTO orphan_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id IS NULL OR u.id IS NULL;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Found % orphaned profile(s): profiles with NULL id or without matching auth.users entry. Clean up orphaned profiles before adding FK constraint. Run: SELECT id FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE p.id IS NULL OR u.id IS NULL;', orphan_count;
  END IF;

  -- ============================================================================
  -- Ensure correct id properties
  -- ============================================================================
  -- Make id NOT NULL (id must equal auth.users(id), never random)
  EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN id SET NOT NULL';

  -- Remove any default (id must equal auth.users(id), never random)
  EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN id DROP DEFAULT';

  -- ============================================================================
  -- Preflight check: detect duplicate ids before creating PK
  -- ============================================================================
  -- Check for NULL ids (shouldn't happen after orphan check, but double-check)
  SELECT COUNT(*) INTO duplicate_count
  FROM public.profiles
  WHERE id IS NULL;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % profile(s) with NULL id. Cannot create primary key.', duplicate_count;
  END IF;

  -- Check for duplicate non-NULL ids
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT id, COUNT(*) as cnt
    FROM public.profiles
    GROUP BY id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Found % duplicate id value(s) in profiles table. Cannot create primary key. Run: SELECT id, COUNT(*) FROM public.profiles GROUP BY id HAVING COUNT(*) > 1;', duplicate_count;
  END IF;

  -- ============================================================================
  -- Ensure PK on id
  -- ============================================================================
  EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey';
  EXECUTE 'ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id)';

  -- ============================================================================
  -- Ensure FK to auth.users(id)
  -- ============================================================================
  -- Add the canonical FK (orphan check already passed above, auth.users FKs already dropped)
  -- The DROP IF EXISTS is redundant but safe (handles case where loop didn't catch it)
  EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey';
  EXECUTE 'ALTER TABLE public.profiles
           ADD CONSTRAINT profiles_id_fkey
           FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE';

  -- ============================================================================
  -- Optional index (redundant because PK already indexes, but explicit is fine)
  -- ============================================================================
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id)';

  RAISE NOTICE 'Migration complete: profiles.id is now the primary key referencing auth.users(id)';
  RAISE NOTICE 'Note: user_id column may still exist. Do not drop it until you have audited all views, functions, triggers, and client code.';
END $$;

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- 0. Verify FK constraints on profiles (should only have profiles_id_fkey to auth.users):
-- SELECT
--   c.conname AS constraint_name,
--   c.contype AS constraint_type,
--   pg_get_constraintdef(c.oid) AS constraint_definition,
--   confrelid::regclass AS references_table
-- FROM pg_constraint c
-- WHERE c.conrelid = 'public.profiles'::regclass
--   AND c.contype = 'f'
-- ORDER BY c.conname;
--
-- Expected:
--   - Only one FK: profiles_id_fkey referencing auth.users(id)
--   - No other FKs should exist (unless profiles has other legitimate FKs)
--
-- 1. Confirm profiles schema:
-- SELECT column_name, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='profiles'
--   AND column_name IN ('id','user_id','onboarding','terms_accepted')
-- ORDER BY column_name;
--
-- Expected:
--   - id exists, NOT NULL, NO default
--   - onboarding exists, NOT NULL, default json
--   - terms_accepted exists, NOT NULL, default false
--   - user_id may or may not exist (acceptable for now)
--
-- 2. Confirm PK + FK:
-- SELECT conname, contype
-- FROM pg_constraint
-- WHERE conrelid='public.profiles'::regclass
-- ORDER BY contype, conname;
--
-- Expected:
--   - one PK on id
--   - one FK to auth.users(id) named profiles_id_fkey
--
-- 3. Confirm trigger function is updated:
-- SELECT proname
-- FROM pg_proc
-- JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
-- WHERE n.nspname='public' AND proname='handle_new_user';
--
-- Expected: function exists (verify it uses 'id' in INSERT statement)
--
-- 4. Verify all rows have id populated:
-- SELECT COUNT(*) as total, COUNT(id) as with_id
-- FROM public.profiles;
--
-- Expected: total = with_id (all rows should have id)
