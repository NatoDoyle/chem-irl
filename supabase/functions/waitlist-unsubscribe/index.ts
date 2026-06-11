// Supabase Edge Function: Waitlist Marketing Unsubscribe
//
// Backs the List-Unsubscribe link in lifecycle emails (waitlist-nudge).
// The link carries the recipient address (base64url) plus an HMAC-SHA256
// signature (WAITLIST_UNSUB_SECRET) minted at send time — possession of a
// valid signature proves we emailed that address, so no auth context is
// needed and the endpoint cannot be used as an address oracle.
//
// GET  → human clicked the link: flip consent_marketing off, 302 to the
//        marketing site's /waitlist/unsubscribed page (edge functions must
//        redirect rather than render HTML — see CLAUDE.md).
// POST → RFC 8058 one-click (mail clients): same flip, 200 empty body.
//
// This withdraws marketing consent only — it is NOT erasure (that's
// waitlist-forget) and does not touch the signup, position, or referrals.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const UNSUB_PAGE = 'https://chemirl.app/waitlist/unsubscribed';

function fromB64url(input: string): string | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  } catch {
    return null;
  }
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const e = url.searchParams.get('e') ?? '';
  const sig = url.searchParams.get('sig') ?? '';

  const unsubSecret = Deno.env.get('WAITLIST_UNSUB_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!unsubSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('waitlist-unsubscribe: missing required env');
    return new Response('Server misconfigured', { status: 500 });
  }

  const email = e ? fromB64url(e)?.toLowerCase() ?? null : null;
  if (!email || !sig || email.length > 320) {
    return new Response('Invalid unsubscribe link', { status: 400 });
  }

  const expected = await hmacHex(unsubSecret, email);
  if (!timingSafeEqual(sig, expected)) {
    return new Response('Invalid unsubscribe link', { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await admin.rpc('waitlist_marketing_unsubscribe_v1', { p_email: email });
  if (error) {
    console.error('waitlist_marketing_unsubscribe_v1 failed:', error);
    return new Response('Something went wrong — try the link again.', { status: 500 });
  }

  if (req.method === 'POST') {
    // RFC 8058 one-click: mail client expects a quiet 200.
    return new Response(null, { status: 200 });
  }
  return Response.redirect(UNSUB_PAGE, 302);
});
