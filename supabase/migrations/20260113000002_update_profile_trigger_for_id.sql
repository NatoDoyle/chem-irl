-- Migration: Update handle_new_user() trigger to use 'id' instead of 'user_id'
-- Created: 2026-01-13
-- Purpose: After standardizing profiles.id, update the auto-create trigger to use the new column name

-- Update function to use 'id' column (canonical key)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into users table (if not exists)
  INSERT INTO public.users (user_id, email, phone, created_at, updated_at, dob, gender, orientation)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    NOW(),
    NOW(),
    '2000-01-01'::DATE, -- Default DOB (should be updated during onboarding)
    'other'::user_gender, -- Default gender (should be updated during onboarding)
    'other'::user_orientation -- Default orientation (should be updated during onboarding)
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into profiles table (if not exists) using 'id' column
  INSERT INTO public.profiles (id, prompts, availability, photos, completion_pct, signup_completed, created_at, updated_at)
  VALUES (
    NEW.id,
    '{}'::JSONB,
    '{}'::JSONB,
    '[]'::JSONB,
    0,
    false,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger already exists, no need to recreate
-- The trigger on_auth_user_created will automatically use the updated function

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- 1. Verify function exists and uses 'id':
-- SELECT routine_name, routine_definition
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'handle_new_user';
--
-- Expected: routine_definition should contain 'INSERT INTO public.profiles (id, ...)'
--           and NOT contain 'INSERT INTO public.profiles (user_id, ...)'
--
-- 2. Verify trigger exists:
-- SELECT trigger_name, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name = 'on_auth_user_created';
--
-- Expected: trigger should exist and reference handle_new_user()
