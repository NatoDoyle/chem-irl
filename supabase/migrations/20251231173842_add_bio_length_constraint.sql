-- Migration: Add bio length constraint (0-200 characters)
-- Created: 2025-12-31
-- Purpose: Enforce bio length limit in profiles.prompts JSONB field
-- Bio is stored as prompts->>'bio' in the profiles table

-- ============================================================================
-- Step 1: Truncate existing bios that exceed 200 characters
-- ============================================================================
UPDATE profiles
SET prompts = jsonb_set(
  prompts,
  '{bio}',
  to_jsonb(left(prompts->>'bio', 200))
)
WHERE prompts->>'bio' IS NOT NULL
  AND char_length(prompts->>'bio') > 200;

-- ============================================================================
-- Step 2: Add CHECK constraint on profiles.prompts
-- ============================================================================
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_bio_length_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_bio_length_check
CHECK (prompts->>'bio' IS NULL OR char_length(prompts->>'bio') <= 200);

