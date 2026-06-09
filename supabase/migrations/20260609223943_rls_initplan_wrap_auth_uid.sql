-- ============================================================================
-- Migration: Wrap auth.uid() in RLS policies as (select auth.uid()) (audit F11)
-- Created:   2026-06-09
-- ----------------------------------------------------------------------------
-- Performance only — NO semantic change. `auth.uid()` and `(select auth.uid())`
-- return the same value; the subselect lets the Postgres planner evaluate it
-- ONCE per query (an InitPlan) instead of re-running it per row. This is the
-- fix Supabase's `auth_rls_initplan` performance advisor asks for (49 hits).
--
-- Each statement below was generated from pg_policies' own deparsed predicate
-- text with a single textual substitution (`auth.uid()` -> `(select auth.uid())`)
-- — the predicates are otherwise byte-identical to what is deployed, so the
-- access semantics are unchanged. Policies already wrapped (the reports/likes/
-- moderators/enforcements-moderator ones fixed in the security PRs) are skipped.
--
-- 44 policies across 19 tables. DROP+CREATE pairs run inside this migration's
-- transaction, so there is no window where a policy is absent for live traffic.
-- Verify after apply by diffing pg_policies against the pre-state: the only
-- change must be `auth.uid()` -> `( SELECT auth.uid() AS uid)` everywhere.
-- ============================================================================

DROP POLICY "Users can insert confirms in their matches" ON public.confirms;
CREATE POLICY "Users can insert confirms in their matches" ON public.confirms FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) = confirmer_id) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = confirms.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid()))))))));

DROP POLICY "Users can view confirms in their matches" ON public.confirms;
CREATE POLICY "Users can view confirms in their matches" ON public.confirms FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = confirms.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid())))))));

DROP POLICY "Users can view own credits" ON public.credits_ledger;
CREATE POLICY "Users can view own credits" ON public.credits_ledger FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY credits_ledger_select_own ON public.credits_ledger;
CREATE POLICY credits_ledger_select_own ON public.credits_ledger FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can view own enforcements" ON public.enforcements;
CREATE POLICY "Users can view own enforcements" ON public.enforcements FOR SELECT TO public
  USING (((select auth.uid()) = accused_id));

DROP POLICY iris_conversations_select_own ON public.iris_conversations;
CREATE POLICY iris_conversations_select_own ON public.iris_conversations FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY iris_memory_select_own ON public.iris_memory;
CREATE POLICY iris_memory_select_own ON public.iris_memory FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY iris_messages_select_own ON public.iris_messages;
CREATE POLICY iris_messages_select_own ON public.iris_messages FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM iris_conversations c
  WHERE ((c.id = iris_messages.conversation_id) AND (c.user_id = (select auth.uid()))))));

DROP POLICY "Users can delete own likes" ON public.likes;
CREATE POLICY "Users can delete own likes" ON public.likes FOR DELETE TO public
  USING (((select auth.uid()) = liker_id));

DROP POLICY "Users can insert own likes" ON public.likes;
CREATE POLICY "Users can insert own likes" ON public.likes FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = liker_id));

DROP POLICY "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches" ON public.matches FOR SELECT TO public
  USING ((((select auth.uid()) = user_a) OR ((select auth.uid()) = user_b)));

DROP POLICY matches_select_own ON public.matches;
CREATE POLICY matches_select_own ON public.matches FOR SELECT TO public
  USING ((((select auth.uid()) = user_a) OR ((select auth.uid()) = user_b)));

DROP POLICY "Users can update own matches" ON public.matches;
CREATE POLICY "Users can update own matches" ON public.matches FOR UPDATE TO public
  USING ((((select auth.uid()) = user_a) OR ((select auth.uid()) = user_b)));

DROP POLICY "Users can insert messages in their matches" ON public.messages;
CREATE POLICY "Users can insert messages in their matches" ON public.messages FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) = sender_id) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = messages.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid()))))))));

DROP POLICY "Users can view messages in their matches" ON public.messages;
CREATE POLICY "Users can view messages in their matches" ON public.messages FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = messages.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid())))))));

DROP POLICY photo_verification_checks_select_own ON public.photo_verification_checks;
CREATE POLICY photo_verification_checks_select_own ON public.photo_verification_checks FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (((select auth.uid()) = id));

DROP POLICY profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = id));

DROP POLICY "Users can view own and matched profiles" ON public.profiles;
CREATE POLICY "Users can view own and matched profiles" ON public.profiles FOR SELECT TO public
  USING ((((select auth.uid()) = id) OR (EXISTS ( SELECT 1
   FROM matches
  WHERE ((matches.status = ANY (ARRAY['open'::match_status, 'expired'::match_status])) AND (((matches.user_a = (select auth.uid())) AND (matches.user_b = profiles.id)) OR ((matches.user_b = (select auth.uid())) AND (matches.user_a = profiles.id))))))));

DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (((select auth.uid()) = id))
  WITH CHECK (((select auth.uid()) = id));

DROP POLICY profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO public
  USING (((select auth.uid()) = id));

DROP POLICY "Users can insert proposals in their matches" ON public.proposals;
CREATE POLICY "Users can insert proposals in their matches" ON public.proposals FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) = sender_id) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = proposals.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid()))))))));

DROP POLICY "Users can view proposals in their matches" ON public.proposals;
CREATE POLICY "Users can view proposals in their matches" ON public.proposals FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = proposals.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid())))))));

DROP POLICY "Users can insert own purchases" ON public.purchases;
CREATE POLICY "Users can insert own purchases" ON public.purchases FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY "Users can view own purchases" ON public.purchases;
CREATE POLICY "Users can view own purchases" ON public.purchases FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can delete own push tokens" ON public.push_tokens;
CREATE POLICY "Users can delete own push tokens" ON public.push_tokens FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY push_tokens_delete_own ON public.push_tokens;
CREATE POLICY push_tokens_delete_own ON public.push_tokens FOR DELETE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can insert own push tokens" ON public.push_tokens;
CREATE POLICY "Users can insert own push tokens" ON public.push_tokens FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY push_tokens_insert_own ON public.push_tokens;
CREATE POLICY push_tokens_insert_own ON public.push_tokens FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = user_id));

DROP POLICY "Users can view own push tokens" ON public.push_tokens;
CREATE POLICY "Users can view own push tokens" ON public.push_tokens FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY push_tokens_select_own ON public.push_tokens;
CREATE POLICY push_tokens_select_own ON public.push_tokens FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can update own push tokens" ON public.push_tokens;
CREATE POLICY "Users can update own push tokens" ON public.push_tokens FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY push_tokens_update_own ON public.push_tokens;
CREATE POLICY push_tokens_update_own ON public.push_tokens FOR UPDATE TO authenticated
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

DROP POLICY "Users can insert reports" ON public.reports;
CREATE POLICY "Users can insert reports" ON public.reports FOR INSERT TO public
  WITH CHECK (((select auth.uid()) = reporter_id));

DROP POLICY "Users can view own scores" ON public.scores_daily;
CREATE POLICY "Users can view own scores" ON public.scores_daily FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY scores_daily_select_own ON public.scores_daily;
CREATE POLICY scores_daily_select_own ON public.scores_daily FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can insert surveys in their matches" ON public.surveys;
CREATE POLICY "Users can insert surveys in their matches" ON public.surveys FOR INSERT TO public
  WITH CHECK ((((select auth.uid()) = user_id) AND (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = surveys.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid()))))))));

DROP POLICY "Users can view surveys in their matches" ON public.surveys;
CREATE POLICY "Users can view surveys in their matches" ON public.surveys FOR SELECT TO public
  USING ((((select auth.uid()) = user_id) OR (EXISTS ( SELECT 1
   FROM matches m
  WHERE ((m.match_id = surveys.match_id) AND ((m.user_a = (select auth.uid())) OR (m.user_b = (select auth.uid()))))))));

DROP POLICY "Users can update own surveys" ON public.surveys;
CREATE POLICY "Users can update own surveys" ON public.surveys FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY token_tx_select ON public.token_transactions;
CREATE POLICY token_tx_select ON public.token_transactions FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY tokens_select ON public.tokens;
CREATE POLICY tokens_select ON public.tokens FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT TO public
  USING (((select auth.uid()) = user_id));

DROP POLICY "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO public
  USING (((select auth.uid()) = user_id));

SELECT pg_notify('pgrst', 'reload schema');
