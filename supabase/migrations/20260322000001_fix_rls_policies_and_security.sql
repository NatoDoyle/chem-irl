-- Security Migration: Fix overly permissive RLS policies and SQL precedence bug
--
-- Issues addressed:
-- 1. scores_daily: FOR ALL USING (true) allows any user to read/write any user's scores
-- 2. credits_ledger: FOR ALL USING (true) allows any user to read/write any user's credits
-- 3. matches: FOR INSERT WITH CHECK (true) allows any user to fabricate matches
-- 4. get_discovery_feed(): SQL operator precedence bug in match exclusion clause
-- 5. SECURITY DEFINER functions lack auth.uid() checks (from db/security_fixes.sql)

BEGIN;

-- ============================================================================
-- 1. Fix scores_daily RLS policies
-- ============================================================================
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can manage scores" ON scores_daily;

-- Keep the existing SELECT policy (users can view own scores) -- already exists
-- Add restricted INSERT/UPDATE for service_role only (system/cron jobs)
-- Users should never directly write to scores_daily; all writes go through RPCs
-- The RPCs already have auth.uid() checks via security_fixes.sql

-- ============================================================================
-- 2. Fix credits_ledger RLS policies
-- ============================================================================
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can manage credits" ON credits_ledger;

-- Keep the existing SELECT policy (users can view own credits) -- already exists
-- Credit writes should only happen through RPCs or service_role edge functions

-- ============================================================================
-- 3. Fix matches INSERT policy
-- ============================================================================
-- Drop the overly permissive insert policy
DROP POLICY IF EXISTS "System can insert matches" ON matches;

-- Match creation should only happen via create_like_and_check_match() RPC
-- which is SECURITY DEFINER and bypasses RLS. No direct INSERT needed.

-- Also add UPDATE policy for matches (needed for status changes via RPCs)
-- Users can update matches they are part of
CREATE POLICY "Users can update own matches" ON matches
  FOR UPDATE USING (auth.uid() = user_a OR auth.uid() = user_b);

-- ============================================================================
-- 4. Fix SQL operator precedence bug in get_discovery_feed()
-- Also applies auth.uid() check from security_fixes.sql
-- ============================================================================
CREATE OR REPLACE FUNCTION get_discovery_feed(p_viewer UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  headline TEXT,
  bio TEXT,
  availability_summary TEXT,
  action_speed INTEGER,
  profile_quality INTEGER,
  reliability INTEGER
)
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE(p.prompts ->> 'headline', '') AS headline,
    COALESCE(p.prompts ->> 'bio', '') AS bio,
    COALESCE(p.availability ->> 'summary', '') AS availability_summary,
    COALESCE(s.action_speed, 50) AS action_speed,
    COALESCE(s.profile_quality, 50) AS profile_quality,
    COALESCE(s.reliability, 70) AS reliability
  FROM profiles p
  LEFT JOIN scores_daily s ON s.user_id = p.id AND s.day = CURRENT_DATE
  WHERE p.id <> p_viewer
    AND p.completion_pct >= 80
    AND auth.uid() = p_viewer  -- SECURITY: Enforce caller identity
    -- Exclude users already liked
    AND NOT EXISTS (
      SELECT 1 FROM likes l
      WHERE l.liker_id = p_viewer AND l.likee_id = p.id
    )
    -- Exclude users already matched (FIXED: added parentheses around OR)
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE ((m.user_a = p_viewer AND m.user_b = p.id)
         OR (m.user_a = p.id AND m.user_b = p_viewer))
        AND m.status = 'open'
    )
  ORDER BY
    COALESCE(s.action_speed, 50) DESC,
    COALESCE(s.profile_quality, 50) DESC,
    COALESCE(s.reliability, 70) DESC,
    p.updated_at DESC
  LIMIT p_limit;
$$;

-- ============================================================================
-- 5. Apply auth.uid() checks to remaining SECURITY DEFINER functions
-- ============================================================================

-- get_user_matches: caller must be the user whose matches are queried
CREATE OR REPLACE FUNCTION get_user_matches(user_uuid UUID)
RETURNS TABLE(match_id UUID, other_user_id UUID, other_user_email TEXT, created_at TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.match_id,
    CASE
      WHEN m.user_a = user_uuid THEN m.user_b
      ELSE m.user_a
    END as other_user_id,
    CASE
      WHEN m.user_a = user_uuid THEN u_b.email
      ELSE u_a.email
    END as other_user_email,
    m.created_at
  FROM matches m
  LEFT JOIN users u_a ON m.user_a = u_a.user_id
  LEFT JOIN users u_b ON m.user_b = u_b.user_id
  WHERE (m.user_a = user_uuid OR m.user_b = user_uuid)
    AND m.status = 'open'
    AND auth.uid() = user_uuid;  -- SECURITY: Enforce caller identity
$$;

-- are_users_matched: caller must be one of the two users
CREATE OR REPLACE FUNCTION are_users_matched(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM matches
    WHERE ((user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1))
      AND status = 'open'
      AND (auth.uid() = $1 OR auth.uid() = $2)  -- SECURITY: Caller must be one of the users
  );
$$;

-- get_user_action_speed: caller must be the user
CREATE OR REPLACE FUNCTION get_user_action_speed(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != user_uuid THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  RETURN COALESCE(
    (SELECT action_speed FROM scores_daily
     WHERE user_id = user_uuid
     ORDER BY day DESC LIMIT 1),
    50
  );
END;
$$;

-- create_like_and_check_match: caller must be the liker
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
    ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'open'
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

-- apply_action_speed_bonus: caller must be the user
CREATE OR REPLACE FUNCTION apply_action_speed_bonus(
  p_user_id UUID,
  p_bonus INTEGER,
  p_event_type TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_current_score INTEGER;
  v_new_score INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  SELECT action_speed INTO v_current_score
  FROM scores_daily
  WHERE user_id = p_user_id AND day = v_today;

  IF v_current_score IS NULL THEN
    SELECT COALESCE(
      (SELECT action_speed FROM scores_daily
       WHERE user_id = p_user_id
       ORDER BY day DESC LIMIT 1),
      50
    ) INTO v_current_score;

    INSERT INTO scores_daily (user_id, day, action_speed, profile_quality, reliability, report_risk)
    VALUES (
      p_user_id,
      v_today,
      v_current_score,
      COALESCE((SELECT profile_quality FROM scores_daily WHERE user_id = p_user_id ORDER BY day DESC LIMIT 1), 50),
      COALESCE((SELECT reliability FROM scores_daily WHERE user_id = p_user_id ORDER BY day DESC LIMIT 1), 70),
      COALESCE((SELECT report_risk FROM scores_daily WHERE user_id = p_user_id ORDER BY day DESC LIMIT 1), 0)
    )
    ON CONFLICT (user_id, day) DO NOTHING;
  END IF;

  v_new_score := LEAST(100, GREATEST(0, v_current_score + p_bonus));

  UPDATE scores_daily
  SET action_speed = v_new_score
  WHERE user_id = p_user_id AND day = v_today;

  RETURN v_new_score;
END;
$$;

-- get_user_credits: caller must be the user
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  RETURN (
    SELECT COALESCE(SUM(delta), 0)::INTEGER
    FROM credits_ledger
    WHERE user_id = p_user_id
  );
END;
$$;

-- Notify PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
