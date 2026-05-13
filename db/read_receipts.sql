-- SUPERSEDED: this RPC and its supporting column/index are now codified in
-- supabase/migrations/20260513155500_codify_mark_messages_read.sql.
-- Kept here for historical reference only; do not edit.

-- Read Receipts Feature
-- Adds read_at column to messages table and RPC function to mark messages as read

-- ============================================================================
-- Step 1: Add read_at column to messages table
-- ============================================================================
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON messages(read_at) WHERE read_at IS NOT NULL;

-- ============================================================================
-- Step 2: Create RPC function to mark messages as read
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_messages_read(p_match_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_updated_count INTEGER;
BEGIN
  -- Get current authenticated user
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be authenticated';
  END IF;

  -- Verify user is part of the match
  IF NOT EXISTS (
    SELECT 1
    FROM matches
    WHERE match_id = p_match_id
      AND (user_a = v_current_user_id OR user_b = v_current_user_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: user is not part of this match';
  END IF;

  -- Update read_at for all unread messages where current user is the recipient
  -- (messages where sender_id != current_user_id and read_at is NULL)
  UPDATE messages
  SET read_at = NOW()
  WHERE match_id = p_match_id
    AND sender_id != v_current_user_id
    AND read_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_messages_read(UUID) TO authenticated;


