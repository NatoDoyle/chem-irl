-- Fix: profiles table uses id (auth.users.id) as PK, not user_id.
-- handle_new_user() was still inserting profiles.user_id and ON CONFLICT(user_id).
-- This migration updates the trigger function to use id.

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
    '2000-01-01'::DATE,
    'other'::user_gender,
    'other'::user_orientation
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

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
