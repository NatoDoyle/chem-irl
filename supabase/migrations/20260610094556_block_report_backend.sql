-- ============================================================================
-- Migration: Block & report backend (audit F5 / Workstream D1)
-- Created:   2026-06-10
-- ----------------------------------------------------------------------------
-- Adds a server-enforced block primitive + wires the client into the existing
-- `reports` table. App Store Guideline 1.2 / Play UGC require users be able to
-- block & report abusers; previously blocking did not exist and reports had no
-- client path.
--
--   * blocks table (own-rows RLS; a blockee can never see who blocked them)
--   * are_blocked(a,b) — SECURITY DEFINER helper so RLS policies can see blocks
--     in BOTH directions (a user's own RLS only exposes their outgoing blocks)
--   * block_user / unblock_user / submit_report RPCs (auth.uid()-guarded)
--   * blocking auto-unmatches any active match between the pair
--   * enforcement: discovery feed + create_like (inline, they are DEFINER) and
--     the messages/proposals INSERT policies (via are_blocked) all exclude
--     blocked pairs — blocking auto-unmatches but the match row survives, so
--     without this a blocked user could still post into the dead match.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. blocks table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blockee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blockee_id),
  CONSTRAINT blocks_no_self CHECK (blocker_id <> blockee_id)
);
-- Reverse lookups (who blocked this user) for enforcement joins.
CREATE INDEX IF NOT EXISTS idx_blocks_blockee ON public.blocks (blockee_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- A user manages ONLY their own (outgoing) blocks. A blockee must never be able
-- to learn they were blocked, so there is no policy exposing incoming blocks.
DROP POLICY IF EXISTS blocks_select_own ON public.blocks;
CREATE POLICY blocks_select_own ON public.blocks FOR SELECT
  USING ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS blocks_insert_own ON public.blocks;
CREATE POLICY blocks_insert_own ON public.blocks FOR INSERT
  WITH CHECK ((select auth.uid()) = blocker_id);

DROP POLICY IF EXISTS blocks_delete_own ON public.blocks;
CREATE POLICY blocks_delete_own ON public.blocks FOR DELETE
  USING ((select auth.uid()) = blocker_id);

-- ----------------------------------------------------------------------------
-- 2. are_blocked(a,b) — symmetric block check that bypasses blocks RLS.
--    Used inside the messages/proposals INSERT policies, which run as the
--    calling user and therefore cannot see a block where the OTHER party is
--    the blocker. SECURITY DEFINER lets it see both directions.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.are_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = p_a AND b.blockee_id = p_b)
       OR (b.blocker_id = p_b AND b.blockee_id = p_a)
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. block_user / unblock_user / submit_report RPCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(p_blockee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocker uuid := auth.uid();
BEGIN
  IF v_blocker IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_blockee IS NULL OR p_blockee = v_blocker THEN
    RAISE EXCEPTION 'Invalid: cannot block yourself';
  END IF;

  INSERT INTO blocks (blocker_id, blockee_id)
  VALUES (v_blocker, p_blockee)
  ON CONFLICT (blocker_id, blockee_id) DO NOTHING;

  -- Sever any active (open/expired) match between the pair so they disappear
  -- from each other's match lists. 'closed' (completed-date) history is kept.
  UPDATE matches
  SET status = 'unmatched'
  WHERE status IN ('open', 'expired')
    AND ((user_a = v_blocker AND user_b = p_blockee)
      OR (user_a = p_blockee AND user_b = v_blocker));

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blockee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blocker uuid := auth.uid();
BEGIN
  IF v_blocker IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  -- Removes the block; does NOT resurrect the match. The unblocked user simply
  -- becomes discoverable again.
  DELETE FROM blocks WHERE blocker_id = v_blocker AND blockee_id = p_blockee;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_report(
  p_accused uuid,
  p_category report_category,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter uuid := auth.uid();
  v_case_id uuid;
BEGIN
  IF v_reporter IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_accused IS NULL OR p_accused = v_reporter THEN
    RAISE EXCEPTION 'Invalid: cannot report yourself';
  END IF;

  -- Report and block are independent (product decision): submitting a report
  -- does NOT block. sla_deadline is NOT NULL with no default, so set it here.
  INSERT INTO reports (reporter_id, accused_id, category, description, status, sla_deadline)
  VALUES (
    v_reporter,
    p_accused,
    p_category,
    NULLIF(btrim(coalesce(p_description, '')), ''),
    'pending',
    now() + INTERVAL '24 hours'
  )
  RETURNING case_id INTO v_case_id;

  RETURN jsonb_build_object('success', true, 'case_id', v_case_id);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. Enforcement: discovery feed. Reproduces the deployed body verbatim
--    (incl. the #121 auth.uid() guard) and adds a both-directions block
--    exclusion. SECURITY DEFINER, so the inline blocks read is fine.
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
  user_id uuid, full_name text, bio text, availability_summary text,
  action_speed integer, attractiveness integer, reliability integer, composite_score numeric
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
  IF auth.uid() IS NULL OR auth.uid() <> p_viewer THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the viewer';
  END IF;

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
      AND jsonb_typeof(p.photos) = 'array'
      AND jsonb_array_length(p.photos) > 0
      AND NOT EXISTS (
        SELECT 1 FROM likes l WHERE l.liker_id = p_viewer AND l.likee_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE ((m.user_a = p_viewer AND m.user_b = p.id)
            OR (m.user_a = p.id AND m.user_b = p_viewer))
          AND m.status = 'open'
      )
      -- Block exclusion (either direction).
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = p_viewer AND b.blockee_id = p.id)
           OR (b.blocker_id = p.id AND b.blockee_id = p_viewer)
      )
      AND (p_age_min IS NULL OR EXTRACT(YEAR FROM age(u.dob))::INTEGER >= p_age_min)
      AND (p_age_max IS NULL OR EXTRACT(YEAR FROM age(u.dob))::INTEGER <= p_age_max)
      AND (p_genders IS NULL OR array_length(p_genders, 1) IS NULL
           OR u.gender::TEXT = ANY(p_genders))
      AND (p_relationship_intents IS NULL OR array_length(p_relationship_intents, 1) IS NULL
           OR (p.prompts -> 'demographics' ->> 'relationship_intent') = ANY(p_relationship_intents))
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

-- ----------------------------------------------------------------------------
-- 5. Enforcement: create_like_and_check_match. Reproduces the deployed body
--    (incl. the auth.uid() guard) and rejects likes between blocked users.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_like_and_check_match(p_liker uuid, p_likee uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Block check: neither party may have blocked the other.
  IF EXISTS (
    SELECT 1 FROM blocks b
    WHERE (b.blocker_id = p_liker AND b.blockee_id = p_likee)
       OR (b.blocker_id = p_likee AND b.blockee_id = p_liker)
  ) THEN
    RAISE EXCEPTION 'Cannot like a blocked user';
  END IF;

  INSERT INTO likes (liker_id, likee_id)
  VALUES (p_liker, p_likee)
  ON CONFLICT (liker_id, likee_id) DO NOTHING
  RETURNING like_id INTO v_like_id;

  IF v_like_id IS NULL THEN
    SELECT like_id INTO v_like_id FROM likes WHERE liker_id = p_liker AND likee_id = p_likee;
    SELECT EXISTS (
      SELECT 1 FROM matches
      WHERE ((user_a = p_liker AND user_b = p_likee) OR (user_a = p_likee AND user_b = p_liker))
        AND status = 'open'
    ) INTO v_mutual_like_exists;

    RETURN jsonb_build_object('like_id', v_like_id, 'matched', v_mutual_like_exists, 'match_id', NULL);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM likes WHERE liker_id = p_likee AND likee_id = p_liker
  ) INTO v_mutual_like_exists;

  IF v_mutual_like_exists THEN
    INSERT INTO matches (user_a, user_b, status)
    VALUES (LEAST(p_liker, p_likee), GREATEST(p_liker, p_likee), 'open')
    ON CONFLICT (user_a, user_b) DO UPDATE SET
      status = 'open',
      expires_at = NOW() + INTERVAL '72 hours'
    RETURNING match_id INTO v_match_id;

    RETURN jsonb_build_object('like_id', v_like_id, 'matched', true, 'match_id', v_match_id);
  END IF;

  RETURN jsonb_build_object('like_id', v_like_id, 'matched', false, 'match_id', NULL);
END;
$function$;

-- ----------------------------------------------------------------------------
-- 6. Enforcement: messages / proposals INSERT policies. Add a both-directions
--    block check (via are_blocked, which bypasses blocks RLS). Predicates are
--    otherwise the deployed (initplan-wrapped) versions.
-- ----------------------------------------------------------------------------
DROP POLICY "Users can insert messages in their matches" ON public.messages;
CREATE POLICY "Users can insert messages in their matches" ON public.messages FOR INSERT TO public
  WITH CHECK (
    (((select auth.uid()) = sender_id)
     AND (EXISTS ( SELECT 1
        FROM matches m
       WHERE ((m.match_id = messages.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid()))))))
     AND (NOT EXISTS ( SELECT 1
        FROM matches m2
       WHERE ((m2.match_id = messages.match_id) AND public.are_blocked(m2.user_a, m2.user_b)))))
  );

DROP POLICY "Users can insert proposals in their matches" ON public.proposals;
CREATE POLICY "Users can insert proposals in their matches" ON public.proposals FOR INSERT TO public
  WITH CHECK (
    (((select auth.uid()) = sender_id)
     AND (EXISTS ( SELECT 1
        FROM matches m
       WHERE ((m.match_id = proposals.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid()))))))
     AND (NOT EXISTS ( SELECT 1
        FROM matches m2
       WHERE ((m2.match_id = proposals.match_id) AND public.are_blocked(m2.user_a, m2.user_b)))))
  );

-- ----------------------------------------------------------------------------
-- 7. Grants — authenticated only (revoke the default PUBLIC/anon EXECUTE).
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.are_blocked(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.are_blocked(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_report(uuid, report_category, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.submit_report(uuid, report_category, text) TO authenticated;

-- Reload PostgREST schema cache (new table + functions + policy changes).
SELECT pg_notify('pgrst', 'reload schema');
