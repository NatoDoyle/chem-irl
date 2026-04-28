// Supabase Edge Function: Blog Subscribe
//
// Lightweight sibling of waitlist-signup for the marketing-site blog
// sidebar email CTA. Accepts only { email } and writes a row with
// source='blog_subscribe' to the shared waitlist_signups table — same
// list, different audience, segmentable downstream by source.
//
// Why not reuse waitlist-signup? That function expects age_band/gender
// and goes through the SECURITY DEFINER RPC for position/score logic
// that is irrelevant for a blog subscriber. A separate slim function
// keeps each entry point single-purpose.
//
// Security mirrors waitlist-signup: same CORS allowlist, same IP-hash
// rate limit (best-effort, fail-open), same honeypot + disposable-email
// rejection. Email validation primitives live in _shared/.
//
// JWT verification is disabled in supabase/config.toml.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EMAIL_RE, isDisposableEmail } from '../_shared/email-validation.ts';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

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
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, apikey, x-client-info',
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
  const json = (
    body: unknown,
    status: number,
    extraHeaders?: Record<string, string>,
  ): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
        ...(extraHeaders ?? {}),
      },
    });

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await safeJson(req);
    if (!body) return json({ error: 'invalid_json' }, 400);

    // Honeypot — bots auto-fill hidden fields; real users never see
    // them. Pretend success so the bot can't probe the difference.
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      return json({ ok: true }, 200);
    }

    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || email.length > 320 || !EMAIL_RE.test(email)) {
      return json({ error: 'invalid_email' }, 400);
    }
    if (isDisposableEmail(email)) {
      return json({ error: 'disposable_email' }, 400);
    }

    const ipRaw = (req.headers.get('x-forwarded-for') ?? '')
      .split(',')[0]
      ?.trim();
    const ipHash = ipRaw ? await sha256Hex(ipRaw) : null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env');
      return json({ error: 'server_misconfigured' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (ipHash) {
      const allowed = await checkRateLimit(admin, ipHash);
      if (!allowed) {
        return json({ error: 'rate_limited' }, 429, {
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      }
    }

    // Direct insert — service role bypasses RLS, schema allows null
    // age_band/gender/etc., position/referral_code populate via
    // sequence + default. Upsert with ignoreDuplicates so a repeat
    // submit returns success instead of a noisy unique-violation.
    const { error } = await admin.from('waitlist_signups').upsert(
      {
        email,
        source: 'blog_subscribe',
        ip_hash: ipHash,
        // Submitting the form is the consent — we're explicitly asking
        // for blog emails here, no separate checkbox needed.
        consent_marketing: true,
      },
      { onConflict: 'email', ignoreDuplicates: true },
    );

    if (error) {
      console.error('waitlist-blog-subscribe insert failed:', error);
      return json({ error: 'subscribe_failed' }, 500);
    }

    return json({ ok: true }, 200);
  } catch (err) {
    console.error('waitlist-blog-subscribe unhandled error:', err);
    return json({ error: 'internal_error' }, 500);
  }
});

// --- Helpers --------------------------------------------------------------

// deno-lint-ignore no-explicit-any
async function checkRateLimit(admin: any, ipHash: string): Promise<boolean> {
  try {
    const since = new Date(
      Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
    ).toISOString();
    const { count, error } = await admin
      .from('waitlist_signups')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', since);
    if (error) {
      console.error('rate-limit query failed (failing open):', error);
      return true;
    }
    return (count ?? 0) < RATE_LIMIT_MAX;
  } catch (err) {
    console.error('rate-limit threw (failing open):', err);
    return true;
  }
}

async function safeJson(
  req: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
