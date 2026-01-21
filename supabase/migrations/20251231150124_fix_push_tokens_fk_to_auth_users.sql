-- Migration: Fix push_tokens FK constraint to reference auth.users
-- Created: 2025-12-31
-- Purpose: Change push_tokens.user_id FK from public.users to auth.users(id)
-- Reason: Users exist in auth.users first; public.users is created by trigger.
--         Push tokens should reference the source of truth (auth.users).

-- ============================================================================
-- Step 1: Drop existing FK constraint
-- ============================================================================
ALTER TABLE push_tokens
DROP CONSTRAINT IF EXISTS push_tokens_user_id_fkey;

-- ============================================================================
-- Step 2: Create new FK constraint referencing auth.users(id)
-- ============================================================================
ALTER TABLE push_tokens
ADD CONSTRAINT push_tokens_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;



