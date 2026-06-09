-- ============================================================================
-- Migration: Make proposals server-controlled after creation (audit F8)
-- Created:   2026-06-09
-- ----------------------------------------------------------------------------
-- The `proposals` UPDATE policy "Users can update proposals they sent"
-- (USING auth.uid() = sender_id) had no WITH CHECK and no column restriction,
-- and `authenticated` held a table-level UPDATE grant. A sender could therefore
-- `UPDATE proposals SET expires_at = <far future>` (or flip `status`) directly
-- via PostgREST, bypassing the 72-hour expiry that is the core product
-- mechanic.
--
-- The mobile client never updates proposals directly (verified by grep): it
-- only SELECTs and INSERTs. Every legitimate status transition happens through
-- SECURITY DEFINER paths that run as the function owner and are unaffected by
-- these grants:
--   * confirm_proposal()  — sets status = 'confirmed'
--   * expire_proposals()  — cron sweep, sets status = 'expired'
--
-- Fix: revoke the client UPDATE privilege entirely and drop the now-dead
-- UPDATE policy. A future "withdraw proposal" feature should go through a
-- dedicated SECURITY DEFINER RPC rather than a direct table UPDATE.
-- ============================================================================

REVOKE UPDATE ON public.proposals FROM anon, authenticated;

DROP POLICY IF EXISTS "Users can update proposals they sent" ON public.proposals;

-- Reload PostgREST schema cache (exposed-table privilege change).
SELECT pg_notify('pgrst', 'reload schema');
