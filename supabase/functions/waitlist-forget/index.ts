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

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
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

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function safeJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
