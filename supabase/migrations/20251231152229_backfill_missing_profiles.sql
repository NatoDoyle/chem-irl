-- Migration: Backfill missing profiles for existing auth users
-- Created: 2025-12-31
-- Purpose: Create public.profiles rows for any auth.users that don't have one
-- This fixes users created before the trigger was added or if trigger failed
-- Note: After profiles FK is changed to auth.users(id), we can backfill directly from auth.users

-- Backfill profiles for any auth users missing one
INSERT INTO public.profiles (
  user_id,
  created_at,
  updated_at,
  completion_pct,
  signup_completed,
  prompts,
  availability,
  photos
)
SELECT
  au.id,
  NOW(),
  NOW(),
  0,
  false,
  '{}'::JSONB,
  '{}'::JSONB,
  '[]'::JSONB
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

