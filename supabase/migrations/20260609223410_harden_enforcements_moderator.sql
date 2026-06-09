-- ============================================================================
-- Migration: Harden enforcements moderator policy (audit F4b)
-- Created:   2026-06-09
-- ----------------------------------------------------------------------------
-- Same self-promotion hole as `reports` (fixed in the harden_reports_visibility
-- migration), found while auditing RLS policies: the `enforcements` policy
--   "Moderators can manage enforcements"  FOR ALL
--   USING ((auth.users.raw_user_meta_data ->> 'role') = 'moderator')
-- gates on user_metadata, which any signed-in user can self-set via
-- supabase.auth.updateUser({ data: { role: 'moderator' } }). Because the policy
-- is FOR ALL, a self-promoted user could read every enforcement (ban/suspension)
-- record, delete their own, or insert bans against others.
--
-- Fix: gate on membership in the server-managed `moderators` table (created in
-- the harden_reports_visibility migration), for both USING (existing rows) and
-- WITH CHECK (inserted/updated rows). (select auth.uid()) is initplan-friendly.
-- The "Users can view own enforcements" policy (accused_id = self) is unchanged.
-- ============================================================================

DROP POLICY IF EXISTS "Moderators can manage enforcements" ON public.enforcements;
CREATE POLICY "Moderators can manage enforcements" ON public.enforcements FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.moderators m WHERE m.user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.moderators m WHERE m.user_id = (select auth.uid())
  ));

SELECT pg_notify('pgrst', 'reload schema');
