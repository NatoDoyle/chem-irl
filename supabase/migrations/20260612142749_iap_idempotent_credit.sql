-- IAP idempotent crediting (launch-readiness T1.4 / audit C2 + C3).
--
-- The validate-receipt edge function used to credit tokens with a
-- read-modify-write upsert and no idempotency: a retried request (client
-- retry, restore-purchases replay, or two racing calls) could double-credit,
-- and nothing recorded which store transaction a credit came from.
--
--   1. iap_transactions — one row per store transaction ever credited.
--      UNIQUE (platform, transaction_id) is the idempotency key (Apple
--      transactionId / Google orderId, always taken from the VERIFIED
--      store response, never from the client). Deliberately NO foreign
--      keys: idempotency must survive account deletion (a consumed
--      transaction can never be replayed onto a fresh account), and a
--      non-cascading FK here would break delete-account's
--      auth.admin.deleteUser the same way tokens/token_transactions
--      originally did.
--   2. credit_tokens_for_purchase() — single-transaction RPC: claim the
--      idempotency key (INSERT … ON CONFLICT DO NOTHING); only if claimed,
--      atomically upsert the balance and append the token_transactions
--      ledger row (verified transaction id in reference_id). Concurrent
--      duplicates collapse to exactly one credit.
--
-- Service-role only: the RPC is called by the validate-receipt edge
-- function after store-side verification. Clients can never execute it.

CREATE TABLE IF NOT EXISTS public.iap_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Snapshot of the credited account; intentionally NOT a foreign key
  -- (see header).
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  transaction_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  tokens_credited INTEGER NOT NULL CHECK (tokens_credited > 0),
  -- 'Production' / 'Sandbox' (Apple), 'production' / 'test' (Google) —
  -- sandbox receipts are accepted by design (TestFlight and App Review
  -- both run in the sandbox environment) but recorded for auditability.
  store_environment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT iap_transactions_platform_tx_unique UNIQUE (platform, transaction_id)
);

-- System table: RLS on, no policies. Only the SECURITY DEFINER RPC below
-- and the service role touch it (same pattern as scoring_events /
-- enforcement_bans).
ALTER TABLE public.iap_transactions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.credit_tokens_for_purchase(
  p_user_id UUID,
  p_platform TEXT,
  p_transaction_id TEXT,
  p_product_id TEXT,
  p_amount INTEGER,
  p_store_environment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_platform NOT IN ('ios', 'android')
     OR p_transaction_id IS NULL OR length(trim(p_transaction_id)) = 0 THEN
    RAISE EXCEPTION 'credit_tokens_for_purchase: invalid arguments';
  END IF;
  -- Token packs top out at 25 today; 1000 is a sanity ceiling, not a tunable.
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000 THEN
    RAISE EXCEPTION 'credit_tokens_for_purchase: invalid amount %', p_amount;
  END IF;

  -- Claim the idempotency key. FOUND is false when the transaction was
  -- already credited (by this call's loser in a race, or a past request).
  INSERT INTO public.iap_transactions
    (user_id, platform, transaction_id, product_id, tokens_credited, store_environment)
  VALUES
    (p_user_id, p_platform, p_transaction_id, p_product_id, p_amount, p_store_environment)
  ON CONFLICT (platform, transaction_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT balance INTO v_balance FROM public.tokens WHERE user_id = p_user_id;
    RETURN jsonb_build_object('credited', false, 'new_balance', COALESCE(v_balance, 0));
  END IF;

  INSERT INTO public.tokens AS t (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = t.balance + EXCLUDED.balance,
        updated_at = now()
  RETURNING t.balance INTO v_balance;

  INSERT INTO public.token_transactions
    (user_id, amount, reason, reference_id, product_id, platform)
  VALUES
    (p_user_id, p_amount, 'purchase', p_transaction_id, p_product_id, p_platform);

  RETURN jsonb_build_object('credited', true, 'new_balance', v_balance);
END;
$$;

-- Callable by the service role only (validate-receipt edge function).
REVOKE ALL ON FUNCTION public.credit_tokens_for_purchase(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.credit_tokens_for_purchase(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_tokens_for_purchase(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

-- Reload PostgREST schema cache
SELECT pg_notify('pgrst', 'reload schema');
