-- Migration: Add comprehensive onboarding fields to profiles table
-- Created: 2026-01-07
-- Purpose: Add all fields required for the strict 26-step onboarding flow

-- Add onboarding state tracking (jsonb)
-- First, add column as nullable if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding jsonb;

-- Set default for existing rows
UPDATE public.profiles
SET onboarding = '{"currentStepId": null, "resolvedSteps": {}}'::jsonb
WHERE onboarding IS NULL;

-- Now make it NOT NULL with default
ALTER TABLE public.profiles
ALTER COLUMN onboarding SET DEFAULT '{"currentStepId": null, "resolvedSteps": {}}'::jsonb,
ALTER COLUMN onboarding SET NOT NULL;

-- Add terms_accepted column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

-- Set default for existing rows
UPDATE public.profiles
SET terms_accepted = false
WHERE terms_accepted IS NULL;

-- Make it NOT NULL
ALTER TABLE public.profiles
ALTER COLUMN terms_accepted SET DEFAULT false,
ALTER COLUMN terms_accepted SET NOT NULL;

-- Core eligibility fields (Phase 2)
-- Note: dob, gender, orientation are in users table, but we'll reference them
-- Add location fields
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_known_lat NUMERIC,
ADD COLUMN IF NOT EXISTS last_known_lng NUMERIC,
ADD COLUMN IF NOT EXISTS location_permission_granted BOOLEAN DEFAULT false;

-- High-signal profile data (Phase 4)
ALTER TABLE public.profiles
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
ADD COLUMN IF NOT EXISTS diet_details TEXT;

-- Personality & social context (Phase 5)
-- interests will be stored in prompts JSONB or as separate array
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS interests_skipped BOOLEAN DEFAULT false,
-- favourite_first_dates already exists from previous migration
ADD COLUMN IF NOT EXISTS love_language TEXT,
ADD COLUMN IF NOT EXISTS personality_type TEXT,
ADD COLUMN IF NOT EXISTS astrology_sign TEXT,
ADD COLUMN IF NOT EXISTS job_title TEXT,
ADD COLUMN IF NOT EXISTS education TEXT;

-- Bio & verification (Phase 6)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS photo_verification_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS photo_verification_timestamp TIMESTAMPTZ;

-- Add CHECK constraints
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_height_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_height_check
CHECK (height_cm IS NULL OR (height_cm >= 50 AND height_cm <= 250));

-- Add CHECK constraint for onboarding state structure
-- Note: PostgreSQL doesn't support JSONB structure validation directly,
-- but we can add a trigger or rely on application logic
-- For now, we'll rely on application-level validation

-- Create index on onboarding state for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_current_step
ON public.profiles USING GIN ((onboarding->'currentStepId'));

CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_resolved_steps
ON public.profiles USING GIN ((onboarding->'resolvedSteps'));

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- Verify all columns exist:
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
