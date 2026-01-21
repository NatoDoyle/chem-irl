-- Migration: Align onboarding/profile schema with app expectations
-- Created: 2026-01-13
-- Purpose: Ensure all columns expected by loadOnboardingState exist and bio is standardized

-- ============================================================================
-- Step 1: Ensure all required columns exist (add missing ones)
-- ============================================================================
-- All columns from 20260107000000_add_onboarding_fields.sql should exist,
-- but we ensure they're all present with correct types

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding jsonb,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_known_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS last_known_lng NUMERIC,
  ADD COLUMN IF NOT EXISTS location_permission_granted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS height_cm INTEGER,
  ADD COLUMN IF NOT EXISTS height_prefer_not_say BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS relationship_intent TEXT,
  ADD COLUMN IF NOT EXISTS family_plans TEXT,
  ADD COLUMN IF NOT EXISTS pets TEXT,
  ADD COLUMN IF NOT EXISTS drinking TEXT,
  ADD COLUMN IF NOT EXISTS smoking TEXT,
  ADD COLUMN IF NOT EXISTS drugs TEXT,
  ADD COLUMN IF NOT EXISTS activity_level TEXT,
  ADD COLUMN IF NOT EXISTS diet TEXT,
  ADD COLUMN IF NOT EXISTS diet_details TEXT,
  ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interests_skipped BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS love_language TEXT,
  ADD COLUMN IF NOT EXISTS personality_type TEXT,
  ADD COLUMN IF NOT EXISTS astrology_sign TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS education TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS photo_verification_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS photo_verification_timestamp TIMESTAMPTZ;

-- ============================================================================
-- Step 2: Set defaults for existing rows (for columns that need NOT NULL)
-- ============================================================================
UPDATE public.profiles
SET
  onboarding = COALESCE(onboarding, '{"currentStepId": null, "resolvedSteps": {}}'::jsonb),
  terms_accepted = COALESCE(terms_accepted, false),
  location_permission_granted = COALESCE(location_permission_granted, false),
  height_prefer_not_say = COALESCE(height_prefer_not_say, false),
  languages = COALESCE(languages, '{}'::text[]),
  interests = COALESCE(interests, '{}'::text[]),
  interests_skipped = COALESCE(interests_skipped, false),
  photo_verification_status = COALESCE(photo_verification_status, 'pending')
WHERE onboarding IS NULL
   OR terms_accepted IS NULL
   OR location_permission_granted IS NULL
   OR height_prefer_not_say IS NULL
   OR languages IS NULL
   OR interests IS NULL
   OR interests_skipped IS NULL
   OR photo_verification_status IS NULL;

-- ============================================================================
-- Step 3: Backfill bio column from prompts->>'bio' if bio column is NULL
-- ============================================================================
UPDATE public.profiles
SET bio = prompts->>'bio'
WHERE bio IS NULL
  AND prompts->>'bio' IS NOT NULL
  AND prompts->>'bio' != '';

-- ============================================================================
-- Step 4: Update bio constraint to check bio column instead of prompts->>'bio'
-- ============================================================================
-- Drop old constraint on prompts JSONB
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_bio_length_check;

-- Add new constraint on bio column (0-500 characters to match BioScreen validation)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_bio_length_check
CHECK (bio IS NULL OR char_length(bio) <= 500);

-- ============================================================================
-- Step 5: Set NOT NULL defaults for columns that should have defaults
-- ============================================================================
ALTER TABLE public.profiles
  ALTER COLUMN onboarding SET DEFAULT '{"currentStepId": null, "resolvedSteps": {}}'::jsonb,
  ALTER COLUMN terms_accepted SET DEFAULT false,
  ALTER COLUMN location_permission_granted SET DEFAULT false,
  ALTER COLUMN height_prefer_not_say SET DEFAULT false,
  ALTER COLUMN languages SET DEFAULT '{}'::text[],
  ALTER COLUMN interests SET DEFAULT '{}'::text[],
  ALTER COLUMN interests_skipped SET DEFAULT false,
  ALTER COLUMN photo_verification_status SET DEFAULT 'pending';

-- ============================================================================
-- Step 6: Ensure onboarding and terms_accepted are NOT NULL
-- ============================================================================
-- onboarding
UPDATE public.profiles
SET onboarding = '{"currentStepId": null, "resolvedSteps": {}}'::jsonb
WHERE onboarding IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN onboarding SET NOT NULL;

-- terms_accepted
UPDATE public.profiles
SET terms_accepted = false
WHERE terms_accepted IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN terms_accepted SET NOT NULL;

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- 1. Verify all required columns exist:
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
--   AND column_name IN (
--     'onboarding', 'terms_accepted', 'last_known_lat', 'last_known_lng', 'location_permission_granted',
--     'height_cm', 'height_prefer_not_say', 'languages', 'relationship_intent',
--     'family_plans', 'pets', 'drinking', 'smoking', 'drugs', 'activity_level',
--     'diet', 'diet_details', 'interests', 'interests_skipped', 'love_language',
--     'personality_type', 'astrology_sign', 'job_title', 'education', 'bio',
--     'photo_verification_status', 'photo_verification_timestamp'
--   )
-- ORDER BY column_name;
--
-- 2. Verify bio constraint is on bio column, not prompts:
-- SELECT conname, pg_get_constraintdef(oid) AS constraint_definition
-- FROM pg_constraint
-- WHERE conrelid = 'public.profiles'::regclass
--   AND conname = 'profiles_bio_length_check';
--
-- Expected: CHECK (bio IS NULL OR char_length(bio) <= 500)
--
-- 3. Verify bio was backfilled from prompts:
-- SELECT COUNT(*) as total,
--        COUNT(bio) as has_bio_column,
--        COUNT(prompts->>'bio') as has_prompts_bio
-- FROM public.profiles
-- WHERE prompts->>'bio' IS NOT NULL;
--
-- Expected: has_bio_column should be >= has_prompts_bio (bio backfilled)
