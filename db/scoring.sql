-- Scoring Engine Functions for Chem IRL
-- Implements Action Speed, Profile Quality, and Reliability scoring
--
-- ⚠️ REFERENCE ONLY — deployed scoring functions live in supabase/migrations/.
-- This file is a design snapshot and may lag what's applied.
--
-- DEPRECATED (v1): Functions below (update_daily_action_speed, apply_action_speed_bonus,
-- get_proposal_response_bonus, get_first_proposal_bonus, update_profile_quality,
-- update_reliability) are superseded by the event-sourced scoring v2 system.
-- New system: scoring_events table + compute_user_scores() + materialize_scores().
-- Kept as fallback until v2 is validated in production.

-- [DEPRECATED v1] Function to update Action Speed based on daily engine
CREATE OR REPLACE FUNCTION update_daily_action_speed()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_yesterday DATE := v_today - INTERVAL '1 day';
BEGIN
  -- For each user, apply daily engine:
  -- Base: -8/day (but floor at 50)
  -- Then add likes from yesterday: +2 per like, capped at +16/day
  
  INSERT INTO scores_daily (user_id, day, action_speed, profile_quality, reliability, report_risk)
  SELECT 
    u.user_id,
    v_today,
    GREATEST(
      50, -- Floor
      LEAST(
        100, -- Ceiling
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
          16 -- Cap likes bonus at +16/day
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

-- [DEPRECATED v1] Function to apply event bonus to Action Speed
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

-- [DEPRECATED v1] Function to calculate proposal response bonus based on timing
CREATE OR REPLACE FUNCTION get_proposal_response_bonus(p_hours_since_proposal NUMERIC)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_hours_since_proposal < 12 THEN 12
    WHEN p_hours_since_proposal < 24 THEN 6
    WHEN p_hours_since_proposal < 48 THEN 0
    WHEN p_hours_since_proposal < 72 THEN -12
    ELSE -15 -- Expired
  END;
$$;

-- [DEPRECATED v1] Function to calculate first proposal bonus based on match timing
CREATE OR REPLACE FUNCTION get_first_proposal_bonus(p_hours_since_match NUMERIC)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_hours_since_match < 12 THEN 12
    WHEN p_hours_since_match < 24 THEN 6
    WHEN p_hours_since_match < 48 THEN 0
    WHEN p_hours_since_match < 72 THEN -8
    ELSE -10 -- Match expired
  END;
$$;

-- [DEPRECATED v1] Function to update Profile Quality (Bayesian MAR)
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

-- [DEPRECATED v1] Function to update Reliability based on events
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
BEGIN
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
-- SCORING V2: Event-Sourced Functions
-- ============================================================================

-- Trigger functions that emit scoring events (see migration for trigger creation)
-- emit_like_events() — likes INSERT → like_given + like_received
-- emit_match_events() — matches INSERT → match_created (both users)
-- emit_proposal_events() — proposals INSERT → proposal_sent
-- emit_confirm_events() — confirms INSERT → proposal_response
-- emit_survey_events() — surveys INSERT → date_attended/date_no_show/date_would_meet_again/date_would_not_meet
-- emit_report_events() — reports INSERT → safety_report

-- Score computation: pure function, events in → scores out
CREATE OR REPLACE FUNCTION compute_user_scores(p_user_id UUID)
RETURNS TABLE(action_speed INTEGER, attractiveness INTEGER, reliability INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_speed INTEGER;
  v_attract INTEGER;
  v_reliability INTEGER;
  v_proposal_bonus INTEGER;
  v_response_bonus INTEGER;
  v_attendance_bonus INTEGER;
  v_penalty INTEGER;
  v_like_activity INTEGER;
  v_likes_received INTEGER;
  v_impressions INTEGER;
  v_rel_bonus INTEGER;
  v_rel_penalty INTEGER;
BEGIN
  -- ACTION SPEED (0-100)
  SELECT COALESCE(SUM(
    CASE
      WHEN (payload->>'hours_since_match')::numeric < 12 THEN 15
      WHEN (payload->>'hours_since_match')::numeric < 24 THEN 8
      WHEN (payload->>'hours_since_match')::numeric < 48 THEN 3
      ELSE 0
    END
  ), 0) INTO v_proposal_bonus
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'proposal_sent'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  SELECT COALESCE(SUM(
    CASE
      WHEN (payload->>'hours_since_proposal')::numeric < 12 THEN 12
      WHEN (payload->>'hours_since_proposal')::numeric < 24 THEN 6
      WHEN (payload->>'hours_since_proposal')::numeric < 48 THEN 2
      ELSE 0
    END
  ), 0) INTO v_response_bonus
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'proposal_response'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  SELECT COALESCE(COUNT(*) * 10, 0) INTO v_attendance_bonus
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'date_attended'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  SELECT COALESCE(SUM(
    CASE event_type
      WHEN 'proposal_expired' THEN 15
      WHEN 'match_stale' THEN 5
      ELSE 0
    END
  ), 0) INTO v_penalty
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type IN ('proposal_expired', 'match_stale')
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  SELECT LEAST(COALESCE(COUNT(*), 0), 4) INTO v_like_activity
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'like_given'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days';

  v_speed := GREATEST(0, LEAST(100,
    50 + v_proposal_bonus + v_response_bonus + v_attendance_bonus - v_penalty + v_like_activity
  ));

  -- ATTRACTIVENESS (0-100)
  SELECT COALESCE(COUNT(*), 0) INTO v_likes_received
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'like_received'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  SELECT COALESCE(COUNT(*), 0) INTO v_impressions
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'feed_impression'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  v_attract := ROUND(100.0 * (5 + v_likes_received) / (20 + GREATEST(v_impressions, 1)));

  v_attract := v_attract + COALESCE((
    SELECT COUNT(*) * 3
    FROM scoring_events
    WHERE user_id = p_user_id AND event_type = 'date_would_meet_again'
      AND created_at >= CURRENT_DATE - INTERVAL '60 days'
  ), 0);

  v_attract := GREATEST(0, LEAST(100, v_attract));

  -- RELIABILITY (20-100)
  SELECT COALESCE(SUM(
    CASE event_type
      WHEN 'date_attended' THEN 5
      WHEN 'date_would_meet_again' THEN 3
      ELSE 0
    END
  ), 0) INTO v_rel_bonus
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type IN ('date_attended', 'date_would_meet_again')
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  SELECT COALESCE(SUM(
    CASE event_type
      WHEN 'date_no_show' THEN 30
      WHEN 'safety_report' THEN 10
      WHEN 'honest_cancel_under_24h' THEN 5
      WHEN 'honest_cancel_24h' THEN 1
      ELSE 0
    END
  ), 0) INTO v_rel_penalty
  FROM scoring_events
  WHERE user_id = p_user_id
    AND event_type IN ('date_no_show', 'safety_report', 'honest_cancel_under_24h', 'honest_cancel_24h')
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  v_reliability := GREATEST(20, LEAST(100, 70 + v_rel_bonus - v_rel_penalty));

  RETURN QUERY SELECT v_speed, v_attract, v_reliability;
END;
$$;

-- Daily score materialization (replaces run_daily_scoring)
CREATE OR REPLACE FUNCTION materialize_scores()
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_count INTEGER;
BEGIN
  INSERT INTO scores_daily (user_id, day, action_speed, profile_quality, reliability, report_risk)
  SELECT
    u.user_id,
    CURRENT_DATE,
    cs.action_speed,
    cs.attractiveness,
    cs.reliability,
    0
  FROM users u
  CROSS JOIN LATERAL compute_user_scores(u.user_id) cs
  ON CONFLICT (user_id, day) DO UPDATE SET
    action_speed = EXCLUDED.action_speed,
    profile_quality = EXCLUDED.profile_quality,
    reliability = EXCLUDED.reliability;

  SELECT COUNT(DISTINCT user_id) INTO v_user_count
  FROM scores_daily WHERE day = CURRENT_DATE;

  RETURN QUERY SELECT TRUE, format('Scores materialized for %s users', v_user_count)::TEXT;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT FALSE, format('Materialization failed: %s', SQLERRM)::TEXT;
END;
$$;

-- Function to get user's credit balance
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE SQL SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(delta), 0)::INTEGER
  FROM credits_ledger
  WHERE user_id = p_user_id;
$$;
