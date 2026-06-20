-- Supabase-native product analytics (launch-readiness T1.9; decision D1).
--
-- Decision: keep behavioural analytics in our own EU Postgres rather than a
-- third-party SDK, to minimise processor/transfer surface for a
-- privacy-sensitive dating app. Headline metrics (match/proposal/confirm
-- rates) already live in their own tables; this table adds the CLIENT-SIDE
-- funnel (onboarding step completion, screen actions) the launch-plan phase
-- gates need.
--
-- mobile/src/lib/analytics.ts -> trackEvent() inserts here in production.
-- Reads are operator-only via the service role / SQL dashboards (no user
-- SELECT policy). FK cascades on account deletion so analytics is erased
-- with the account (GDPR Art. 17) and delete-account's auth delete is never
-- blocked by this table.

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Authenticated users may INSERT only their own events. No SELECT/UPDATE/
-- DELETE policy: the operator reads via service role / SQL; users cannot
-- read or tamper with the event stream. (select auth.uid()) is the
-- initplan-friendly form (matches the F11 RLS convention).
CREATE POLICY analytics_events_insert_own ON public.analytics_events
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Dashboard access pattern: count/scan an event over time.
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created
  ON public.analytics_events (event, created_at DESC);
-- Covers the FK (efficient cascade delete + per-user export); avoids the
-- unindexed-foreign-key advisor finding.
CREATE INDEX IF NOT EXISTS idx_analytics_events_user
  ON public.analytics_events (user_id);

SELECT pg_notify('pgrst', 'reload schema');
