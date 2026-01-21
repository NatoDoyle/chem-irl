-- Migration: Add RLS policies for storage.objects in profiles bucket
-- Created: 2025-12-31
-- Purpose: Allow authenticated users to manage their own objects in the profiles bucket
-- Enforces path prefix: split_part(name, '/', 1) = auth.uid()::text
-- Note: RLS on storage.objects is managed by Supabase and is typically already enabled

-- ============================================================================
-- Step 1: Drop existing policies for profiles bucket (if any)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can insert own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;

-- ============================================================================
-- Step 3: Create RLS policies for profiles bucket
-- ============================================================================
-- SELECT: Users can view their own photos (path starts with their user_id)
CREATE POLICY "Users can view own profile photos" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- INSERT: Users can upload photos to their own folder
CREATE POLICY "Users can insert own profile photos" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- UPDATE: Users can update their own photos
CREATE POLICY "Users can update own profile photos" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- DELETE: Users can delete their own photos
CREATE POLICY "Users can delete own profile photos" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profiles'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- ============================================================================
-- Verification SQL (run after migration):
-- ============================================================================
-- SELECT bucket_id, name, owner, created_at
-- FROM storage.objects
-- WHERE bucket_id='profiles'
-- ORDER BY created_at DESC
-- LIMIT 20;
-- Expected: All objects have name starting with user_id (e.g., '883e2e84-8977-4c93-8a48-4bf4732fd37f/1234567890.jpg')

