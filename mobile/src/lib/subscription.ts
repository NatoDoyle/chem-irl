// Subscription / Chem Plus entitlement helpers.
//
// All Iris-gated UI calls getEntitlement() before letting the user
// proceed. New users start with no row in `subscriptions`; tapping the
// trial CTA hits startTrial() which inserts a 3-day server-side trial.
// IAP-driven subscription is initiated from `iap.ts` and validated by
// the validate-subscription edge function.

import { supabase } from './supabase/client';
import type { IrisEntitlement, IrisTrialResult } from './iris/types';

interface IrisCanUseResponse {
  allowed: boolean;
  reason: IrisEntitlement['reason'];
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
}

interface IrisStartTrialResponse {
  success: boolean;
  error?: string;
  already_existed?: boolean;
  status?: IrisTrialResult['status'];
  trial_ends_at?: string | null;
  current_period_ends_at?: string | null;
}

const NEVER_SUBSCRIBED: IrisEntitlement = {
  allowed: false,
  reason: 'never_subscribed',
  trialEndsAt: null,
  currentPeriodEndsAt: null,
};

const UNAUTHENTICATED: IrisEntitlement = {
  allowed: false,
  reason: 'unauthenticated',
  trialEndsAt: null,
  currentPeriodEndsAt: null,
};

/**
 * Read the current user's Iris entitlement state. Calls the
 * iris_can_use() RPC, which derives the user from auth.uid().
 *
 * Returns NEVER_SUBSCRIBED rather than throwing on RPC errors so the UI
 * can default to "show paywall" instead of crashing — failing closed for
 * paid features.
 */
export async function getEntitlement(): Promise<IrisEntitlement> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    return UNAUTHENTICATED;
  }

  const { data, error } = await supabase.rpc('iris_can_use');
  if (error || !data) {
    if (__DEV__) {
      console.warn('getEntitlement: rpc failed', error);
    }
    return NEVER_SUBSCRIBED;
  }
  const row = data as IrisCanUseResponse;
  return {
    allowed: row.allowed === true,
    reason: row.reason,
    trialEndsAt: row.trial_ends_at ?? null,
    currentPeriodEndsAt: row.current_period_ends_at ?? null,
  };
}

/**
 * Start the 3-day server-side trial. Idempotent — calling twice does
 * not double the trial; the second call returns `alreadyExisted: true`
 * with the current state.
 */
export async function startTrial(): Promise<IrisTrialResult> {
  const { data, error } = await supabase.rpc('iris_start_trial');
  if (error || !data) {
    return {
      success: false,
      alreadyExisted: false,
      status: 'expired',
      trialEndsAt: null,
      currentPeriodEndsAt: null,
    };
  }
  const row = data as IrisStartTrialResponse;
  return {
    success: row.success === true,
    alreadyExisted: row.already_existed === true,
    status: row.status ?? 'trialing',
    trialEndsAt: row.trial_ends_at ?? null,
    currentPeriodEndsAt: row.current_period_ends_at ?? null,
  };
}

/**
 * Helper for the trial banner: how many full calendar days remain
 * before the trial ends? Returns 0 for an expired or absent trial.
 */
export function trialDaysRemaining(entitlement: IrisEntitlement): number {
  if (entitlement.reason !== 'trial' || !entitlement.trialEndsAt) return 0;
  const ends = Date.parse(entitlement.trialEndsAt);
  if (Number.isNaN(ends)) return 0;
  const ms = ends - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
