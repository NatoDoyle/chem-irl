-- ============================================================================
-- Migration: Harden the discovery feed + scoring_events integrity boundary
-- Created:   2026-06-09
-- ----------------------------------------------------------------------------
-- Two related fixes that close a forged/anonymous-access hole in the
-- scoring + discovery subsystem (audit findings F1, F2):
--
--   1. get_discovery_feed_v4() is SECURITY DEFINER and was granted to anon.
--      It trusted the client-supplied `p_viewer` with no check against
--      auth.uid(), so ANY caller (including unauthenticated) could pass an
--      arbitrary uuid to (a) harvest that user's candidate set — full_name,
--      bio and internal scores — and (b) inject 'feed_impression' rows into
--      another user's scoring stream. Its sibling RPCs
--      (create_like_and_check_match, confirm_proposal, apply_action_speed_bonus)
--      already enforce `auth.uid() = <actor>`; this one was the outlier.
--      Fix: add the same guard and restrict EXECUTE to authenticated.
--      The mobile caller already passes `p_viewer: user.id`
--      (mobile/src/screens/discover/DiscoverScreen.tsx), so the guard is
--      transparent to legitimate use. The RETURNS shape is unchanged, so this
--      is a plain CREATE OR REPLACE (no _v2 versioning required).
--
--   2. scoring_events carried a `FOR ALL TO public USING (true)` policy
--      ("System can manage scoring events"), letting any user read, insert,
--      update or delete the entire platform's ranking event stream. All
--      legitimate writes happen through SECURITY DEFINER functions/triggers
--      (the feed RPC + emit_* triggers) which run as the function owner and
--      bypass RLS, so dropping the policy denies direct client access without
--      affecting the app. The mobile client never touches scoring_events
--      directly (verified by grep).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. get_discovery_feed_v4: add the viewer authorization guard.
--    Body reproduced verbatim from the deployed definition; the ONLY change
--    is the auth.uid() guard added immediately after BEGIN.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_discovery_feed_v4(
  p_viewer uuid,
  p_limit integer DEFAULT 20,
  p_age_min integer DEFAULT NULL::integer,
  p_age_max integer DEFAULT NULL::integer,
  p_genders text[] DEFAULT NULL::text[],
  p_max_distance_km integer DEFAULT NULL::integer,
  p_relationship_intents text[] DEFAULT NULL::text[]
)
RETURNS TABLE(
  user_id uuid,
  full_name text,
  bio text,
  availability_summary text,
  action_speed integer,
  attractiveness integer,
  reliability integer,
  composite_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result RECORD;
  v_viewer_lat NUMERIC;
  v_viewer_lng NUMERIC;
BEGIN
  -- SECURITY: the feed must only ever be computed for the calling user.
  -- Without this guard any caller (incl. anon, since this is SECURITY DEFINER)
  -- could pass an arbitrary p_viewer to harvest another user's candidate set
  -- and inject 'feed_impression' rows into their scoring stream.
  IF auth.uid() IS NULL OR auth.uid() <> p_viewer THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the viewer';
  END IF;

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
$function$;

-- Restrict who can call the feed. CREATE OR REPLACE preserves prior grants, so
-- the historical `GRANT EXECUTE ... TO anon/public` must be revoked explicitly.
REVOKE EXECUTE ON FUNCTION public.get_discovery_feed_v4(uuid, integer, integer, integer, text[], integer, text[]) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_discovery_feed_v4(uuid, integer, integer, integer, text[], integer, text[]) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. scoring_events: drop the open "manage everything" policy.
--    RLS stays enabled; with no client policy the table is reachable only by
--    the service role and SECURITY DEFINER functions/triggers (which is how
--    every legitimate write already happens).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "System can manage scoring events" ON public.scoring_events;

-- ----------------------------------------------------------------------------
-- 3. Reload PostgREST schema cache (function signature/permission change).
-- ----------------------------------------------------------------------------
SELECT pg_notify('pgrst', 'reload schema');
