-- Migration: Create/update get_discovery_feed function and grant EXECUTE permissions
-- Created: 2026-01-04
-- Purpose: Ensure get_discovery_feed function exists and allow authenticated users to call it

-- Create or replace the function (idempotent)
CREATE OR REPLACE FUNCTION public.get_discovery_feed(p_viewer UUID, p_limit INTEGER DEFAULT 20)
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
    AND auth.uid() = p_viewer  -- SECURITY: Enforce caller identity
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

-- Grant EXECUTE permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_discovery_feed(UUID, INTEGER) TO authenticated;

