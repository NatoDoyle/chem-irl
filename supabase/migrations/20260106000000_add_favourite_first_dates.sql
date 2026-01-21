-- Migration: Add favourite_first_dates column to profiles table
-- Created: 2026-01-06
-- Purpose: Add a text array field to store 1-3 favourite first date ideas per user profile

-- Add the column with NOT NULL default empty array and CHECK constraint
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS favourite_first_dates text[] NOT NULL DEFAULT '{}';

-- Add CHECK constraint to limit array to maximum 3 items
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_favourite_first_dates_max_length;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_favourite_first_dates_max_length
CHECK (array_length(favourite_first_dates, 1) IS NULL OR array_length(favourite_first_dates, 1) <= 3);

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- Verify the column exists with correct type and constraints:
-- SELECT 
--   column_name,
--   data_type,
--   udt_name,
--   is_nullable,
--   column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name = 'favourite_first_dates';
--
-- Expected result:
--   - column_name = 'favourite_first_dates'
--   - data_type = 'ARRAY'
--   - udt_name = '_text'
--   - is_nullable = 'NO'
--   - column_default = '{}'
--
-- Verify the CHECK constraint exists:
-- SELECT 
--   conname,
--   pg_get_constraintdef(oid) as constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'public.profiles'::regclass
--   AND conname = 'profiles_favourite_first_dates_max_length';
--
-- Expected result:
--   - conname = 'profiles_favourite_first_dates_max_length'
--   - constraint_definition should contain: CHECK (array_length(favourite_first_dates, 1) IS NULL OR array_length(favourite_first_dates, 1) <= 3)
