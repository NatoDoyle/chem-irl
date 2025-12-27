-- Push Notifications Infrastructure
-- This migration creates the push_tokens table for storing Expo push tokens
-- and enables push notification support for matches, messages, and proposals.

-- ============================================================================
-- Step 1: Create push_tokens table
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- RLS Policies for push_tokens
-- Users can manage only their own push tokens
CREATE POLICY "Users can view own push tokens" ON push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push tokens" ON push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push tokens" ON push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own push tokens" ON push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can access all tokens for push notifications (used by edge function)
-- This is handled via service role key, not RLS policy

