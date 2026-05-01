-- ============================================================================
-- Migration: Iris RPCs — entitlement check, trial bootstrap, memory accessors
-- Created:   2026-05-01
-- ============================================================================
-- Depends on: 20260501000001_iris_tables.sql, 20260501000002_subscriptions.sql
--
-- Two surfaces:
--   * Client-callable (auth.uid()-derived):
--       iris_can_use()          — entitlement gate; safe to call anytime
--       iris_start_trial()      — idempotent 3-day trial bootstrap
--   * Service-role-only (parameter-driven):
--       iris_get_memory(uuid)   — read user memory for AI context
--       iris_apply_memory_patch(uuid, jsonb)
--                               — shallow-merge memory at session end
--
-- See: /Users/nathandoyle/.claude/plans/the-whole-premise-behind-purring-blossom.md
-- ============================================================================

-- ============================================================================
-- iris_can_use() — single source of truth for entitlement
-- ============================================================================
-- Returns shape:
--   { allowed: bool,
--     reason: 'unauthenticated' | 'never_subscribed' | 'trial' | 'subscribed' | 'expired',
--     trial_ends_at: timestamptz | null,
--     current_period_ends_at: timestamptz | null }
--
-- Mobile calls this before opening any Iris surface; the iris-chat edge
-- function calls it as the authenticated user via the user's JWT (not service
-- role) so the entitlement check is co-located with auth.

CREATE OR REPLACE FUNCTION iris_can_use()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sub RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'unauthenticated'
    );
  END IF;

  SELECT * INTO v_sub FROM subscriptions WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'never_subscribed'
    );
  END IF;

  -- Active trial
  IF v_sub.status = 'trialing' AND v_sub.trial_ends_at > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'trial',
      'trial_ends_at', v_sub.trial_ends_at,
      'current_period_ends_at', v_sub.current_period_ends_at
    );
  END IF;

  -- Active or grace-period subscription
  IF v_sub.status IN ('active', 'grace_period')
     AND v_sub.current_period_ends_at IS NOT NULL
     AND v_sub.current_period_ends_at > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'subscribed',
      'current_period_ends_at', v_sub.current_period_ends_at
    );
  END IF;

  -- Trial elapsed, subscription lapsed, or status indicates terminal state
  RETURN jsonb_build_object(
    'allowed', false,
    'reason', 'expired',
    'trial_ends_at', v_sub.trial_ends_at,
    'current_period_ends_at', v_sub.current_period_ends_at
  );
END;
$$;

-- ============================================================================
-- iris_start_trial() — idempotent 3-day server-side trial bootstrap
-- ============================================================================
-- v1 trade-off (see plan, Open Question 1): server-side trial without StoreKit
-- intro offer. No card auth, lower friction; revisit before scale.
--
-- Returns shape:
--   { success: bool, error?: text,
--     already_existed: bool,
--     status: 'trialing' | <existing>,
--     trial_ends_at: timestamptz,
--     current_period_ends_at: timestamptz | null }

CREATE OR REPLACE FUNCTION iris_start_trial()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_existing RECORD;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_existing FROM subscriptions WHERE user_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_existed', true,
      'status', v_existing.status,
      'trial_ends_at', v_existing.trial_ends_at,
      'current_period_ends_at', v_existing.current_period_ends_at
    );
  END IF;

  v_trial_ends := NOW() + INTERVAL '3 days';

  INSERT INTO subscriptions (
    user_id,
    product_id,
    status,
    trial_ends_at,
    last_validated_at
  ) VALUES (
    v_user_id,
    'chem_plus_monthly',
    'trialing',
    v_trial_ends,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_existed', false,
    'status', 'trialing',
    'trial_ends_at', v_trial_ends
  );
END;
$$;

-- ============================================================================
-- iris_get_memory(p_user_id) — service-role-only memory read
-- ============================================================================
-- Returns shape:
--   { facts: jsonb, ocean_scores: jsonb,
--     interview_completed_at: timestamptz | null, version: int }
-- Returns sensible defaults if the user has no memory row yet.

CREATE OR REPLACE FUNCTION iris_get_memory(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_memory RECORD;
BEGIN
  SELECT facts, ocean_scores, interview_completed_at, version
  INTO v_memory
  FROM iris_memory
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'facts', '{}'::jsonb,
      'ocean_scores', '{}'::jsonb,
      'interview_completed_at', NULL,
      'version', 1
    );
  END IF;

  RETURN jsonb_build_object(
    'facts', v_memory.facts,
    'ocean_scores', v_memory.ocean_scores,
    'interview_completed_at', v_memory.interview_completed_at,
    'version', v_memory.version
  );
END;
$$;

-- Lock down the function: PUBLIC is granted EXECUTE by default in Postgres.
-- Service-role bypasses these grants; anon/authenticated cannot reach it.
REVOKE EXECUTE ON FUNCTION iris_get_memory(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION iris_get_memory(UUID) FROM anon, authenticated;

-- ============================================================================
-- iris_apply_memory_patch(p_user_id, p_patch) — service-role-only memory write
-- ============================================================================
-- Patch shape:
--   { facts: jsonb,           -- shallow-merged into existing facts
--     ocean_scores: jsonb,    -- shallow-merged into existing scores
--     mark_interview_completed: bool  -- if true, set interview_completed_at }
--
-- v1 uses jsonb concatenation (||) for merge, which is a *shallow* merge: a
-- patch like `{values: [...]}` replaces the entire `values` key. The AI
-- extraction pass should always emit complete top-level keys to avoid losing
-- nested data. If we need deep-merge later, we can replace this with a
-- recursive jsonb merge function — keeping it shallow keeps v1 predictable.

CREATE OR REPLACE FUNCTION iris_apply_memory_patch(p_user_id UUID, p_patch jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_facts_patch JSONB := COALESCE(p_patch -> 'facts', '{}'::jsonb);
  v_scores_patch JSONB := COALESCE(p_patch -> 'ocean_scores', '{}'::jsonb);
  v_mark_completed BOOLEAN := COALESCE((p_patch ->> 'mark_interview_completed')::boolean, false);
BEGIN
  INSERT INTO iris_memory (
    user_id,
    facts,
    ocean_scores,
    interview_completed_at,
    updated_at
  ) VALUES (
    p_user_id,
    v_facts_patch,
    v_scores_patch,
    CASE WHEN v_mark_completed THEN NOW() ELSE NULL END,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET facts = iris_memory.facts || EXCLUDED.facts,
      ocean_scores = iris_memory.ocean_scores || EXCLUDED.ocean_scores,
      interview_completed_at = COALESCE(iris_memory.interview_completed_at, EXCLUDED.interview_completed_at),
      updated_at = NOW();
END;
$$;

REVOKE EXECUTE ON FUNCTION iris_apply_memory_patch(UUID, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION iris_apply_memory_patch(UUID, jsonb) FROM anon, authenticated;

-- ============================================================================
-- Reload PostgREST schema cache so the new RPCs are exposed via the API
-- ============================================================================

SELECT pg_notify('pgrst', 'reload schema');
