-- Scoring V2: Event-Sourced Architecture
-- Replaces legacy scoring with event log → compute → materialize pipeline
--
-- Architecture:
--   User actions → triggers → scoring_events (immutable log)
--   scoring_events → compute_user_scores() → scores_daily (materialized)
--   scores_daily → get_discovery_feed_v2() → ORDER BY composite_score DESC

-- ============================================================================
-- STEP 1: scoring_events table
-- ============================================================================

CREATE TABLE scoring_events (
  event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scoring_events_user_type ON scoring_events(user_id, event_type, created_at);
CREATE INDEX idx_scoring_events_created ON scoring_events(created_at);

ALTER TABLE scoring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage scoring events" ON scoring_events
  FOR ALL USING (true);

-- ============================================================================
-- STEP 2: Trigger functions that emit events
-- ============================================================================

-- 2a. On likes INSERT — emit like_given (for liker) and like_received (for likee)
CREATE OR REPLACE FUNCTION emit_like_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO scoring_events (user_id, event_type, payload) VALUES
    (NEW.liker_id, 'like_given', jsonb_build_object('likee_id', NEW.likee_id)),
    (NEW.likee_id, 'like_received', jsonb_build_object('liker_id', NEW.liker_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_like_scoring_events
AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION emit_like_events();

-- 2b. On matches INSERT — emit match_created for both users
CREATE OR REPLACE FUNCTION emit_match_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO scoring_events (user_id, event_type, payload) VALUES
    (NEW.user_a, 'match_created', jsonb_build_object('match_id', NEW.match_id, 'other_user_id', NEW.user_b)),
    (NEW.user_b, 'match_created', jsonb_build_object('match_id', NEW.match_id, 'other_user_id', NEW.user_a));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_match_scoring_events
AFTER INSERT ON matches FOR EACH ROW EXECUTE FUNCTION emit_match_events();

-- 2c. On proposals INSERT — emit proposal_sent with match timing
CREATE OR REPLACE FUNCTION emit_proposal_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_match_created TIMESTAMPTZ;
  v_hours NUMERIC;
BEGIN
  SELECT created_at INTO v_match_created FROM matches WHERE match_id = NEW.match_id;
  v_hours := EXTRACT(EPOCH FROM (NEW.created_at - v_match_created)) / 3600.0;

  INSERT INTO scoring_events (user_id, event_type, payload) VALUES
    (NEW.sender_id, 'proposal_sent', jsonb_build_object(
      'match_id', NEW.match_id,
      'hours_since_match', ROUND(v_hours, 1)
    ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_proposal_scoring_events
AFTER INSERT ON proposals FOR EACH ROW EXECUTE FUNCTION emit_proposal_events();

-- 2d. On confirms INSERT — emit proposal_response with proposal timing
CREATE OR REPLACE FUNCTION emit_confirm_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposal_created TIMESTAMPTZ;
  v_hours NUMERIC;
BEGIN
  SELECT created_at INTO v_proposal_created FROM proposals WHERE proposal_id = NEW.proposal_id;
  v_hours := EXTRACT(EPOCH FROM (NEW.created_at - v_proposal_created)) / 3600.0;

  INSERT INTO scoring_events (user_id, event_type, payload) VALUES
    (NEW.confirmer_id, 'proposal_response', jsonb_build_object(
      'match_id', NEW.match_id,
      'proposal_id', NEW.proposal_id,
      'hours_since_proposal', ROUND(v_hours, 1)
    ));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_confirm_scoring_events
AFTER INSERT ON confirms FOR EACH ROW EXECUTE FUNCTION emit_confirm_events();

-- 2e. On surveys INSERT — emit appropriate date events
CREATE OR REPLACE FUNCTION emit_survey_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.went THEN
    INSERT INTO scoring_events (user_id, event_type, payload) VALUES
      (NEW.user_id, 'date_attended', jsonb_build_object(
        'match_id', NEW.match_id,
        'on_time_min', COALESCE(NEW.on_time_min, 0)
      ));
    IF NEW.would_meet_again THEN
      INSERT INTO scoring_events (user_id, event_type, payload) VALUES
        (NEW.user_id, 'date_would_meet_again', jsonb_build_object('match_id', NEW.match_id));
    ELSE
      INSERT INTO scoring_events (user_id, event_type, payload) VALUES
        (NEW.user_id, 'date_would_not_meet', jsonb_build_object('match_id', NEW.match_id));
    END IF;
  ELSE
    INSERT INTO scoring_events (user_id, event_type, payload) VALUES
      (NEW.user_id, 'date_no_show', jsonb_build_object('match_id', NEW.match_id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_survey_scoring_events
AFTER INSERT ON surveys FOR EACH ROW EXECUTE FUNCTION emit_survey_events();

-- 2f. On reports INSERT — emit safety_report for accused
CREATE OR REPLACE FUNCTION emit_report_events()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO scoring_events (user_id, event_type, payload) VALUES
    (NEW.accused_id, 'safety_report', jsonb_build_object('case_id', NEW.case_id));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_report_scoring_events
AFTER INSERT ON reports FOR EACH ROW EXECUTE FUNCTION emit_report_events();

-- ============================================================================
-- STEP 3: Score computation — pure function: events in → scores out
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_user_scores(p_user_id UUID)
RETURNS TABLE(action_speed INTEGER, attractiveness INTEGER, reliability INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_speed INTEGER;
  v_attract INTEGER;
  v_reliability INTEGER;
  -- Action speed components
  v_proposal_bonus INTEGER;
  v_response_bonus INTEGER;
  v_attendance_bonus INTEGER;
  v_penalty INTEGER;
  v_like_activity INTEGER;
  -- Attractiveness components
  v_likes_received INTEGER;
  v_impressions INTEGER;
  -- Reliability components
  v_rel_bonus INTEGER;
  v_rel_penalty INTEGER;
BEGIN
  -- ═══════════════════════════════════════════
  -- ACTION SPEED (0-100): time-to-action score
  -- ═══════════════════════════════════════════

  -- Proposal speed bonuses (last 60 days)
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

  -- Response speed bonuses (last 60 days)
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

  -- Attendance bonuses (last 60 days)
  SELECT COALESCE(COUNT(*) * 10, 0) INTO v_attendance_bonus
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'date_attended'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  -- Penalties: expired proposals + stale matches (last 60 days)
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

  -- Minimal like activity bonus (prevents stagnation for unmatched users)
  SELECT LEAST(COALESCE(COUNT(*), 0), 4) INTO v_like_activity
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'like_given'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days';

  v_speed := GREATEST(0, LEAST(100,
    50  -- base score
    + v_proposal_bonus
    + v_response_bonus
    + v_attendance_bonus
    - v_penalty
    + v_like_activity
  ));

  -- ═══════════════════════════════════════════
  -- ATTRACTIVENESS (0-100): how desirable is this profile
  -- ═══════════════════════════════════════════

  -- Incoming likes (last 60 days)
  SELECT COALESCE(COUNT(*), 0) INTO v_likes_received
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'like_received'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  -- Feed impressions (last 60 days)
  SELECT COALESCE(COUNT(*), 0) INTO v_impressions
  FROM scoring_events
  WHERE user_id = p_user_id AND event_type = 'feed_impression'
    AND created_at >= CURRENT_DATE - INTERVAL '60 days';

  -- Bayesian like-rate: (alpha + likes) / (alpha + beta + impressions)
  -- Prior: alpha=5, beta=15 → prior expectation = 25% like rate
  v_attract := ROUND(100.0 * (5 + v_likes_received) / (20 + GREATEST(v_impressions, 1)));

  -- Bonus for post-date "would meet again" (strong attractiveness signal)
  v_attract := v_attract + COALESCE((
    SELECT COUNT(*) * 3
    FROM scoring_events
    WHERE user_id = p_user_id AND event_type = 'date_would_meet_again'
      AND created_at >= CURRENT_DATE - INTERVAL '60 days'
  ), 0);

  v_attract := GREATEST(0, LEAST(100, v_attract));

  -- ═══════════════════════════════════════════
  -- RELIABILITY (20-100): follow-through and safety
  -- ═══════════════════════════════════════════

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

-- ============================================================================
-- STEP 4: Discovery feed v2 — composite score ranking + impression tracking
-- ============================================================================

CREATE OR REPLACE FUNCTION get_discovery_feed_v2(p_viewer UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  headline TEXT,
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
      COALESCE(p.prompts ->> 'headline', '') AS headline,
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
    headline := v_result.headline;
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
-- STEP 5: Score materialization (replaces run_daily_scoring)
-- ============================================================================

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
    0  -- report_risk (future use)
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

-- ============================================================================
-- STEP 6: Stale match detection (daily cron)
-- ============================================================================

CREATE OR REPLACE FUNCTION emit_stale_match_events()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER := 0;
  v_partial INTEGER;
BEGIN
  -- Emit for user_a of stale matches (open >72h, no proposals, not already flagged)
  INSERT INTO scoring_events (user_id, event_type, payload)
  SELECT m.user_a, 'match_stale', jsonb_build_object('match_id', m.match_id)
  FROM matches m
  WHERE m.status = 'open'
    AND m.created_at < NOW() - INTERVAL '72 hours'
    AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.match_id = m.match_id)
    AND NOT EXISTS (
      SELECT 1 FROM scoring_events se
      WHERE se.user_id = m.user_a AND se.event_type = 'match_stale'
        AND (se.payload->>'match_id')::UUID = m.match_id
    );
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_count := v_count + v_partial;

  -- Emit for user_b of stale matches
  INSERT INTO scoring_events (user_id, event_type, payload)
  SELECT m.user_b, 'match_stale', jsonb_build_object('match_id', m.match_id)
  FROM matches m
  WHERE m.status = 'open'
    AND m.created_at < NOW() - INTERVAL '72 hours'
    AND NOT EXISTS (SELECT 1 FROM proposals p WHERE p.match_id = m.match_id)
    AND NOT EXISTS (
      SELECT 1 FROM scoring_events se
      WHERE se.user_id = m.user_b AND se.event_type = 'match_stale'
        AND (se.payload->>'match_id')::UUID = m.match_id
    );
  GET DIAGNOSTICS v_partial = ROW_COUNT;
  v_count := v_count + v_partial;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- STEP 7: Update expire_proposals to emit proposal_expired events
-- ============================================================================

CREATE OR REPLACE FUNCTION expire_proposals()
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
    UPDATE proposals
    SET status = 'expired'
    WHERE expires_at < NOW()
      AND status = 'active'
    RETURNING proposal_id, match_id, sender_id
  ),
  emit_events AS (
    INSERT INTO scoring_events (user_id, event_type, payload)
    SELECT sender_id, 'proposal_expired',
      jsonb_build_object('match_id', match_id, 'proposal_id', proposal_id)
    FROM expiring
  )
  SELECT COUNT(*) INTO v_expired_count FROM expiring;

  RETURN QUERY SELECT
    v_expired_count,
    format('Expired %s proposal(s)', v_expired_count)::TEXT;
END;
$$;

-- ============================================================================
-- STEP 8: Cron job updates
-- ============================================================================

-- Unschedule old daily scoring job
SELECT cron.unschedule('daily_scoring_midnight');

-- Daily score materialization at midnight UTC
SELECT cron.schedule('materialize_scores_daily', '0 0 * * *', $$SELECT materialize_scores();$$);

-- Stale match detection at 00:05 UTC daily
SELECT cron.schedule('stale_matches_daily', '5 0 * * *', $$SELECT emit_stale_match_events();$$);

-- Hourly proposal expiry stays on existing schedule (now emits events too)
-- No change needed: 'expire_proposals_hourly' already calls expire_proposals()

-- ============================================================================
-- Notify PostgREST to reload schema cache (new RPC: get_discovery_feed_v2)
-- ============================================================================
SELECT pg_notify('pgrst', 'reload schema');
