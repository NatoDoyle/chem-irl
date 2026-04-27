// Supabase Edge Function: Waitlist Forget (GDPR Article 17)
//
// Anonymous POST endpoint for the user to delete their waitlist row.
// Authenticates via the email_confirmation_token returned by the
// signup response (or sent in the confirmation email pre-confirmation).
//
// Wraps the SECURITY DEFINER RPC `forget_waitlist_signup`. The RPC
// hard-deletes the row + cascade-deletes any waitlist_referrals
// linking to it.
//
// v1 limitation: this only works for unconfirmed signups (token is
// nulled at confirmation). A v2 flow that emails a one-time delete
// link to the user's confirmed address is the next iteration. For
// now, post-confirmation deletes go through manual support.
//
// JWT verification disabled in supabase/config.toml — no client auth
// context (the token IS the auth).
//
// CORS is locked down to the production marketing domain plus Vercel
// preview deployments. Override via the `WAITLIST_ALLOWED_ORIGINS`
// Supabase secret (comma-separated) for local dev or staging origins.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_ALLOWED_ORIGINS = new Set<string>([
  'https://chemirl.app',
  'https://www.chemirl.app',
]);

const VERCEL_PREVIEW_RE =
  /^https:\/\/chem-irl(-[a-z0-9-]+)?-nathans-projects-[a-z0-9-]+\.vercel\.app$/;

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

function isAllowedOrigin(origin: string): boolean {
  if (DEFAULT_ALLOWED_ORIGINS.has(origin)) return true;
  if (VERCEL_PREVIEW_RE.test(origin)) return true;
  const extra = Deno.env.get('WAITLIST_ALLOWED_ORIGINS');
  if (extra) {
    for (const entry of extra.split(',')) {
      if (entry.trim() === origin) return true;
    }
  }
  return false;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const json = (body: unknown, status: number): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await safeJson(req);
    if (!body) {
      return json({ error: 'invalid_json' }, 400);
    }

    const token = String(body.token ?? '').trim();
    if (!token || token.length < 16 || token.length > 256) {
      return json({ error: 'invalid_token' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env');
      return json({ error: 'server_misconfigured' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await admin.rpc('forget_waitlist_signup', { p_token: token });

    if (error) {
      console.error('forget_waitlist_signup rpc failed:', error);
      return json({ error: 'rpc_failed' }, 500);
    }

    if (!data || data.success !== true) {
      const reason = typeof data?.error === 'string' ? data.error : 'forget_failed';
      // not_found / invalid_token from the RPC → 404; everything else → 400.
      const status = reason === 'not_found' ? 404 : 400;
      return json({ error: reason }, status);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error('waitlist-forget unhandled error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
