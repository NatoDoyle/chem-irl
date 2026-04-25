-- ============================================================================
-- Match Expiration: 72-hour countdown timer with auto-expire and reopen
-- ============================================================================
-- Adds expires_at column to matches, a cron job to expire stale matches,
-- and a reopen_match() RPC for users to reopen expired matches.

BEGIN;

-- ============================================================================
-- 1. Add expires_at column to matches
-- ============================================================================

ALTER TABLE matches ADD COLUMN expires_at TIMESTAMPTZ;

-- Backfill existing rows
UPDATE matches SET expires_at = created_at + INTERVAL '72 hours' WHERE expires_at IS NULL;

-- Add NOT NULL constraint and default after backfill
ALTER TABLE matches ALTER COLUMN expires_at SET NOT NULL;
ALTER TABLE matches ALTER COLUMN expires_at SET DEFAULT NOW() + INTERVAL '72 hours';

-- Partial index for cron job efficiency (only scans open matches)
CREATE INDEX idx_matches_expires_at ON matches(expires_at) WHERE status = 'open';

-- ============================================================================
-- 2. Update create_like_and_check_match to set expires_at on conflict
-- ============================================================================
-- The ON CONFLICT clause must also reset expires_at when re-opening a match.
-- Full function body repeated because CREATE OR REPLACE requires it.

CREATE OR REPLACE FUNCTION create_like_and_check_match(p_liker UUID, p_likee UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_like_id UUID;
  v_mutual_like_exists BOOLEAN;
  v_match_id UUID;
BEGIN
  -- SECURITY: Verify caller is the liker
  IF auth.uid() IS NULL OR auth.uid() != p_liker THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the liker';
  END IF;

  -- Prevent self-likes
  IF p_liker = p_likee THEN
    RAISE EXCEPTION 'Invalid: cannot like yourself';
  END IF;

  -- Insert like (ignore if duplicate due to UNIQUE constraint)
  INSERT INTO likes (liker_id, likee_id)
  VALUES (p_liker, p_likee)
  ON CONFLICT (liker_id, likee_id) DO NOTHING
  RETURNING like_id INTO v_like_id;

  -- If no like was inserted (duplicate), return existing state
  IF v_like_id IS NULL THEN
    SELECT like_id INTO v_like_id FROM likes WHERE liker_id = p_liker AND likee_id = p_likee;
    SELECT EXISTS (
      SELECT 1 FROM matches
      WHERE ((user_a = p_liker AND user_b = p_likee) OR (user_a = p_likee AND user_b = p_liker))
        AND status = 'open'
    ) INTO v_mutual_like_exists;

    RETURN jsonb_build_object(
      'like_id', v_like_id,
      'matched', v_mutual_like_exists,
      'match_id', NULL
    );
  END IF;

  -- Check for mutual like
  SELECT EXISTS (
    SELECT 1 FROM likes
    WHERE liker_id = p_likee AND likee_id = p_liker
  ) INTO v_mutual_like_exists;

  -- If mutual like, create match
  IF v_mutual_like_exists THEN
    INSERT INTO matches (user_a, user_b, status)
    VALUES (
      LEAST(p_liker, p_likee),
      GREATEST(p_liker, p_likee),
      'open'
    )
    ON CONFLICT (user_a, user_b) DO UPDATE SET
      status = 'open',
      expires_at = NOW() + INTERVAL '72 hours'
    RETURNING match_id INTO v_match_id;

    RETURN jsonb_build_object(
      'like_id', v_like_id,
      'matched', true,
      'match_id', v_match_id
    );
  END IF;

  -- No match yet
  RETURN jsonb_build_object(
    'like_id', v_like_id,
    'matched', false,
    'match_id', NULL
  );
END;
$$;

-- ============================================================================
-- 3. expire_matches() function (follows expire_proposals() pattern)
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_matches()
RETURNS TABLE(
  expired_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  WITH expiring AS (
    UPDATE matches
    SET status = 'expired'
    WHERE expires_at < NOW()
      AND status = 'open'
    RETURNING match_id, user_a, user_b
  ),
  emit_events_a AS (
    INSERT INTO scoring_events (user_id, event_type, payload)
    SELECT user_a, 'match_expired',
      jsonb_build_object('match_id', match_id)
    FROM expiring
  ),
  emit_events_b AS (
    INSERT INTO scoring_events (user_id, event_type, payload)
    SELECT user_b, 'match_expired',
      jsonb_build_object('match_id', match_id)
    FROM expiring
  )
  SELECT COUNT(*) INTO v_expired_count FROM expiring;

  RETURN QUERY SELECT
    v_expired_count,
    format('Expired %s match(es)', v_expired_count)::TEXT;
END;
$$;

-- ============================================================================
-- 4. reopen_match() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION reopen_match(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_new_expires_at TIMESTAMPTZ;
BEGIN
  -- Fetch the match
  SELECT * INTO v_match FROM matches WHERE match_id = p_match_id;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- SECURITY: Verify caller is a participant
  IF auth.uid() IS NULL OR (auth.uid() != v_match.user_a AND auth.uid() != v_match.user_b) THEN
    RAISE EXCEPTION 'Unauthorized: caller must be a match participant';
  END IF;

  -- Only expired matches can be reopened
  IF v_match.status != 'expired' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not expired');
  END IF;

  v_new_expires_at := NOW() + INTERVAL '72 hours';

  UPDATE matches
  SET status = 'open',
      expires_at = v_new_expires_at
  WHERE match_id = p_match_id;

  -- Emit scoring event for the user who reopened
  INSERT INTO scoring_events (user_id, event_type, payload)
  VALUES (auth.uid(), 'match_reopened',
    jsonb_build_object('match_id', p_match_id));

  RETURN jsonb_build_object('success', true, 'expires_at', v_new_expires_at);
END;
$$;

-- ============================================================================
-- 5. Schedule hourly cron job for match expiry
-- ============================================================================
-- Requires pg_cron extension. Enable via Supabase Dashboard > Database > Extensions
-- if not already enabled, then run:
--   SELECT cron.schedule('expire_matches_hourly', '0 * * * *', $$SELECT expire_matches();$$);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire_matches_hourly',
      '0 * * * *',
      'SELECT expire_matches();'
    );
  END IF;
END;
$$;

-- ============================================================================
-- 6. Update profiles RLS policy to include expired matches
-- ============================================================================
-- Users need to see profiles of expired matches for the expired section and reopen.

DROP POLICY IF EXISTS "Users can view own and matched profiles" ON profiles;

CREATE POLICY "Users can view own and matched profiles"
  ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.status IN ('open', 'expired')
      AND (
        (matches.user_a = auth.uid() AND matches.user_b = profiles.id)
        OR (matches.user_b = auth.uid() AND matches.user_a = profiles.id)
      )
    )
  );

-- ============================================================================
-- 7. Notify PostgREST to reload schema cache (new RPCs)
-- ============================================================================

SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
