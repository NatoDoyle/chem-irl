-- Migration: Scoring Engine Functions
-- Migrated from: db/scoring.sql
-- Order: 4 of 12
-- Description: Implements Action Speed, Profile Quality, and Reliability scoring
-- Note: Must run before security_fixes.sql which patches these functions

-- Scoring Engine Functions for Chem IRL
-- Implements Action Speed, Profile Quality, and Reliability scoring

-- Function to update Action Speed based on daily engine
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

-- Function to apply event bonus to Action Speed
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

-- Function to calculate proposal response bonus based on timing
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

-- Function to calculate first proposal bonus based on match timing
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

-- Function to update Profile Quality (Bayesian MAR)
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

-- Function to update Reliability based on events
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

