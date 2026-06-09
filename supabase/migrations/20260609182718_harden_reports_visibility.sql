-- ============================================================================
-- Migration: Harden reports visibility (audit F4)
-- Created:   2026-06-09
-- ----------------------------------------------------------------------------
-- Two problems with the `reports` SELECT policies:
--
--   1. "Moderators can view all reports" keyed moderator status off
--      auth.users.raw_user_meta_data ->> 'role'. raw_user_meta_data is the
--      *user_metadata* object, which a signed-in user can freely overwrite via
--      supabase.auth.updateUser({ data: { role: 'moderator' } }). Any user
--      could therefore self-promote and read every report on the platform
--      (reporter identities + accusations).
--
--   2. "Users can view own reports" used
--      (auth.uid() = reporter_id) OR (auth.uid() = accused_id), so a reported
--      user could enumerate reports filed against them and learn who reported
--      them — a retaliation risk.
--
-- Fix: introduce a server-managed `moderators` table (no client write path)
-- and gate moderator access on membership in it; drop accused visibility so a
-- user can only ever see reports they filed.
--
-- The mobile client does not read or write `reports` today (verified by grep),
-- so removing accused visibility breaks nothing. New policies use
-- (select auth.uid()) so the planner evaluates auth.uid() once per query.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Server-managed moderators table.
--    RLS on; the only client-facing policy lets a user see *their own* row,
--    which is required so the EXISTS(...) subquery in the reports policy below
--    resolves for a moderator (a subquery against an RLS table is itself
--    subject to that table's RLS). Membership is granted out-of-band by the
--    service role; there is no INSERT/UPDATE/DELETE policy for clients.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderators (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderators_select_self ON public.moderators;
CREATE POLICY moderators_select_self ON public.moderators FOR SELECT
  USING ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 2. Replace the reports SELECT policies.
--    (The INSERT policy "Users can insert reports" is left untouched.)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Moderators can view all reports" ON public.reports;
CREATE POLICY "Moderators can view all reports" ON public.reports FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.moderators m WHERE m.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT
  USING ((select auth.uid()) = reporter_id);

-- Reload PostgREST schema cache (new table + policy changes).
SELECT pg_notify('pgrst', 'reload schema');
