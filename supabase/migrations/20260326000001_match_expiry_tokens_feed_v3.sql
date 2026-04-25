-- ============================================================================
-- Migration: Match expiry, tokens, and discovery feed v3
-- Created:   2026-03-26
-- ============================================================================

-- ============================================================================
-- STEP 1: Add expires_at to matches table
-- ============================================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
UPDATE matches SET expires_at = created_at + INTERVAL '72 hours' WHERE expires_at IS NULL;
ALTER TABLE matches ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '72 hours');

-- ============================================================================
-- STEP 2: Create tokens table + transactions audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY tokens_select ON tokens FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY token_tx_select ON token_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_token_tx_user ON token_transactions(user_id, created_at DESC);

-- ============================================================================
-- STEP 3: expire_matches() function
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_matches()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE matches
  SET status = 'expired'
  WHERE status = 'open'
    AND expires_at < NOW();
END;
$$;

-- ============================================================================
-- STEP 4: reactivate_match() RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION reactivate_match(p_match_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_match RECORD;
  v_balance INTEGER;
BEGIN
  SELECT * INTO v_match FROM matches
  WHERE match_id = p_match_id
    AND status = 'expired'
    AND (user_a = v_user_id OR user_b = v_user_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found or not expired');
  END IF;

  SELECT balance INTO v_balance FROM tokens WHERE user_id = v_user_id;
  IF v_balance IS NULL OR v_balance < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient tokens');
  END IF;

  UPDATE tokens SET balance = balance - 1, updated_at = NOW() WHERE user_id = v_user_id;
  INSERT INTO token_transactions (user_id, amount, reason, reference_id)
  VALUES (v_user_id, -1, 'reactivate_match', p_match_id::TEXT);

  UPDATE matches SET status = 'open', expires_at = NOW() + INTERVAL '72 hours'
  WHERE match_id = p_match_id;

  RETURN jsonb_build_object('success', true, 'new_expires_at', (NOW() + INTERVAL '72 hours')::TEXT);
END;
$$;

-- ============================================================================
-- STEP 5: get_discovery_feed_v3() — replaces headline with full_name
-- ============================================================================

CREATE OR REPLACE FUNCTION get_discovery_feed_v3(p_viewer UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  bio TEXT,
  availability_summary TEXT,
  action_speed INTEGER,
  attractiveness INTEGER,
  reliability INTEGER,
  composite_score NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result RECORD;
BEGIN
  FOR v_result IN
    SELECT
      p.user_id,
      COALESCE(p.full_name, '') AS full_name,
      COALESCE(p.prompts ->> 'bio', '') AS bio,
      COALESCE(p.availability ->> 'summary', '') AS availability_summary,
      COALESCE(s.action_speed, 50) AS action_speed,
      COALESCE(s.profile_quality, 50) AS attractiveness,
      COALESCE(s.reliability, 70) AS reliability,
      (0.60 * COALESCE(s.action_speed, 50)
       + 0.30 * COALESCE(s.profile_quality, 50)
       + 0.10 * COALESCE(s.reliability, 70))::NUMERIC AS composite_score
    FROM profiles p
    LEFT JOIN scores_daily s ON s.user_id = p.user_id AND s.day = CURRENT_DATE
    WHERE p.user_id <> p_viewer
      AND p.completion_pct >= 80
      AND NOT EXISTS (
        SELECT 1 FROM likes l WHERE l.liker_id = p_viewer AND l.likee_id = p.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE ((m.user_a = p_viewer AND m.user_b = p.user_id)
            OR (m.user_a = p.user_id AND m.user_b = p_viewer))
          AND m.status = 'open'
      )
    ORDER BY composite_score DESC, p.updated_at DESC
    LIMIT p_limit
  LOOP
    -- Emit feed impression for each returned profile
    INSERT INTO scoring_events (user_id, event_type, payload)
    VALUES (v_result.user_id, 'feed_impression', jsonb_build_object('viewer_id', p_viewer));

    user_id := v_result.user_id;
    full_name := v_result.full_name;
    bio := v_result.bio;
    availability_summary := v_result.availability_summary;
    action_speed := v_result.action_speed;
    attractiveness := v_result.attractiveness;
    reliability := v_result.reliability;
    composite_score := v_result.composite_score;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 6: Cron schedule for match expiry
-- ============================================================================

SELECT cron.schedule('expire-matches-hourly', '0 * * * *', 'SELECT expire_matches()');

-- ============================================================================
-- STEP 7: Notify PostgREST to reload schema cache
-- ============================================================================

SELECT pg_notify('pgrst', 'reload schema');
