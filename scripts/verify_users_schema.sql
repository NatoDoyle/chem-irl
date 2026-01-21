-- Verify public.users schema and policies
-- Run this in Supabase SQL editor

-- 1. Check column definitions
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('user_id', 'email', 'phone', 'dob', 'gender', 'orientation', 'city_id', 'timezone')
ORDER BY ordinal_position;

-- 2. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'users'
ORDER BY policyname;
