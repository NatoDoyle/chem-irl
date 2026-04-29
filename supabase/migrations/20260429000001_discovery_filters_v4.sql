-- ============================================================================
-- Migration: Discovery feed filters (v4) + per-user filter preferences
-- Created:   2026-04-29
--
-- Why: The mobile filter button on Discover was a no-op because v3 of the
-- discovery feed RPC ignored all user preferences. This migration adds:
--   1. profiles.discovery_filters (JSONB) so each user's filter selections
--      survive across sessions and devices.
--   2. get_discovery_feed_v4(...) — a versioned successor to v3 that applies
--      age range, gender, distance, and relationship-intent filters. Per
--      CLAUDE.md, v3 is left intact (no return-shape change in place).
--      v4 also drops profiles with no photos at the SQL layer; this was an
--      explicit product decision (the algorithm filters out photoless
--      profiles automatically rather than exposing a UI toggle for it).
--
-- Distance: implemented with the Haversine formula in plain SQL — avoids a
-- new extension dependency (earthdistance/PostGIS) for what is currently a
-- single-city (Dublin) deployment. lat/lng live inside profiles.availability
-- as set by the existing LocationPermissionScreen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. discovery_filters column
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS discovery_filters JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.discovery_filters IS
  'User-controlled discovery feed filters. Optional keys: age_min (int), '
  'age_max (int), genders (text[]), max_distance_km (int), '
  'relationship_intents (text[]). Missing keys mean no constraint.';

-- ----------------------------------------------------------------------------
-- 2. get_discovery_feed_v4 — v3 + filter params
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_discovery_feed_v4(
  p_viewer UUID,
  p_limit INTEGER DEFAULT 20,
  p_age_min INTEGER DEFAULT NULL,
  p_age_max INTEGER DEFAULT NULL,
  p_genders TEXT[] DEFAULT NULL,
  p_max_distance_km INTEGER DEFAULT NULL,
  p_relationship_intents TEXT[] DEFAULT NULL
)
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
  v_viewer_lat NUMERIC;
  v_viewer_lng NUMERIC;
BEGIN
  -- Resolve viewer location once, up-front. NULLs flow through and disable the
  -- distance constraint for that viewer (rather than excluding everyone).
  SELECT
    NULLIF(availability ->> 'last_known_lat', '')::NUMERIC,
    NULLIF(availability ->> 'last_known_lng', '')::NUMERIC
  INTO v_viewer_lat, v_viewer_lng
  FROM profiles
  WHERE id = p_viewer;

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
    JOIN users u ON u.user_id = p.id
    LEFT JOIN scores_daily s ON s.user_id = p.id AND s.day = CURRENT_DATE
    WHERE p.id <> p_viewer
      AND p.completion_pct >= 80
      -- Algorithm-level: never surface profiles with no photos.
      AND jsonb_typeof(p.photos) = 'array'
      AND jsonb_array_length(p.photos) > 0
      -- Existing exclusions: already liked, currently in an open match
      AND NOT EXISTS (
        SELECT 1 FROM likes l WHERE l.liker_id = p_viewer AND l.likee_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE ((m.user_a = p_viewer AND m.user_b = p.id)
            OR (m.user_a = p.id AND m.user_b = p_viewer))
          AND m.status = 'open'
      )
      -- Age range (derived from users.dob)
      AND (p_age_min IS NULL OR EXTRACT(YEAR FROM age(u.dob))::INTEGER >= p_age_min)
      AND (p_age_max IS NULL OR EXTRACT(YEAR FROM age(u.dob))::INTEGER <= p_age_max)
      -- Gender (multi-select; NULL/empty array means no constraint)
      AND (p_genders IS NULL OR array_length(p_genders, 1) IS NULL
           OR u.gender::TEXT = ANY(p_genders))
      -- Relationship intent from prompts.demographics
      AND (p_relationship_intents IS NULL OR array_length(p_relationship_intents, 1) IS NULL
           OR (p.prompts -> 'demographics' ->> 'relationship_intent') = ANY(p_relationship_intents))
      -- Distance via Haversine. Disabled if either side has no location.
      AND (
        p_max_distance_km IS NULL
        OR v_viewer_lat IS NULL OR v_viewer_lng IS NULL
        OR (p.availability ->> 'last_known_lat') IS NULL
        OR (p.availability ->> 'last_known_lng') IS NULL
        OR (
          6371 * acos(
            LEAST(
              1.0,
              cos(radians(v_viewer_lat))
                * cos(radians((p.availability ->> 'last_known_lat')::NUMERIC))
                * cos(radians((p.availability ->> 'last_known_lng')::NUMERIC) - radians(v_viewer_lng))
              + sin(radians(v_viewer_lat))
                * sin(radians((p.availability ->> 'last_known_lat')::NUMERIC))
            )
          )
        ) <= p_max_distance_km
      )
    ORDER BY composite_score DESC, p.updated_at DESC
    LIMIT p_limit
  LOOP
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

-- Reload PostgREST schema cache so the new RPC is discoverable.
SELECT pg_notify('pgrst', 'reload schema');
