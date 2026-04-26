// Supabase Edge Function: Waitlist Signup
//
// Anonymous POST endpoint called by the static marketing site
// (web/src/app/download — and a forthcoming web/src/components/WaitlistForm.tsx)
// to register a Dublin waitlist signup. Wraps the SECURITY DEFINER RPC
// `claim_waitlist_signup` (granted only to service_role) and returns the
// caller's position + referral_code.
//
// JWT verification is disabled in supabase/config.toml ([functions.waitlist-signup]).
// CORS is permissive for now — Week 7 hardening will restrict the origin
// to the production marketing domain.
//
// Week 1 scope (this file): no email sending. The RPC returns an
// email_confirmation_token; we throw it away here and send an email in
// the Week 2 follow-up that adds Resend integration.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_AGE_BANDS = ['18-21', '22-26', '27-31', '32-36', '37-44', '45+'];
const ALLOWED_GENDERS = ['female', 'male', 'nonbinary', 'prefer_not_to_say'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Honeypot: bots auto-fill hidden fields; real users never see them.
    // Pretend success so the bot can't probe the difference.
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      return json(
        { success: true, was_new: true, position: 0, referral_code: '', email_confirmed: false },
        200,
      );
    }

    // --- Required fields ---
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase();
    const consent_privacy = body.consent_privacy === true;

    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      return json({ error: 'invalid_email' }, 400);
    }
    if (!consent_privacy) {
      return json({ error: 'consent_required' }, 400);
    }

    // --- Optional fields (whitelist + length-clamp; the DB CHECK constraints
    //     also enforce these but we fail fast at the edge) ---
    const first_name = clampStr(body.first_name, 80);
    const age_band = ALLOWED_AGE_BANDS.includes(body.age_band) ? body.age_band : null;
    const gender = ALLOWED_GENDERS.includes(body.gender) ? body.gender : null;
    // City is locked to dublin in the schema CHECK; ignore any other input.
    const city = 'dublin';
    const why_signup = clampStr(body.why_signup, 500);
    const referred_by_code = clampStr(body.referred_by_code, 32);
    const consent_marketing = body.consent_marketing === true;

    // --- Request fingerprint (no raw IP stored) ---
    const ipRaw = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
    const ipHash = ipRaw ? await sha256Hex(ipRaw) : null;
    const userAgent = clampStr(req.headers.get('user-agent'), 500);

    // --- Call the SECURITY DEFINER RPC via service-role client ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env');
      return json({ error: 'server_misconfigured' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await admin.rpc('claim_waitlist_signup', {
      p_email: email,
      p_first_name: first_name,
      p_age_band: age_band,
      p_gender: gender,
      p_city: city,
      p_why_signup: why_signup,
      p_referred_by_code: referred_by_code,
      p_consent_marketing: consent_marketing,
      p_consent_privacy: consent_privacy,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
    });

    if (error) {
      console.error('claim_waitlist_signup rpc failed:', error);
      return json({ error: 'signup_failed' }, 500);
    }

    if (!data || data.success !== true) {
      return json({ error: data?.error ?? 'signup_failed' }, 400);
    }

    // Week 2 TODO: when data.was_new && data.email_confirmation_token, send
    // confirmation email via Resend. For Week 1 we deliberately drop the
    // token and return only the public-safe fields.
    return json(
      {
        success: true,
        was_new: data.was_new === true,
        position: data.position ?? null,
        referral_code: data.referral_code ?? null,
        email_confirmed: data.email_confirmed === true,
      },
      200,
    );
  } catch (err) {
    console.error('waitlist-signup unhandled error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});

// --- Helpers ---

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

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
