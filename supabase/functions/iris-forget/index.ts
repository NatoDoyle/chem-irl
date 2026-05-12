// Supabase Edge Function: iris-forget
//
// GDPR Article 17 ("right to erasure") for the Iris feature plus its
// sibling photo-safety / identity-verification feature. The caller
// authenticates with their JWT and the function deletes everything we
// retained about that user across these AI surfaces:
//
//   * iris_memory                  — structured user knowledge + OCEAN scores
//   * iris_conversations           — every session this user ever had
//   * iris_messages                — cascade-deleted via FK ON DELETE CASCADE
//   * photo_verification_checks    — per-call moderation audit log
//   * profiles.verification_*      — denormalised verification status reset
//   * <uuid>/verification/*        — selfie objects in the `profiles` bucket
//
// What is intentionally NOT deleted by this endpoint:
//
//   * subscriptions    — IAP transaction state. Kept under the legitimate
//                        retention basis (tax / accounting). The user can
//                        cancel the subscription via App Store / Play and
//                        we let it lapse naturally; we don't expunge the
//                        original_transaction_id history.
//   * profiles, matches, messages, etc. — broader account deletion is
//                        out of scope here. A separate user-delete
//                        endpoint (not yet built) covers it. The
//                        verification_* columns on profiles ARE reset
//                        because those are AI-feature state.
//
// Auth: standard JWT (verify_jwt = true, the default). The function only
// ever deletes data for `auth.uid()` — there is no admin override path.
//
// Anthropic-side retention: API requests are retained on Anthropic's side
// per their default policy (~30 days). To shorten that, request Zero
// Data Retention (ZDR) on the project's Anthropic API key. The privacy
// policy in PR #63 names Anthropic as a sub-processor.
//
// Idempotent — calling repeatedly is a no-op (subsequent calls return
// counts of zero).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
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
    console.error('iris-forget: missing supabase env');
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

  // Service-role client: bypasses RLS for the actual deletes. The user_id
  // filter is enforced by the explicit .eq('user_id', user.id) on every
  // query — there is no path here that touches another user's rows.
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Delete conversations. iris_messages cascade-deletes via the FK
  //    declared in 20260501000001_iris_tables.sql:48 (ON DELETE CASCADE).
  //    We count messages first so the response can report what was wiped.
  const { count: messagesCount, error: messagesErr } = await admin
    .from('iris_messages')
    .select('id', { count: 'exact', head: true })
    .in(
      'conversation_id',
      // Subquery via two-step: list this user's conversation ids, then
      // filter messages by them. Doing a join inside the count call is
      // not supported by PostgREST head-only counts.
      (
        await admin
          .from('iris_conversations')
          .select('id')
          .eq('user_id', user.id)
      ).data?.map((r: { id: string }) => r.id) ?? [],
    );
  if (messagesErr) {
    console.error('iris-forget: messages count failed', messagesErr);
    // Non-fatal: proceed to deletion regardless.
  }

  const { count: conversationsDeleted, error: conversationsErr } = await admin
    .from('iris_conversations')
    .delete({ count: 'exact' })
    .eq('user_id', user.id);
  if (conversationsErr) {
    console.error('iris-forget: conversation delete failed', conversationsErr);
    return jsonResponse({ error: 'conversations_delete_failed' }, 500);
  }

  // 2. Delete the memory row.
  const { count: memoryDeleted, error: memoryErr } = await admin
    .from('iris_memory')
    .delete({ count: 'exact' })
    .eq('user_id', user.id);
  if (memoryErr) {
    console.error('iris-forget: memory delete failed', memoryErr);
    return jsonResponse({ error: 'memory_delete_failed' }, 500);
  }

  // 3. Delete photo-verification audit rows.
  const { count: verificationChecksDeleted, error: verifyChecksErr } = await admin
    .from('photo_verification_checks')
    .delete({ count: 'exact' })
    .eq('user_id', user.id);
  if (verifyChecksErr) {
    console.error('iris-forget: photo_verification_checks delete failed', verifyChecksErr);
    // Non-fatal: continue so we still wipe the selfie + reset status.
  }

  // 4. Remove selfie objects from storage. Supabase storage `remove`
  //    doesn't recurse a prefix, so we list-then-remove.
  let selfiesRemoved = 0;
  try {
    const { data: listing, error: listErr } = await admin.storage
      .from('profiles')
      .list(`${user.id}/verification`, { limit: 1000 });
    if (listErr) {
      console.error('iris-forget: selfie list failed', listErr);
    } else if (listing && listing.length > 0) {
      const paths = listing
        .filter((o: { name: string }) => typeof o.name === 'string' && o.name.length > 0)
        .map((o: { name: string }) => `${user.id}/verification/${o.name}`);
      if (paths.length > 0) {
        const { data: removed, error: removeErr } = await admin.storage
          .from('profiles')
          .remove(paths);
        if (removeErr) {
          console.error('iris-forget: selfie remove failed', removeErr);
        } else {
          selfiesRemoved = (removed as { name: string }[] | null)?.length ?? 0;
        }
      }
    }
  } catch (err) {
    console.error('iris-forget: selfie cleanup threw', err);
    // Non-fatal: continue.
  }

  // 5. Reset the denormalised verification state on profiles. We do NOT
  //    delete the profile row; that's broader account deletion (out of
  //    scope). We just clear the AI-feature columns back to defaults.
  const { error: profileResetErr } = await admin
    .from('profiles')
    .update({
      verification_status: 'unverified',
      verification_completed_at: null,
      verification_selfie_path: null,
    })
    .eq('id', user.id);
  if (profileResetErr) {
    console.error('iris-forget: profile verification reset failed', profileResetErr);
    // Non-fatal: storage + audit rows are already gone.
  }

  return jsonResponse(
    {
      ok: true,
      deleted: {
        conversations: conversationsDeleted ?? 0,
        // messagesCount is the count *before* the cascade fired; if the
        // pre-count call errored we report null rather than guess.
        messages: messagesErr ? null : messagesCount ?? 0,
        memory: memoryDeleted ?? 0,
        photo_verification_checks: verifyChecksErr ? null : verificationChecksDeleted ?? 0,
        verification_selfies: selfiesRemoved,
      },
      // What this endpoint does NOT touch — surfaced so the caller can
      // route the user to the right next step if they want to cancel
      // their subscription too.
      retained: ['subscriptions', 'profiles_core', 'matches', 'messages'],
    },
    200
  );
});

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
