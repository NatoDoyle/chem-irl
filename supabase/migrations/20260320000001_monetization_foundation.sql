-- Monetization Foundation: Bonds, Credit Actions, Subscriptions
--
-- Implements the "Free to Be Serious" monetization model:
--   - Seriousness Bonds: per-match deposit, returned on follow-through
--   - Second Chance Credits: undo mechanical consequences (revive, undo_pass, reschedule)
--   - Subscriptions: toolkit subscription tracking
--
-- See docs/monetization-strategy.md for full strategy reference.

-- ============================================================================
-- STEP 1: Extend credit_feature enum with new credit actions
-- ============================================================================
-- ALTER TYPE ADD VALUE cannot run inside a transaction, so we insert directly
-- into pg_enum. This is the standard workaround for Supabase migrations.

INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
SELECT t.oid, 'revive',
  (SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = t.oid)
FROM pg_type t
WHERE t.typname = 'credit_feature'
  AND NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = t.oid AND enumlabel = 'revive'
  );

INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
SELECT t.oid, 'undo_pass',
  (SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = t.oid)
FROM pg_type t
WHERE t.typname = 'credit_feature'
  AND NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = t.oid AND enumlabel = 'undo_pass'
  );

INSERT INTO pg_enum (enumtypid, enumlabel, enumsortorder)
SELECT t.oid, 'reschedule',
  (SELECT MAX(enumsortorder) + 1 FROM pg_enum WHERE enumtypid = t.oid)
FROM pg_type t
WHERE t.typname = 'credit_feature'
  AND NOT EXISTS (
    SELECT 1 FROM pg_enum WHERE enumtypid = t.oid AND enumlabel = 'reschedule'
  );

-- ============================================================================
-- STEP 2: bonds_ledger table
-- ============================================================================
-- Tracks all bond movements. Balance = SUM(delta) for a user.
-- Reasons: initial_grant, weekly_replenish, purchase, match_consume,
--          proposal_return, confirm_return, date_return, noshow_forfeit

CREATE TABLE bonds_ledger (
  entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  match_id UUID REFERENCES matches(match_id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bonds_ledger_user_id ON bonds_ledger(user_id);
CREATE INDEX idx_bonds_ledger_user_match_reason ON bonds_ledger(user_id, match_id, reason);

ALTER TABLE bonds_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bonds" ON bonds_ledger
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage bonds" ON bonds_ledger
  FOR ALL USING (true);

-- ============================================================================
-- STEP 3: subscriptions table
-- ============================================================================

CREATE TABLE subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'toolkit',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  platform TEXT NOT NULL
    CHECK (platform IN ('ios', 'android', 'web')),
  platform_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage subscriptions" ON subscriptions
  FOR ALL USING (true);

-- ============================================================================
-- STEP 4: passes table (needed for undo_pass credit action)
-- ============================================================================

CREATE TABLE passes (
  pass_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  passee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(passer_id, passee_id)
);

CREATE INDEX idx_passes_passer_id ON passes(passer_id);

ALTER TABLE passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own passes" ON passes
  FOR SELECT USING (auth.uid() = passer_id);

CREATE POLICY "Users can insert own passes" ON passes
  FOR INSERT WITH CHECK (auth.uid() = passer_id);

CREATE POLICY "System can manage passes" ON passes
  FOR ALL USING (true);

-- ============================================================================
-- STEP 5: cancellations table (needed for reschedule credit action)
-- ============================================================================

CREATE TABLE cancellations (
  cancellation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  confirm_id UUID NOT NULL REFERENCES confirms(confirm_id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  cancelled_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  is_late BOOLEAN NOT NULL DEFAULT FALSE,
  rescheduled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cancellations_match_id ON cancellations(match_id);
CREATE INDEX idx_cancellations_cancelled_by ON cancellations(cancelled_by);

ALTER TABLE cancellations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cancellations in their matches" ON cancellations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.match_id = cancellations.match_id
        AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "System can manage cancellations" ON cancellations
  FOR ALL USING (true);

-- ============================================================================
-- STEP 6: Bond management RPCs
-- ============================================================================

-- 6a. Get user's current bond balance
CREATE OR REPLACE FUNCTION get_user_bonds(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  RETURN COALESCE(
    (SELECT SUM(delta) FROM bonds_ledger WHERE user_id = p_user_id),
    0
  )::INTEGER;
END;
$$;

-- 6b. Grant initial bonds on user signup (trigger function)
CREATE OR REPLACE FUNCTION grant_initial_bonds()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO bonds_ledger (user_id, delta, reason)
  VALUES (NEW.user_id, 5, 'initial_grant');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_grant_initial_bonds
AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION grant_initial_bonds();

-- 6c. Weekly bond replenishment (cron function)
-- Adds up to 3 bonds for active users, capping balance at 5.
CREATE OR REPLACE FUNCTION replenish_weekly_bonds()
RETURNS TABLE(replenished_count INTEGER, message TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO bonds_ledger (user_id, delta, reason)
  SELECT
    u.user_id,
    LEAST(3, 5 - COALESCE(b.balance, 0)),
    'weekly_replenish'
  FROM users u
  LEFT JOIN (
    SELECT bl.user_id, SUM(bl.delta)::INTEGER AS balance
    FROM bonds_ledger bl
    GROUP BY bl.user_id
  ) b ON b.user_id = u.user_id
  WHERE COALESCE(b.balance, 0) < 5
    AND u.last_active_at >= NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT
    v_count,
    format('Replenished bonds for %s users', v_count)::TEXT;
END;
$$;

-- ============================================================================
-- STEP 7: Bond lifecycle triggers
-- ============================================================================

-- 7a. Return sender's bond when they send a proposal (follow-through)
CREATE OR REPLACE FUNCTION return_bond_on_proposal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Idempotent: only return if not already returned for this match
  IF NOT EXISTS (
    SELECT 1 FROM bonds_ledger
    WHERE user_id = NEW.sender_id
      AND match_id = NEW.match_id
      AND reason = 'proposal_return'
  ) THEN
    INSERT INTO bonds_ledger (user_id, delta, match_id, reason)
    VALUES (NEW.sender_id, 1, NEW.match_id, 'proposal_return');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_return_bond_on_proposal
AFTER INSERT ON proposals FOR EACH ROW EXECUTE FUNCTION return_bond_on_proposal();

-- 7b. Return confirmer's bond when they respond to a proposal (follow-through)
CREATE OR REPLACE FUNCTION return_bond_on_confirm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Idempotent: only return if not already returned for this match
  IF NOT EXISTS (
    SELECT 1 FROM bonds_ledger
    WHERE user_id = NEW.confirmer_id
      AND match_id = NEW.match_id
      AND reason = 'confirm_return'
  ) THEN
    INSERT INTO bonds_ledger (user_id, delta, match_id, reason)
    VALUES (NEW.confirmer_id, 1, NEW.match_id, 'confirm_return');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_return_bond_on_confirm
AFTER INSERT ON confirms FOR EACH ROW EXECUTE FUNCTION return_bond_on_confirm();

-- 7c. Return bonds on date attendance / forfeit on no-show
-- When a user submits a survey: went=true returns their bond (if not already),
-- went=false forfeits it (reverses any prior return).
CREATE OR REPLACE FUNCTION handle_bond_on_survey()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_a UUID;
  v_user_b UUID;
  v_has_return BOOLEAN;
BEGIN
  IF NEW.went THEN
    -- Date attended: return both users' bonds if not already returned
    SELECT user_a, user_b INTO v_user_a, v_user_b
    FROM matches WHERE match_id = NEW.match_id;

    -- Return for user_a if no prior return exists
    IF NOT EXISTS (
      SELECT 1 FROM bonds_ledger
      WHERE user_id = v_user_a AND match_id = NEW.match_id
        AND reason IN ('proposal_return', 'confirm_return', 'date_return')
    ) THEN
      INSERT INTO bonds_ledger (user_id, delta, match_id, reason)
      VALUES (v_user_a, 1, NEW.match_id, 'date_return');
    END IF;

    -- Return for user_b if no prior return exists
    IF NOT EXISTS (
      SELECT 1 FROM bonds_ledger
      WHERE user_id = v_user_b AND match_id = NEW.match_id
        AND reason IN ('proposal_return', 'confirm_return', 'date_return')
    ) THEN
      INSERT INTO bonds_ledger (user_id, delta, match_id, reason)
      VALUES (v_user_b, 1, NEW.match_id, 'date_return');
    END IF;
  ELSE
    -- No-show: if this user's bond was previously returned, reverse it
    SELECT EXISTS (
      SELECT 1 FROM bonds_ledger
      WHERE user_id = NEW.user_id AND match_id = NEW.match_id
        AND reason IN ('proposal_return', 'confirm_return', 'date_return')
    ) INTO v_has_return;

    IF v_has_return AND NOT EXISTS (
      SELECT 1 FROM bonds_ledger
      WHERE user_id = NEW.user_id AND match_id = NEW.match_id
        AND reason = 'noshow_forfeit'
    ) THEN
      INSERT INTO bonds_ledger (user_id, delta, match_id, reason)
      VALUES (NEW.user_id, -1, NEW.match_id, 'noshow_forfeit');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_handle_bond_on_survey
AFTER INSERT ON surveys FOR EACH ROW EXECUTE FUNCTION handle_bond_on_survey();

-- ============================================================================
-- STEP 8: Bond-gated match creation (v2)
-- ============================================================================
-- Liker must have >= 1 bond to like. On mutual match, both users consume 1 bond.
-- Likee may go negative if they spent bonds since their original like.

CREATE OR REPLACE FUNCTION create_like_and_check_match_v2(p_liker UUID, p_likee UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_like_id UUID;
  v_mutual BOOLEAN;
  v_match_id UUID;
  v_liker_bonds INTEGER;
BEGIN
  -- Auth
  IF auth.uid() IS NULL OR auth.uid() != p_liker THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the liker';
  END IF;

  IF p_liker = p_likee THEN
    RAISE EXCEPTION 'Invalid: cannot like yourself';
  END IF;

  -- Bond gate: liker must have >= 1 bond
  SELECT COALESCE(SUM(delta), 0) INTO v_liker_bonds
  FROM bonds_ledger WHERE user_id = p_liker;

  IF v_liker_bonds < 1 THEN
    RETURN jsonb_build_object(
      'like_id', NULL,
      'matched', false,
      'match_id', NULL,
      'error', 'insufficient_bonds',
      'bond_balance', v_liker_bonds
    );
  END IF;

  -- Insert like
  INSERT INTO likes (liker_id, likee_id)
  VALUES (p_liker, p_likee)
  ON CONFLICT (liker_id, likee_id) DO NOTHING
  RETURNING like_id INTO v_like_id;

  -- Duplicate like: return existing state
  IF v_like_id IS NULL THEN
    SELECT like_id INTO v_like_id
    FROM likes WHERE liker_id = p_liker AND likee_id = p_likee;

    SELECT EXISTS (
      SELECT 1 FROM matches
      WHERE ((user_a = p_liker AND user_b = p_likee)
          OR (user_a = p_likee AND user_b = p_liker))
        AND status = 'open'
    ) INTO v_mutual;

    RETURN jsonb_build_object(
      'like_id', v_like_id,
      'matched', v_mutual,
      'match_id', NULL
    );
  END IF;

  -- Check for mutual like
  SELECT EXISTS (
    SELECT 1 FROM likes WHERE liker_id = p_likee AND likee_id = p_liker
  ) INTO v_mutual;

  IF v_mutual THEN
    -- Create match
    INSERT INTO matches (user_a, user_b, status)
    VALUES (LEAST(p_liker, p_likee), GREATEST(p_liker, p_likee), 'open')
    ON CONFLICT (user_a, user_b) DO UPDATE SET status = 'open'
    RETURNING match_id INTO v_match_id;

    -- Consume 1 bond from each user
    INSERT INTO bonds_ledger (user_id, delta, match_id, reason) VALUES
      (p_liker, -1, v_match_id, 'match_consume'),
      (p_likee, -1, v_match_id, 'match_consume');

    RETURN jsonb_build_object(
      'like_id', v_like_id,
      'matched', true,
      'match_id', v_match_id
    );
  END IF;

  -- No match yet
  RETURN jsonb_build_object(
    'like_id', v_like_id,
    'matched', false,
    'match_id', NULL
  );
END;
$$;

-- ============================================================================
-- STEP 9: Stale match expiry
-- ============================================================================
-- Extends stale match detection to also expire the match status,
-- enabling the revive_stale_match credit action.

CREATE OR REPLACE FUNCTION expire_stale_matches()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE matches
  SET status = 'expired'
  WHERE status = 'open'
    AND created_at < NOW() - INTERVAL '72 hours'
    AND NOT EXISTS (
      SELECT 1 FROM proposals p WHERE p.match_id = matches.match_id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Schedule stale match expiry at 00:10 UTC daily (after scoring events at 00:05)
SELECT cron.schedule(
  'expire_stale_matches_daily',
  '10 0 * * *',
  $$SELECT expire_stale_matches();$$
);

-- Schedule weekly bond replenishment (Mondays at 00:15 UTC)
SELECT cron.schedule(
  'replenish_bonds_weekly',
  '15 0 * * 1',
  $$SELECT replenish_weekly_bonds();$$
);

-- ============================================================================
-- STEP 10: Generic credit spending helper
-- ============================================================================

CREATE OR REPLACE FUNCTION spend_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_feature credit_feature,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  IF p_amount < 1 THEN
    RAISE EXCEPTION 'Invalid: amount must be positive';
  END IF;

  -- Check balance
  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM credits_ledger WHERE user_id = p_user_id;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_balance,
      'required', p_amount
    );
  END IF;

  -- Deduct credits
  INSERT INTO credits_ledger (user_id, delta, feature, description)
  VALUES (p_user_id, -p_amount, p_feature, p_description);

  RETURN jsonb_build_object(
    'success', true,
    'balance', v_balance - p_amount
  );
END;
$$;

-- ============================================================================
-- STEP 11: Credit action — Revive stale match (2 credits)
-- ============================================================================
-- The inactive party pays to reopen an expired (stale) match.

CREATE OR REPLACE FUNCTION revive_stale_match(p_user_id UUID, p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_match RECORD;
  v_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  -- Verify match exists, is expired, and user is a participant
  SELECT * INTO v_match FROM matches
  WHERE match_id = p_match_id
    AND status = 'expired'
    AND (user_a = p_user_id OR user_b = p_user_id);

  IF v_match IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'match_not_found_or_not_expired'
    );
  END IF;

  -- Check and spend 2 credits
  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM credits_ledger WHERE user_id = p_user_id;

  IF v_balance < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_balance,
      'required', 2
    );
  END IF;

  INSERT INTO credits_ledger (user_id, delta, feature, description)
  VALUES (p_user_id, -2, 'revive',
    format('Revive stale match %s', p_match_id));

  -- Reopen the match
  UPDATE matches SET status = 'open' WHERE match_id = p_match_id;

  -- Emit scoring event for tracking (score penalty from stale already applied — not reversed)
  INSERT INTO scoring_events (user_id, event_type, payload)
  VALUES (p_user_id, 'match_revived',
    jsonb_build_object('match_id', p_match_id));

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'credits_remaining', v_balance - 2
  );
END;
$$;

-- ============================================================================
-- STEP 12: Credit action — Reopen expired proposal (2 credits)
-- ============================================================================
-- The receiver (who was slow to respond) pays to reopen.
-- Proposal status changes to 'reopened'. Receiver then creates their own proposal.

CREATE OR REPLACE FUNCTION reopen_expired_proposal(p_user_id UUID, p_proposal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proposal RECORD;
  v_balance INTEGER;
  v_is_receiver BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  -- Get the expired proposal
  SELECT p.*, m.user_a, m.user_b INTO v_proposal
  FROM proposals p
  JOIN matches m ON m.match_id = p.match_id
  WHERE p.proposal_id = p_proposal_id
    AND p.status = 'expired';

  IF v_proposal IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'proposal_not_found_or_not_expired'
    );
  END IF;

  -- Caller must be the receiver (not the sender)
  v_is_receiver := (p_user_id != v_proposal.sender_id)
    AND (p_user_id = v_proposal.user_a OR p_user_id = v_proposal.user_b);

  IF NOT v_is_receiver THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'only_receiver_can_reopen'
    );
  END IF;

  -- Check and spend 2 credits
  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM credits_ledger WHERE user_id = p_user_id;

  IF v_balance < 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_balance,
      'required', 2
    );
  END IF;

  INSERT INTO credits_ledger (user_id, delta, feature, description)
  VALUES (p_user_id, -2, 'reopen',
    format('Reopen expired proposal %s', p_proposal_id));

  -- Mark proposal as reopened
  UPDATE proposals SET status = 'reopened' WHERE proposal_id = p_proposal_id;

  -- Ensure match is still open
  UPDATE matches SET status = 'open' WHERE match_id = v_proposal.match_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposal_id', p_proposal_id,
    'match_id', v_proposal.match_id,
    'credits_remaining', v_balance - 2
  );
END;
$$;

-- ============================================================================
-- STEP 13: Credit action — Undo pass (1 credit)
-- ============================================================================
-- Delete the pass record so the profile reappears in the feed.
-- The other person still has to like you back.

CREATE OR REPLACE FUNCTION record_pass(p_passer_id UUID, p_passee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pass_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_passer_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the passer';
  END IF;

  INSERT INTO passes (passer_id, passee_id)
  VALUES (p_passer_id, p_passee_id)
  ON CONFLICT (passer_id, passee_id) DO NOTHING
  RETURNING pass_id INTO v_pass_id;

  RETURN jsonb_build_object('pass_id', COALESCE(v_pass_id, (
    SELECT pass_id FROM passes
    WHERE passer_id = p_passer_id AND passee_id = p_passee_id
  )));
END;
$$;

CREATE OR REPLACE FUNCTION undo_pass(p_user_id UUID, p_passee_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  -- Verify pass exists
  IF NOT EXISTS (
    SELECT 1 FROM passes
    WHERE passer_id = p_user_id AND passee_id = p_passee_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'pass_not_found'
    );
  END IF;

  -- Check and spend 1 credit
  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM credits_ledger WHERE user_id = p_user_id;

  IF v_balance < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_balance,
      'required', 1
    );
  END IF;

  INSERT INTO credits_ledger (user_id, delta, feature, description)
  VALUES (p_user_id, -1, 'undo_pass',
    format('Undo pass on user %s', p_passee_id));

  -- Delete the pass
  DELETE FROM passes
  WHERE passer_id = p_user_id AND passee_id = p_passee_id;

  RETURN jsonb_build_object(
    'success', true,
    'credits_remaining', v_balance - 1
  );
END;
$$;

-- ============================================================================
-- STEP 14: Credit action — Reschedule after late cancel (1 credit)
-- ============================================================================
-- User cancelled < 24h before a confirmed date. Reliability score -5 still applies.
-- Paying 1 credit allows them to send a new proposal.

CREATE OR REPLACE FUNCTION cancel_confirmed_date(
  p_user_id UUID,
  p_confirm_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_confirm RECORD;
  v_chosen_start TIMESTAMPTZ;
  v_is_late BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  -- Get confirm details
  SELECT c.*, m.user_a, m.user_b INTO v_confirm
  FROM confirms c
  JOIN matches m ON m.match_id = c.match_id
  WHERE c.confirm_id = p_confirm_id
    AND (m.user_a = p_user_id OR m.user_b = p_user_id);

  IF v_confirm IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'confirm_not_found'
    );
  END IF;

  -- Already cancelled?
  IF EXISTS (
    SELECT 1 FROM cancellations WHERE confirm_id = p_confirm_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'already_cancelled'
    );
  END IF;

  -- Determine if late (< 24h before chosen window start)
  v_chosen_start := (v_confirm.chosen_window->>'start')::TIMESTAMPTZ;
  v_is_late := (v_chosen_start - NOW()) < INTERVAL '24 hours';

  -- Record cancellation
  INSERT INTO cancellations (confirm_id, match_id, cancelled_by, is_late)
  VALUES (p_confirm_id, v_confirm.match_id, p_user_id, v_is_late);

  -- Emit scoring event (reliability penalty applied by compute_user_scores)
  INSERT INTO scoring_events (user_id, event_type, payload)
  VALUES (p_user_id,
    CASE WHEN v_is_late THEN 'honest_cancel_under_24h' ELSE 'honest_cancel_24h' END,
    jsonb_build_object(
      'match_id', v_confirm.match_id,
      'confirm_id', p_confirm_id,
      'hours_before_date', EXTRACT(EPOCH FROM (v_chosen_start - NOW())) / 3600.0
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_late', v_is_late,
    'match_id', v_confirm.match_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION reschedule_after_late_cancel(
  p_user_id UUID,
  p_match_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cancellation RECORD;
  v_balance INTEGER;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  -- Verify a late cancellation exists by this user for this match
  SELECT * INTO v_cancellation
  FROM cancellations
  WHERE match_id = p_match_id
    AND cancelled_by = p_user_id
    AND is_late = TRUE
    AND rescheduled = FALSE
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cancellation IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_late_cancellation_found'
    );
  END IF;

  -- Check and spend 1 credit
  SELECT COALESCE(SUM(delta), 0) INTO v_balance
  FROM credits_ledger WHERE user_id = p_user_id;

  IF v_balance < 1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_credits',
      'balance', v_balance,
      'required', 1
    );
  END IF;

  INSERT INTO credits_ledger (user_id, delta, feature, description)
  VALUES (p_user_id, -1, 'reschedule',
    format('Reschedule after late cancel on match %s', p_match_id));

  -- Mark cancellation as rescheduled
  UPDATE cancellations
  SET rescheduled = TRUE
  WHERE cancellation_id = v_cancellation.cancellation_id;

  -- Ensure match is open for new proposal
  UPDATE matches SET status = 'open' WHERE match_id = p_match_id;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'credits_remaining', v_balance - 1
  );
END;
$$;

-- ============================================================================
-- STEP 15: Subscription helper
-- ============================================================================

CREATE OR REPLACE FUNCTION is_subscriber(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: caller must be the user';
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND current_period_end > NOW()
  );
END;
$$;

-- ============================================================================
-- STEP 16: Update discovery feed to exclude passed profiles
-- ============================================================================
-- Creates v3 that adds pass exclusion on top of v2's composite score ranking.

CREATE OR REPLACE FUNCTION get_discovery_feed_v3(p_viewer UUID, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  headline TEXT,
  bio TEXT,
  availability_summary TEXT,
  action_speed INTEGER,
  attractiveness INTEGER,
  reliability INTEGER,
  composite_score NUMERIC
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_result RECORD;
BEGIN
  FOR v_result IN
    SELECT
      p.user_id,
      COALESCE(p.prompts ->> 'headline', '') AS headline,
      COALESCE(p.prompts ->> 'bio', '') AS bio,
      COALESCE(p.availability ->> 'summary', '') AS availability_summary,
      COALESCE(s.action_speed, 50) AS action_speed,
      COALESCE(s.profile_quality, 50) AS attractiveness,
      COALESCE(s.reliability, 70) AS reliability,
      (0.60 * COALESCE(s.action_speed, 50)
       + 0.30 * COALESCE(s.profile_quality, 50)
       + 0.10 * COALESCE(s.reliability, 70))::NUMERIC AS composite_score
    FROM profiles p
    LEFT JOIN scores_daily s ON s.user_id = p.user_id AND s.day = CURRENT_DATE
    WHERE p.user_id <> p_viewer
      AND p.completion_pct >= 80
      -- Exclude already liked
      AND NOT EXISTS (
        SELECT 1 FROM likes l WHERE l.liker_id = p_viewer AND l.likee_id = p.user_id
      )
      -- Exclude already matched
      AND NOT EXISTS (
        SELECT 1 FROM matches m
        WHERE ((m.user_a = p_viewer AND m.user_b = p.user_id)
            OR (m.user_a = p.user_id AND m.user_b = p_viewer))
          AND m.status = 'open'
      )
      -- Exclude passed profiles
      AND NOT EXISTS (
        SELECT 1 FROM passes ps WHERE ps.passer_id = p_viewer AND ps.passee_id = p.user_id
      )
    ORDER BY composite_score DESC, p.updated_at DESC
    LIMIT p_limit
  LOOP
    -- Emit feed impression
    INSERT INTO scoring_events (user_id, event_type, payload)
    VALUES (v_result.user_id, 'feed_impression', jsonb_build_object('viewer_id', p_viewer));

    user_id := v_result.user_id;
    headline := v_result.headline;
    bio := v_result.bio;
    availability_summary := v_result.availability_summary;
    action_speed := v_result.action_speed;
    attractiveness := v_result.attractiveness;
    reliability := v_result.reliability;
    composite_score := v_result.composite_score;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ============================================================================
-- STEP 17: Notify PostgREST to reload schema cache
-- ============================================================================

SELECT pg_notify('pgrst', 'reload schema');
