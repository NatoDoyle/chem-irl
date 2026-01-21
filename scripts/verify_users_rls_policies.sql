-- Verify public.users RLS policies
-- Run this in Supabase SQL editor

-- Check all RLS policies on public.users
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
ORDER BY policyname, cmd;

-- Expected results:
-- 1. "Users can view own profile" - FOR SELECT - USING (auth.uid() = user_id)
-- 2. "Users can update own profile" - FOR UPDATE - USING (auth.uid() = user_id)
-- 3. NO INSERT policy (users cannot insert their own row - trigger handles creation)

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'users';

-- Expected: rowsecurity = true
