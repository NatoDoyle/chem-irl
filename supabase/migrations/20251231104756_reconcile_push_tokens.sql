-- Migration: Reconcile staging - create push_tokens table
-- Created: 2025-12-31
-- Purpose: Create push_tokens table, RLS policies, and grants for staging environment

-- ============================================================================
-- Step 1: Create push_tokens table
-- ============================================================================
-- Use gen_random_uuid() (built-in PostgreSQL 13+, no extension needed)
-- Column name: expo_push_token (matches app code in notifications.ts)
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(expo_push_token)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_enabled ON push_tokens(enabled) WHERE enabled = true;

-- ============================================================================
-- Step 2: Create function to update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_push_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER trigger_update_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_push_tokens_updated_at();

-- ============================================================================
-- Step 3: Enable RLS on push_tokens table
-- ============================================================================
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Step 4: Create RLS Policies (drop if exists to allow re-run)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own push tokens" ON push_tokens;
CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push tokens" ON push_tokens;
CREATE POLICY "Users can insert own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push tokens" ON push_tokens;
CREATE POLICY "Users can update own push tokens" ON push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push tokens" ON push_tokens;
CREATE POLICY "Users can delete own push tokens" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- Step 5: Grant table privileges to authenticated role
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON push_tokens TO authenticated;

