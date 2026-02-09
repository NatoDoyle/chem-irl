-- Extend discovery feed to include photos and enforce auth (v2 helper).
-- Non-breaking: we keep the existing get_discovery_feed function untouched.

CREATE OR REPLACE FUNCTION public.get_discovery_feed_v2(p_viewer UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  headline TEXT,
  bio TEXT,
  availability_summary TEXT,
  action_speed INTEGER,
  profile_quality INTEGER,
  reliability INTEGER,
  photos JSONB
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
    COALESCE(s.reliability, 70) AS reliability,
    COALESCE(p.photos, '[]'::jsonb) AS photos
  FROM public.profiles p
  LEFT JOIN public.scores_daily s ON s.user_id = p.id AND s.day = CURRENT_DATE
  WHERE p.id <> p_viewer
    AND p.completion_pct >= 80
    AND auth.uid() = p_viewer
    AND NOT EXISTS (
      SELECT 1 FROM public.likes l
      WHERE l.liker_id = p_viewer AND l.likee_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.matches m
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

GRANT EXECUTE ON FUNCTION public.get_discovery_feed_v2(UUID, INTEGER) TO authenticated;

-- Ensure PostgREST schema cache is refreshed so RPC is visible immediately
SELECT pg_notify('pgrst', 'reload schema');

