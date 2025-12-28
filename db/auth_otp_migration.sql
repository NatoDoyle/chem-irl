-- Migration: Add full_name and signup_completed to profiles table
-- For new OTP-based authentication flow

-- Add full_name column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add signup_completed flag to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS signup_completed BOOLEAN DEFAULT false;

-- Create index for signup_completed for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_signup_completed ON profiles(signup_completed) WHERE signup_completed = false;

-- Update existing profiles to mark signup as completed if they have completion_pct >= 100
UPDATE profiles
SET signup_completed = true
WHERE completion_pct >= 100 AND signup_completed IS NULL;

-- Note: Profiles auto-creation is handled by trigger in db/profiles_auto_create_trigger.sql
