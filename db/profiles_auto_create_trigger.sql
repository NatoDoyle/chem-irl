-- Migration: Auto-create profiles row when auth user is created
-- Ensures every new auth user gets a profiles row automatically

-- Function to create profile when auth user is created
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

  -- Insert into profiles table (profiles uses id, not user_id)
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

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

