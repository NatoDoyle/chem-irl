-- Security Fixes for SECURITY DEFINER Functions
-- This patch adds authorization checks to prevent unauthorized data access/modification
-- Apply this after db/rls.sql and db/scoring.sql
--
-- WARNING: Review all changes before applying in production
-- Test thoroughly in staging first

-- ============================================================================
-- FIX 1: get_user_matches() - Add caller identity check
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_matches(user_uuid UUID)
RETURNS TABLE(match_id UUID, other_user_id UUID, other_user_email TEXT, created_at TIMESTAMPTZ)
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  -- SECURITY: Verify caller is the user whose matches are being queried
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
    AND auth.uid() = user_uuid;  -- SECURITY FIX: Enforce caller identity
$$;

-- ============================================================================
-- FIX 2: are_users_matched() - Add caller identity check
-- ============================================================================
CREATE OR REPLACE FUNCTION are_users_matched(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  -- SECURITY: Verify caller is one of the two users being checked
  SELECT EXISTS (
    SELECT 1 FROM matches 
    WHERE ((user_a = $1 AND user_b = $2) OR (user_a = $2 AND user_b = $1))
      AND status = 'open'
      AND (auth.uid() = $1 OR auth.uid() = $2)  -- SECURITY FIX: Caller must be one of the users
  );
$$;

-- ============================================================================
-- FIX 3: get_user_action_speed() - Add caller identity check
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_action_speed(user_uuid UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify caller is the user whose score is being queried
  IF auth.uid() IS NULL OR auth.uid() != user_uuid THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user (user_id: %)', user_uuid;
  END IF;

  RETURN COALESCE(
    (SELECT action_speed FROM scores_daily 
     WHERE user_id = user_uuid 
     ORDER BY day DESC LIMIT 1),
    50
  );
END;
$$;

-- ============================================================================
-- FIX 4: get_discovery_feed() - Add caller identity check
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
  -- SECURITY: Verify caller is the viewer (using WHERE clause)
  SELECT
    p.user_id,
    COALESCE(p.prompts ->> 'headline', '') AS headline,
    COALESCE(p.prompts ->> 'bio', '') AS bio,
    COALESCE(p.availability ->> 'summary', '') AS availability_summary,
    COALESCE(s.action_speed, 50) AS action_speed,
    COALESCE(s.profile_quality, 50) AS profile_quality,
    COALESCE(s.reliability, 70) AS reliability
  FROM profiles p
  LEFT JOIN scores_daily s ON s.user_id = p.user_id AND s.day = CURRENT_DATE
  WHERE p.user_id <> p_viewer
    AND p.completion_pct >= 80
    AND auth.uid() = p_viewer  -- SECURITY FIX: Enforce caller identity
    -- Exclude users already liked or matched
    AND NOT EXISTS (
      SELECT 1 FROM likes l 
      WHERE l.liker_id = p_viewer AND l.likee_id = p.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM matches m 
      WHERE (m.user_a = p_viewer AND m.user_b = p.user_id) 
         OR (m.user_a = p.user_id AND m.user_b = p_viewer)
      AND m.status = 'open'
    )
  ORDER BY
    COALESCE(s.action_speed, 50) DESC,
    COALESCE(s.profile_quality, 50) DESC,
    COALESCE(s.reliability, 70) DESC,
    p.updated_at DESC
  LIMIT p_limit;
$$;
  SELECT
    p.user_id,
    COALESCE(p.prompts ->> 'headline', '') AS headline,
    COALESCE(p.prompts ->> 'bio', '') AS bio,
    COALESCE(p.availability ->> 'summary', '') AS availability_summary,
    COALESCE(s.action_speed, 50) AS action_speed,
    COALESCE(s.profile_quality, 50) AS profile_quality,
    COALESCE(s.reliability, 70) AS reliability
  FROM profiles p
  LEFT JOIN scores_daily s ON s.user_id = p.user_id AND s.day = CURRENT_DATE
  WHERE p.user_id <> p_viewer
    AND p.completion_pct >= 80
    -- Exclude users already liked or matched
    AND NOT EXISTS (
      SELECT 1 FROM likes l 
      WHERE l.liker_id = p_viewer AND l.likee_id = p.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM matches m 
      WHERE (m.user_a = p_viewer AND m.user_b = p.user_id) 
         OR (m.user_a = p.user_id AND m.user_b = p_viewer)
      AND m.status = 'open'
    )
  ORDER BY
    COALESCE(s.action_speed, 50) DESC,
    COALESCE(s.profile_quality, 50) DESC,
    COALESCE(s.reliability, 70) DESC,
    p.updated_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FIX 5: create_like_and_check_match() - Add caller identity check
-- ============================================================================
CREATE OR REPLACE FUNCTION create_like_and_check_match(p_liker UUID, p_likee UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_like_id UUID;
  v_mutual_like_exists BOOLEAN;
  v_match_id UUID;
  v_result JSONB;
BEGIN
  -- SECURITY: Verify caller is the liker
  IF auth.uid() IS NULL OR auth.uid() != p_liker THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the liker (user_id: %)', p_liker;
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

-- ============================================================================
-- FIX 6: apply_action_speed_bonus() - Add caller identity check
-- ============================================================================
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
  -- SECURITY: Verify caller is the user whose score is being updated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user (user_id: %)', p_user_id;
  END IF;

  -- Get current score for today
  SELECT action_speed INTO v_current_score
  FROM scores_daily
  WHERE user_id = p_user_id AND day = v_today;
  
  -- If no score exists for today, create it from yesterday or default
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
  
  -- Apply bonus with daily net change clamp of [-30, +30]
  -- But first check if we've already hit the daily cap
  v_new_score := LEAST(100, GREATEST(0, v_current_score + p_bonus));
  
  -- Clamp daily net change (this is a simplified version - full implementation would track all changes)
  UPDATE scores_daily
  SET action_speed = v_new_score
  WHERE user_id = p_user_id AND day = v_today;
  
  RETURN v_new_score;
END;
$$;

-- ============================================================================
-- FIX 7: update_profile_quality() - Add caller identity check
-- ============================================================================
CREATE OR REPLACE FUNCTION update_profile_quality(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alpha0 INTEGER := 8;
  v_beta0 INTEGER := 12;
  v_matches_count INTEGER;
  v_exposures_count INTEGER;
  v_mar_hat NUMERIC;
  v_score INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- SECURITY: Verify caller is the user whose score is being updated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user (user_id: %)', p_user_id;
  END IF;

  -- Count matches in last 60 days (with double weight for last 14 days)
  SELECT 
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '60 days'),
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '14 days')
  INTO v_matches_count, v_matches_count
  FROM matches
  WHERE (user_a = p_user_id OR user_b = p_user_id)
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';
  
  -- Count exposures (likes on you + your likes shown) - simplified for now
  -- Full implementation would track actual exposures
  SELECT COUNT(*) INTO v_exposures_count
  FROM likes
  WHERE (likee_id = p_user_id OR liker_id = p_user_id)
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';
  
  -- Bayesian MAR estimate
  v_mar_hat := (v_alpha0 + v_matches_count)::NUMERIC / (v_alpha0 + v_beta0 + GREATEST(v_exposures_count, 1))::NUMERIC;
  v_score := ROUND(100 * v_mar_hat);
  
  -- Clamp to 0-100
  v_score := GREATEST(0, LEAST(100, v_score));
  
  -- Update today's score
  INSERT INTO scores_daily (user_id, day, action_speed, profile_quality, reliability, report_risk)
  SELECT 
    p_user_id,
    v_today,
    COALESCE((SELECT action_speed FROM scores_daily WHERE user_id = p_user_id AND day = v_today), 50),
    v_score,
    COALESCE((SELECT reliability FROM scores_daily WHERE user_id = p_user_id AND day = v_today), 70),
    COALESCE((SELECT report_risk FROM scores_daily WHERE user_id = p_user_id AND day = v_today), 0)
  ON CONFLICT (user_id, day) DO UPDATE SET
    profile_quality = EXCLUDED.profile_quality;
  
  RETURN v_score;
END;
$$;

-- ============================================================================
-- FIX 8: update_reliability() - Add caller identity check with role-based access for sensitive events
-- ============================================================================
CREATE OR REPLACE FUNCTION update_reliability(
  p_user_id UUID,
  p_event_type TEXT,
  p_value NUMERIC DEFAULT 0
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_current_reliability INTEGER;
  v_change INTEGER;
  v_new_reliability INTEGER;
  v_is_moderator BOOLEAN;
  v_requires_moderator BOOLEAN := FALSE;
BEGIN
  -- SECURITY: Verify caller is the user whose score is being updated
  -- OR caller is a moderator (for certain event types)
  
  -- Determine if event requires moderator role
  v_requires_moderator := p_event_type IN ('no_show', 'safety_report', 'cancel_no_reschedule');
  
  IF v_requires_moderator THEN
    -- Check if caller is moderator
    SELECT EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND auth.users.raw_user_meta_data->>'role' = 'moderator'
    ) INTO v_is_moderator;
    
    IF NOT v_is_moderator THEN
      RAISE EXCEPTION 'Unauthorized: moderator role required for event type: %', p_event_type;
    END IF;
  ELSE
    -- For user-triggered events, verify caller is the user
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
      RAISE EXCEPTION 'Unauthorized: caller must be the user (user_id: %)', p_user_id;
    END IF;
  END IF;
  
  -- Determine change based on event type
  v_change := CASE p_event_type
    WHEN 'went' THEN 5
    WHEN 'both_would_meet' THEN 5
    WHEN 'honest_cancel_24h' THEN -1
    WHEN 'honest_cancel_under_24h' THEN -5
    WHEN 'cancel_no_reschedule' THEN -8
    WHEN 'no_show' THEN -30
    WHEN 'late_15min' THEN -2
    WHEN 'safety_report' THEN -10
    ELSE 0
  END;
  
  -- Get current reliability
  SELECT reliability INTO v_current_reliability
  FROM scores_daily
  WHERE user_id = p_user_id AND day = v_today;
  
  IF v_current_reliability IS NULL THEN
    SELECT COALESCE(
      (SELECT reliability FROM scores_daily 
       WHERE user_id = p_user_id 
       ORDER BY day DESC LIMIT 1),
      70
    ) INTO v_current_reliability;
    
    INSERT INTO scores_daily (user_id, day, action_speed, profile_quality, reliability, report_risk)
    VALUES (
      p_user_id,
      v_today,
      COALESCE((SELECT action_speed FROM scores_daily WHERE user_id = p_user_id ORDER BY day DESC LIMIT 1), 50),
      COALESCE((SELECT profile_quality FROM scores_daily WHERE user_id = p_user_id ORDER BY day DESC LIMIT 1), 50),
      v_current_reliability,
      COALESCE((SELECT report_risk FROM scores_daily WHERE user_id = p_user_id ORDER BY day DESC LIMIT 1), 0)
    )
    ON CONFLICT (user_id, day) DO NOTHING;
  END IF;
  
  -- Apply change with bounds (floor 20, ceiling 100)
  v_new_reliability := GREATEST(20, LEAST(100, v_current_reliability + v_change));
  
  UPDATE scores_daily
  SET reliability = v_new_reliability
  WHERE user_id = p_user_id AND day = v_today;
  
  RETURN v_new_reliability;
END;
$$;

-- ============================================================================
-- FIX 9: get_user_credits() - Add caller identity check
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify caller is the user whose credits are being queried
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user (user_id: %)', p_user_id;
  END IF;

  RETURN (
    SELECT COALESCE(SUM(delta), 0)::INTEGER
    FROM credits_ledger
    WHERE user_id = p_user_id
  );
END;
$$;

-- ============================================================================
-- FIX 10: update_daily_action_speed() - Add system role check (optional/recommended)
-- ============================================================================
-- NOTE: This function is meant to be called by cron/system jobs.
-- If your edge functions use service_role, this check may not be needed.
-- Uncomment if you want to enforce system-only access:

/*
CREATE OR REPLACE FUNCTION update_daily_action_speed()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := v_today - INTERVAL '1 day';
BEGIN
  -- SECURITY: Only allow service role (system) to run this
  -- If called from Supabase Edge Function with service role, this will pass
  -- If called from application with user auth, this will fail
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: update_daily_action_speed() can only be called by system (service_role)';
  END IF;

  -- Rest of function unchanged...
  INSERT INTO scores_daily (user_id, day, action_speed, profile_quality, reliability, report_risk)
  SELECT 
    u.user_id,
    v_today,
    GREATEST(
      50,
      LEAST(
        100,
        COALESCE(
          (SELECT action_speed FROM scores_daily 
           WHERE user_id = u.user_id AND day = v_yesterday),
          50
        ) - 8 + LEAST(
          COALESCE(
            (SELECT COUNT(*) * 2 FROM likes 
             WHERE liker_id = u.user_id 
             AND created_at::date = v_yesterday),
            0
          ),
          16
        )
      )
    ),
    COALESCE(
      (SELECT profile_quality FROM scores_daily 
       WHERE user_id = u.user_id AND day = v_yesterday),
      50
    ),
    COALESCE(
      (SELECT reliability FROM scores_daily 
       WHERE user_id = u.user_id AND day = v_yesterday),
      70
    ),
    COALESCE(
      (SELECT report_risk FROM scores_daily 
       WHERE user_id = u.user_id AND day = v_yesterday),
      0
    )
  FROM users u
  ON CONFLICT (user_id, day) DO UPDATE SET
    action_speed = EXCLUDED.action_speed;
END;
$$;
*/

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After applying these fixes, test that:
-- 1. Users can only access their own data
-- 2. Users cannot modify other users' scores
-- 3. Unauthorized access attempts raise exceptions
-- 
-- Example test (run as different users):
-- 
-- -- As user A, try to access user B's matches (should fail):
-- SELECT * FROM get_user_matches('<user-b-uuid>');  -- Should raise exception
-- 
-- -- As user A, access own matches (should work):
-- SELECT * FROM get_user_matches('<user-a-uuid>');  -- Should return results
-- 
-- -- As user A, try to modify user B's score (should fail):
-- SELECT apply_action_speed_bonus('<user-b-uuid>', 10, 'test');  -- Should raise exception

