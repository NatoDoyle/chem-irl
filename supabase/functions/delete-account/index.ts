// Supabase Edge Function: delete-account
//
// Full account deletion for the authenticated caller. Wipes the user from
// auth.users (cascading anything connected via ON DELETE CASCADE — profiles,
// users, matches, messages, subscriptions, iris_*, photo_verification_checks,
// etc.) and explicitly clears the two token tables that lack a cascade FK.
//
// Auth: standard JWT (verify_jwt = true, the default). The function only
// ever deletes data for `auth.uid()`; there is no admin override path.
//
// Why explicit token cleanup? The `tokens` and `token_transactions` tables
// (supabase/migrations/20260326000001_match_expiry_tokens_feed_v3.sql) reference
// auth.users(id) WITHOUT ON DELETE CASCADE, so leaving them in place would
// cause the final auth.admin.deleteUser call to fail with a FK violation.
//
// What this differs from `iris-forget`: iris-forget is a feature-scoped
// erasure (Iris memory + verification selfies + AI columns) that leaves
// the account itself intact. delete-account is irreversible: the auth row
// and everything cascading off it is gone.
//
// Out of scope / known limitations:
//   * Anthropic API request retention (~30 days by default unless ZDR is on
//     the project's API key) — same caveat noted in iris-forget.
//   * App Store / Play Store subscription cancellation must still be done
//     by the user via the platform. We surface this in the client confirm.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type EdgeHandler, logEvent, withObservability } from '../_shared/observability.ts';

const handler: EdgeHandler = async (req, ctx) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('delete-account: missing supabase env');
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // Recorded before the row disappears: the UUID is pseudonymous and this
  // is the durable "account deleted" event in telemetry (the DB cascade
  // erases everything else).
  ctx.user_id = user.id;

  // Service-role client bypasses RLS. Every query below is scoped to
  // `user.id` (the verified caller); there is no path to another user's data.
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. token_transactions — REFERENCES auth.users(id) without ON DELETE CASCADE.
  const { error: txErr } = await admin
    .from('token_transactions')
    .delete()
    .eq('user_id', user.id);
  if (txErr) {
    console.error('delete-account: token_transactions delete failed', txErr);
    logEvent('error', 'account_delete_failed', ctx, { step: 'token_transactions' });
    return jsonResponse({ error: 'token_transactions_delete_failed' }, 500);
  }

  // 2. tokens (balance) — REFERENCES auth.users(id) without ON DELETE CASCADE.
  const { error: balErr } = await admin.from('tokens').delete().eq('user_id', user.id);
  if (balErr) {
    console.error('delete-account: tokens delete failed', balErr);
    logEvent('error', 'account_delete_failed', ctx, { step: 'tokens' });
    return jsonResponse({ error: 'tokens_delete_failed' }, 500);
  }

  // 3. Storage cleanup (best-effort). Photos live at `profiles/{user_id}/*`
  //    and verification selfies at `profiles/{user_id}/verification/*`.
  //    Storage `remove` doesn't recurse a prefix, so we list-then-remove.
  const storageRemoved = await purgeUserStorage(admin, user.id);

  // 4. Delete the auth user. Cascades through profiles → matches → messages
  //    → proposals → confirms → likes → subscriptions → iris_* → etc.
  const { error: authDeleteErr } = await admin.auth.admin.deleteUser(user.id);
  if (authDeleteErr) {
    console.error('delete-account: auth user delete failed', authDeleteErr);
    logEvent('error', 'account_delete_failed', ctx, { step: 'auth_delete' });
    return jsonResponse(
      { error: 'auth_delete_failed', details: authDeleteErr.message },
      500
    );
  }

  logEvent('info', 'account_delete_result', ctx, {
    storage_objects_removed: storageRemoved,
  });
  return jsonResponse({ ok: true, storage_objects_removed: storageRemoved }, 200);
};

serve(withObservability(handler, { name: 'delete-account' }));

/**
 * Remove every object under `profiles/{userId}/` and `profiles/{userId}/verification/`.
 * Best-effort: failures here are logged but don't abort the deletion, because
 * orphaned storage objects are a tolerable outcome (still no broken FK) and
 * the user expects the account to be gone.
 */
async function purgeUserStorage(admin: SupabaseClient, userId: string): Promise<number> {
  let removed = 0;
  try {
    const subfolders = ['', 'verification'];
    for (const sub of subfolders) {
      const prefix = sub ? `${userId}/${sub}` : userId;
      const { data: listing, error: listErr } = await admin.storage
        .from('profiles')
        .list(prefix, { limit: 1000 });
      if (listErr) {
        console.error(`delete-account: storage list failed for ${prefix}`, listErr);
        continue;
      }
      if (!listing || listing.length === 0) continue;

      const paths = listing
        .filter((o) => typeof o.name === 'string' && o.name.length > 0)
        // Skip entries that are themselves folders (storage `list` reports
        // them with id=null). Folders can't be passed to `remove`.
        .filter((o) => (o as { id: string | null }).id !== null)
        .map((o) => `${prefix}/${o.name}`);

      if (paths.length === 0) continue;

      const { data: removedList, error: removeErr } = await admin.storage
        .from('profiles')
        .remove(paths);
      if (removeErr) {
        console.error(`delete-account: storage remove failed for ${prefix}`, removeErr);
        continue;
      }
      removed += (removedList as { name: string }[] | null)?.length ?? 0;
    }
  } catch (err) {
    console.error('delete-account: storage cleanup threw', err);
  }
  return removed;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
