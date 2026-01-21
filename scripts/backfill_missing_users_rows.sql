-- One-time backfill script for missing public.users rows
-- NOT a migration - run manually in Supabase SQL editor if needed
-- This script inserts missing users rows from auth.users with defaults matching handle_new_user()
-- Schema-robust: conditionally includes city_id/timezone based on column existence

DO $$
DECLARE
  has_city_id boolean;
  has_timezone boolean;
  insert_cols text;
  insert_vals text;
BEGIN
  -- Check if city_id column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'city_id'
  ) INTO has_city_id;

  -- Check if timezone column exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'timezone'
  ) INTO has_timezone;

  -- Build column list and values based on what exists
  -- Case 1: Both city_id and timezone exist
  IF has_city_id AND has_timezone THEN
    insert_cols := 'user_id, email, phone, created_at, updated_at, dob, gender, orientation, city_id, timezone';
    insert_vals := 'au.id, au.email, au.phone, COALESCE(au.created_at, NOW()), NOW(), ''2000-01-01''::DATE, ''other''::user_gender, ''other''::user_orientation, ''dublin'', ''Europe/Dublin''';
  -- Case 2: Only city_id exists
  ELSIF has_city_id AND NOT has_timezone THEN
    insert_cols := 'user_id, email, phone, created_at, updated_at, dob, gender, orientation, city_id';
    insert_vals := 'au.id, au.email, au.phone, COALESCE(au.created_at, NOW()), NOW(), ''2000-01-01''::DATE, ''other''::user_gender, ''other''::user_orientation, ''dublin''';
  -- Case 3: Only timezone exists
  ELSIF NOT has_city_id AND has_timezone THEN
    insert_cols := 'user_id, email, phone, created_at, updated_at, dob, gender, orientation, timezone';
    insert_vals := 'au.id, au.email, au.phone, COALESCE(au.created_at, NOW()), NOW(), ''2000-01-01''::DATE, ''other''::user_gender, ''other''::user_orientation, ''Europe/Dublin''';
  -- Case 4: Neither exists
  ELSE
    insert_cols := 'user_id, email, phone, created_at, updated_at, dob, gender, orientation';
    insert_vals := 'au.id, au.email, au.phone, COALESCE(au.created_at, NOW()), NOW(), ''2000-01-01''::DATE, ''other''::user_gender, ''other''::user_orientation';
  END IF;

  -- Execute the insert using dynamic SQL
  EXECUTE format(
    'INSERT INTO public.users (%s)
     SELECT %s
     FROM auth.users au
     LEFT JOIN public.users pu ON pu.user_id = au.id
     WHERE pu.user_id IS NULL
     ON CONFLICT (user_id) DO NOTHING',
    insert_cols,
    insert_vals
  );

  RAISE NOTICE 'Backfill completed. Schema detected: city_id=%, timezone=%', has_city_id, has_timezone;
END $$;

-- ============================================================================
-- Verification queries (run separately)
-- ============================================================================

-- Verify which auth.users don't have corresponding public.users rows
SELECT 
  au.id as auth_user_id,
  au.email,
  au.phone,
  au.created_at as auth_created_at
FROM auth.users au
LEFT JOIN public.users pu ON pu.user_id = au.id
WHERE pu.user_id IS NULL
ORDER BY au.created_at;

-- Verify the backfill (overall)
SELECT 
  COUNT(*) as total_auth_users,
  COUNT(pu.user_id) as total_public_users,
  COUNT(*) - COUNT(pu.user_id) as missing_users
FROM auth.users au
LEFT JOIN public.users pu ON pu.user_id = au.id;

-- Verify specific user_id (replace 'YOUR_USER_ID_HERE' with actual UUID)
-- SELECT 
--   au.id as auth_user_id,
--   au.email,
--   pu.user_id as public_user_id,
--   pu.dob,
--   pu.gender,
--   pu.orientation,
--   pu.city_id,
--   pu.timezone
-- FROM auth.users au
-- LEFT JOIN public.users pu ON pu.user_id = au.id
-- WHERE au.id = 'YOUR_USER_ID_HERE';
