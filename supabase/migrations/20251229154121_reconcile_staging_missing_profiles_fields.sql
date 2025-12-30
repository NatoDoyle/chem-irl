-- Migration: Reconcile staging - add missing profiles fields, storage bucket, and trigger
-- Created: 2025-12-29
-- Purpose: Add missing columns, storage bucket, and auto-create trigger for staging environment

-- Add full_name column to profiles (if not exists)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add signup_completed flag to profiles (if not exists)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS signup_completed BOOLEAN DEFAULT false;

-- Create index for signup_completed for faster queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_signup_completed ON profiles(signup_completed) WHERE signup_completed = false;

-- Update existing profiles to mark signup as completed if they have completion_pct >= 100
UPDATE profiles
SET signup_completed = true
WHERE completion_pct >= 100 AND signup_completed IS NULL;

-- Create storage bucket "profiles" (if not exists)
-- SECURITY NOTE: Bucket is public to allow profile photos to be displayed in discovery feed
-- and matches. Photos are stored in paths like `${userId}/${timestamp}.jpg`.
-- Future enhancement: Consider adding storage RLS policies to restrict access to
-- authenticated users only, or use signed URLs for additional privacy.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles',
  'profiles',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Function to create profile when auth user is created
-- SECURITY: Uses SECURITY DEFINER with SET search_path to prevent search_path attacks.
-- Only inserts into public.users and public.profiles tables (safe operations).
-- Grants are limited to authenticated and service_role roles.
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

  -- Insert into profiles table (if not exists)
  INSERT INTO public.profiles (user_id, prompts, availability, photos, completion_pct, signup_completed, created_at, updated_at)
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
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

