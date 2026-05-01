-- ============================================================================
-- Migration: Chem Plus subscription state
-- Created:   2026-05-01
-- ============================================================================
-- The first subscription product on Chem IRL. Token consumables (existing
-- `tokens` / `token_transactions` tables) are unchanged — Chem Plus only gates
-- access to the Iris AI concierge.
--
-- v1 lifecycle:
--   trialing      — free 3-day server-side trial bootstrapped by iris_start_trial()
--   active        — current_period_ends_at > NOW(), validated against store
--   grace_period  — renewal failed, store grants ~16d grace before lapsing
--   expired       — past period end, no successful renewal
--   cancelled     — user cancelled; ride out current_period_ends_at
--
-- See: /Users/nathandoyle/.claude/plans/the-whole-premise-behind-purring-blossom.md
-- ============================================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  status TEXT NOT NULL,
  platform TEXT,
  original_transaction_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  current_period_ends_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
-- Writes only via service-role: validate-subscription edge function, plus
-- iris_start_trial() (SECURITY DEFINER) for the no-IAP trial path.

-- Idempotency for store-side renewal posts: same original_transaction_id ⇒
-- same row, regardless of how many times the receipt is replayed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_orig_tx
  ON subscriptions(original_transaction_id)
  WHERE original_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period
  ON subscriptions(status, current_period_ends_at);
