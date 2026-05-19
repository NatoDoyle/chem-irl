-- Codifies the read_receipts feature originally applied via Dashboard on
-- 2026-01-21 (see docs/SUPABASE_MIGRATION_DRIFT_2026-04-27.md). Source SQL
-- lived only in db/read_receipts.sql; this migration makes
-- supabase/migrations/ the single source of truth.
--
-- All statements are idempotent: safe to apply against a database that
-- already has the column/index/function (the originally-applied state) and
-- safe to apply against a fresh database.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_read_at
  ON messages(read_at) WHERE read_at IS NOT NULL;

CREATE OR REPLACE FUNCTION mark_messages_read(p_match_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_updated_count INTEGER;
BEGIN
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: must be authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM matches
    WHERE match_id = p_match_id
      AND (user_a = v_current_user_id OR user_b = v_current_user_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: user is not part of this match';
  END IF;

  UPDATE messages
  SET read_at = NOW()
  WHERE match_id = p_match_id
    AND sender_id != v_current_user_id
    AND read_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_messages_read(UUID) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
