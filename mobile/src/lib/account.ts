// Account lifecycle helpers. Currently just deletion; sign-out is inlined
// in SettingsScreen because it has no extra steps beyond
// supabase.auth.signOut.

import { supabase } from './supabase/client';
import { addBreadcrumb } from './sentry';
import { trackEvent } from './analytics';

/**
 * Permanently delete the signed-in user's account.
 *
 * Calls the `delete-account` edge function (JWT-authenticated), which wipes
 * the `auth.users` row plus everything cascading from it (profiles, users,
 * matches, messages, subscriptions, iris_*, photo_verification_checks),
 * and explicitly clears the two token tables that don't cascade.
 *
 * On success, signs the user out — the root navigator's auth listener
 * will then route to AuthNavigator.
 *
 * Throws on edge-function failure (caller should surface via getErrorAlert).
 */
export async function deleteMyAccount(): Promise<void> {
  addBreadcrumb('Account deletion requested', 'auth', 'warning');

  const { data, error } = await supabase.functions.invoke('delete-account', {
    method: 'POST',
  });

  if (error) {
    throw new Error(error.message ?? 'Account deletion failed');
  }
  // The function returns 200 with `{ ok: true, ... }` on success. If we
  // ever get a 200 with an `error` field (the function's own error shape),
  // surface it.
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: string }).error));
  }

  trackEvent('account_deleted');
  await supabase.auth.signOut();
}
