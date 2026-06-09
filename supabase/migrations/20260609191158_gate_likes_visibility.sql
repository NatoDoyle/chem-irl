-- ============================================================================
-- Migration: Gate "who liked you" (audit F9 / decision A6 = gated)
-- Created:   2026-06-09
-- ----------------------------------------------------------------------------
-- The `likes` SELECT policy was
--   USING ((auth.uid() = liker_id) OR (auth.uid() = likee_id))
-- so any user could `SELECT * FROM likes WHERE likee_id = me` and read the full
-- list of people who liked them — bypassing any "see who likes you" gating.
--
-- Per product decision, this is a GATED feature. Restrict the SELECT policy to
-- the user's own *outgoing* likes only, and expose just an aggregate
-- incoming-like count via a controlled SECURITY DEFINER RPC (the "N people
-- like you" teaser). Identities are never returned; unlocking them is a future
-- paid surface that would add its own RPC.
--
-- Safe: the mobile client never reads the `likes` table directly (verified by
-- grep) — likes are created through create_like_and_check_match() — so nothing
-- in the current app depends on the likee-visibility that this removes. The new
-- policy uses (select auth.uid()) (initplan-friendly).
-- ============================================================================

-- 1. Outgoing-only SELECT visibility.
DROP POLICY IF EXISTS "Users can view own likes" ON public.likes;
CREATE POLICY "Users can view own likes" ON public.likes FOR SELECT
  USING ((select auth.uid()) = liker_id);

-- 2. Gated teaser: count of pending admirers (people who liked you and with
--    whom you are not already in an open match). Returns a count only — no
--    identities. Adjust the "pending" definition when the UI is built.
CREATE OR REPLACE FUNCTION public.get_incoming_like_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT count(*)::integer
  FROM likes l
  WHERE l.likee_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM matches m
      WHERE ((m.user_a = l.liker_id AND m.user_b = l.likee_id)
          OR (m.user_a = l.likee_id AND m.user_b = l.liker_id))
        AND m.status = 'open'
    );
$$;

-- Authenticated callers only (mirrors the app-RPC grant convention).
REVOKE EXECUTE ON FUNCTION public.get_incoming_like_count() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_incoming_like_count() TO authenticated;

-- Reload PostgREST schema cache (policy + new RPC).
SELECT pg_notify('pgrst', 'reload schema');
