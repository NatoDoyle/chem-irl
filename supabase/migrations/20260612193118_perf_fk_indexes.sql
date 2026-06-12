-- Performance: cover the remaining unindexed foreign keys + drop one
-- duplicate index (launch-readiness T2.3, advisor-driven).
--
-- Source: Supabase performance advisors on 2026-06-12 reported exactly
-- five `unindexed_foreign_keys` findings and one `duplicate_index`.
-- Unindexed FKs hurt twice: every JOIN/filter on the column scans, and
-- every parent-row DELETE (we cascade heavily — see delete-account)
-- scans the child table per row.
--
-- messages.sender_id and confirms.confirmer_id sit on the core loop
-- (chat + date confirmation); the other three are cheap to cover now and
-- bring the advisor list to zero.

CREATE INDEX IF NOT EXISTS idx_confirms_confirmer_id
  ON public.confirms (confirmer_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_enforcements_case_id
  ON public.enforcements (case_id);

CREATE INDEX IF NOT EXISTS idx_surveys_user_id
  ON public.surveys (user_id);

CREATE INDEX IF NOT EXISTS idx_waitlist_referrals_referred_id
  ON public.waitlist_referrals (referred_id);

-- duplicate_index advisor: push_tokens carries two identical unique
-- indexes on expo_push_token. Keep the constraint-backed one
-- (push_tokens_expo_push_token_key); drop the redundant manual twin.
DROP INDEX IF EXISTS public.idx_push_tokens_expo_push_token_unique;
