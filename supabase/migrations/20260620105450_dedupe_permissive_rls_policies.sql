-- Workstream B — de-duplicate permissive RLS policies
-- (advisor: multiple_permissive_policies). PERFORMANCE ONLY: this changes
-- NOTHING about who can access what. Each dropped policy has a surviving
-- twin with an identical (or, where noted, strictly stronger) predicate.
--
-- *** NOT YET APPLIED TO PROD — open for policy-by-policy review. Apply
--     with `supabase db push` only after sign-off. ***
--
-- Ground truth: pg_policies inspection on 2026-06-20 (all policies below
-- confirmed PERMISSIVE). The flagged tables each carry a LEGACY policy
-- ("Users can ... own ...") AND a NEWER twin ("<table>_<action>_own") for
-- the SAME action with the SAME predicate. Postgres OR-evaluates both
-- permissive policies on every row — that double evaluation is the entire
-- finding. Dropping one of two identical permissive policies is a no-op.
--
-- Independent adversarial review (2026-06-20): GO — could not prove an
-- access change on any of the 9 drops.
--
-- NOTE (load-bearing): drops #6/#8/#9 also narrow the declared role from
--   {public} to {authenticated} (their survivor's role). This is
--   access-equivalent ONLY because every predicate is equality against
--   auth.uid(), which is NULL for the anon role — so the dropped anon
--   branch was never grantable. If a future edit makes one of these
--   surviving predicates anon-passable (e.g. a literal `true` or a check
--   on a non-uid column), revisit: the role narrowing would then become a
--   real reduction of anon access.
--
-- DELIBERATELY LEFT IN PLACE: `reports` and `enforcements` also trip the
-- advisor, but with GENUINELY DISTINCT policies — a moderator-scoped policy
-- OR a row-owner policy — correctly OR'd to grant two different kinds of
-- access. Collapsing intentional, correct multi-policy access into one
-- predicate for a perf nicety at near-zero traffic is not worth the
-- security-boundary risk, so those findings remain by design. (The advisor
-- will therefore not reach zero; that is expected.)

-- ── credits_ledger ──────────────────────────────────────────────────────
-- [1] SELECT: identical twin of credits_ledger_select_own. qual:
--     ((SELECT auth.uid()) = user_id)
DROP POLICY IF EXISTS "Users can view own credits" ON public.credits_ledger;

-- ── matches ─────────────────────────────────────────────────────────────
-- [2] SELECT: identical twin of matches_select_own. qual:
--     (((SELECT auth.uid()) = user_a) OR ((SELECT auth.uid()) = user_b))
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;

-- ── push_tokens ─────────────────────────────────────────────────────────
-- [3][4][5] SELECT/INSERT/DELETE: identical twins of
--     push_tokens_{select,insert,delete}_own.
DROP POLICY IF EXISTS "Users can view own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can insert own push tokens" ON public.push_tokens;
DROP POLICY IF EXISTS "Users can delete own push tokens" ON public.push_tokens;
-- [6] UPDATE: survivor push_tokens_update_own is {authenticated} with an
--     explicit WITH CHECK; this legacy {public} twin had only USING
--     (Postgres reuses USING as the check, so the effective rule for an
--     authenticated user is the same). anon never satisfied
--     auth.uid() = user_id. See load-bearing NOTE above.
DROP POLICY IF EXISTS "Users can update own push tokens" ON public.push_tokens;

-- ── scores_daily ────────────────────────────────────────────────────────
-- [7] SELECT: identical twin of scores_daily_select_own.
DROP POLICY IF EXISTS "Users can view own scores" ON public.scores_daily;

-- ── profiles ────────────────────────────────────────────────────────────
-- [8][9] Keep the {authenticated} policies ("Users can insert own
--     profile", "Users can update own profile") which carry an explicit
--     WITH CHECK; drop the weaker {public} twins. Same effective rule for
--     authenticated — the only role that can satisfy auth.uid() = id. The
--     ensureProfileExists/completeSignup upsert runs as authenticated and
--     remains covered by both surviving INSERT and UPDATE policies. See
--     load-bearing NOTE above.
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

SELECT pg_notify('pgrst', 'reload schema');
