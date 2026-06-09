-- ============================================================================
-- Migration: Revoke anon/public EXECUTE on app + internal functions (audit F3)
-- Created:   2026-06-09
-- ----------------------------------------------------------------------------
-- 39 SECURITY DEFINER functions were EXECUTE-able by `anon` (granted to PUBLIC
-- by default at CREATE time). That is unnecessary attack surface: an
-- unauthenticated caller could reach app RPCs (which then no-op on a NULL
-- auth.uid(), but should not be reachable at all) and, in one verified case
-- (email_exists), an outright email-enumeration oracle.
--
-- This migration removes the PUBLIC/anon grant and re-grants EXECUTE to the
-- correct minimal role, in three buckets:
--
--   A. Authenticated app RPCs   -> revoke PUBLIC/anon, grant `authenticated`.
--   B. Internal / scoring / cron / trigger functions -> revoke PUBLIC/anon/
--      authenticated, grant `service_role` only. These are invoked by triggers
--      (EXECUTE privilege is NOT checked when a trigger fires), by pg_cron
--      (runs as the job owner / postgres), or by other SECURITY DEFINER
--      functions (the EXECUTE check is against the definer, not the end user),
--      so removing client grants does not affect them.
--   C. Public marketing RPCs    -> LEFT UNTOUCHED (still anon-callable from the
--      static site): claim/confirm/forget run as service-role from edge
--      functions and were already anon=false; the position/snapshot/tips/share
--      readers below are intentionally anon.
--
-- Not touched here: get_discovery_feed_v4 (locked down in the discovery-feed
-- hardening migration) and the `citext`/`regexp_*`/`text*` extension functions
-- (revoking those would break citext columns used by waitlist emails).
--
-- The mobile client calls every bucket-A RPC with an authenticated session, so
-- granting `authenticated` keeps the app working. Verified: no anon-context
-- caller exists for any bucket-A function, and email_exists has no caller at
-- all.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Bucket A — authenticated app RPCs.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.are_users_matched(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.are_users_matched(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_proposal(uuid, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.confirm_proposal(uuid, uuid, uuid, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_like_and_check_match(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_like_and_check_match(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_match_detail(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_match_detail(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_matches_with_profiles() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_matches_with_profiles() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_action_speed(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_action_speed(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_credits(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_credits(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_matches(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_matches(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.iris_can_use() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.iris_can_use() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.iris_start_trial() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.iris_start_trial() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reactivate_match(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reactivate_match(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reopen_match(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.reopen_match(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.upsert_push_token(text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.upsert_push_token(text, text, text, boolean) TO authenticated;

-- ----------------------------------------------------------------------------
-- Bucket B — internal scoring / housekeeping / trigger functions.
-- Reachable via triggers, pg_cron, or other SECURITY DEFINER functions; no
-- direct client caller. service_role retained for any server-side invocation.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.apply_action_speed_bonus(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_action_speed_bonus(uuid, integer, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.compute_user_scores(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.compute_user_scores(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.materialize_scores() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.materialize_scores() TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_profile_quality(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_profile_quality(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_reliability(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_reliability(uuid, text, numeric) TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_matches() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_matches() TO service_role;

REVOKE EXECUTE ON FUNCTION public.expire_proposals() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.expire_proposals() TO service_role;

REVOKE EXECUTE ON FUNCTION public.refresh_daily_kpis() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.refresh_daily_kpis() TO service_role;

-- email_exists: an email-enumeration oracle with no application caller. Lock
-- it to service_role (the waitlist edge functions can reach it if ever needed).
REVOKE EXECUTE ON FUNCTION public.email_exists(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.email_exists(text) TO service_role;

-- Legacy, unguarded discovery feed (superseded by get_discovery_feed_v4, no
-- live app caller). Remove all client access; drop in a future cleanup.
REVOKE EXECUTE ON FUNCTION public.get_discovery_feed(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_discovery_feed(uuid, integer) TO service_role;

-- Trigger functions: EXECUTE is not checked when the trigger fires, so revoking
-- direct grants is purely surface reduction.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_push_tokens_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_confirm_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_like_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_match_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_proposal_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_report_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_stale_match_events() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_survey_events() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Bucket C — intentionally anon-callable marketing RPCs: NOT modified.
--   list_published_tips, log_waitlist_share, marketing_waitlist_snapshot,
--   waitlist_count_dublin, waitlist_position_for_code(_v2),
--   waitlist_referrer_first_name.
-- ----------------------------------------------------------------------------

-- Reload PostgREST schema cache (EXECUTE privilege changes).
SELECT pg_notify('pgrst', 'reload schema');
