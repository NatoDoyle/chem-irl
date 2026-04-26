-- ============================================================================
-- Migration: Fix get_discovery_feed_v2 and get_discovery_feed_v3 column refs
-- Created:   2026-04-27
-- Purpose:   Both functions were created with PL/pgSQL bodies referencing
--           profiles.user_id, which does not exist (profiles uses `id` as
--           PK, mapped to auth.users.id). PL/pgSQL doesn't validate column
--           refs at CREATE time, so they applied without error but failed
--           at runtime with `column p.user_id does not exist`.
--
--           v3 is called by mobile/src/screens/discover/DiscoverScreen.tsx,
--           so this regressed Discover for any user reaching that screen.
--
--           Fix: replace `p.user_id` with `p.id` (matching the working v1
--           get_discovery_feed). No other behavior change. Return signatures
--           preserved exactly so mobile callers don't need updating.
--
--           Out of scope here: adding `auth.uid() = p_viewer` security
--           checks that v1 has. v2 and v3 currently allow any caller to
--           query any viewer's feed — that's a separate hardening migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_discovery_feed_v2 (used by scoring v2 path; called from server-side
-- experimentation, not currently from the mobile client).
-- ----------------------------------------------------------------------------
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
      p.id AS user_id,
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
    LEFT JOIN scores_daily s ON s.user_id = p.id AND s.day = CURRENT_DATE
    WHERE p.id <> p_viewer
      AND p.completion_pct >= 80
      AND NOT EXISTS (
        SELECT 1 FROM likes l WHERE l.liker_id = p_viewer AND l.likee_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE ((m.user_a = p_viewer AND m.user_b = p.id)
            OR (m.user_a = p.id AND m.user_b = p_viewer))
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

-- ----------------------------------------------------------------------------
-- get_discovery_feed_v3 (active discovery feed; called from mobile
-- DiscoverScreen.tsx). Identical to v2 except `headline` → `full_name`.
-- ----------------------------------------------------------------------------
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
      p.id AS user_id,
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
    LEFT JOIN scores_daily s ON s.user_id = p.id AND s.day = CURRENT_DATE
    WHERE p.id <> p_viewer
      AND p.completion_pct >= 80
      AND NOT EXISTS (
        SELECT 1 FROM likes l WHERE l.liker_id = p_viewer AND l.likee_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE ((m.user_a = p_viewer AND m.user_b = p.id)
            OR (m.user_a = p.id AND m.user_b = p_viewer))
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

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
