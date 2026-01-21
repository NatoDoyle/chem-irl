-- Verification query: Check column types for profiles table
-- Run this in Supabase SQL editor to verify types match app expectations

SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN (
    'photos',
    'favourite_first_dates',
    'languages',
    'interests',
    'onboarding',
    'terms_accepted',
    'bio',
    'location_permission_granted',
    'height_cm',
    'height_prefer_not_say'
  )
ORDER BY column_name;

-- Expected types:
-- photos: ARRAY (text[]) OR jsonb (both work with Supabase, but text[] is cleaner for arrays)
-- favourite_first_dates: ARRAY (text[])
-- languages: ARRAY (text[])
-- interests: ARRAY (text[])
-- onboarding: jsonb
-- terms_accepted: boolean
-- bio: text
-- location_permission_granted: boolean
-- height_cm: integer
-- height_prefer_not_say: boolean
