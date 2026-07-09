// Supabase Edge Function: Blog Subscribe
//
// Lightweight sibling of waitlist-signup for the marketing-site blog
// sidebar email CTA. Accepts only { email }, calls the service-role RPC
// claim_blog_subscribe to insert (or refresh the token of) a row with
// source='blog_subscribe' in the shared waitlist_signups table, then
// sends a double-opt-in email via Resend pointing at waitlist-confirm.
//
// Audience push moved to waitlist-confirm (post-confirm) so only confirmed
// contacts land in the Resend audience — typo'd or bot emails never make
// it onto the broadcast list.
//
// Why not reuse waitlist-signup? That function expects age_band/gender
// and goes through claim_waitlist_signup for position/score logic that
// is irrelevant for a blog subscriber. A separate slim function keeps
// each entry point single-purpose.
//
// Security mirrors waitlist-signup: same CORS allowlist, same IP-hash
// rate limit (best-effort, fail-open), same honeypot + disposable-email
// rejection. Email validation primitives live in _shared/.
//
// JWT verification is disabled in supabase/config.toml.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EMAIL_RE, isDisposableEmail } from '../_shared/email-validation.ts';
import { type EdgeHandler, logEvent, withObservability } from '../_shared/observability.ts';

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

const handler: EdgeHandler = async (req, ctx) => {
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
      // Distinguish the fake-200 from real subscribes in telemetry.
      logEvent('info', 'subscribe_honeypot', ctx);
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
        logEvent('warn', 'subscribe_rate_limited', ctx);
        return json({ error: 'rate_limited' }, 429, {
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      }
    }

    // Service-role RPC handles insert + idempotent token re-issue. The
    // RPC keeps the confirmation token off the public PostgREST surface —
    // only this edge function, running with the service-role key, sees it.
    const { data, error } = await admin.rpc('claim_blog_subscribe', {
      p_email: email,
      p_ip_hash: ipHash,
    });

    if (error) {
      console.error('claim_blog_subscribe rpc failed:', error);
      logEvent('error', 'subscribe_rpc_failed', ctx, { rpc: 'claim_blog_subscribe' });
      return json({ error: 'subscribe_failed' }, 500);
    }
    if (!data || data.success !== true) {
      return json({ error: data?.error ?? 'subscribe_failed' }, 400);
    }

    // Send the double-opt-in email. The RPC issues a token only for
    // genuinely new blog signups and for not-yet-confirmed re-submits;
    // existing-confirmed users and waitlist-overlap cases come back
    // without a token (silent no-op — see migration comments). The
    // Resend audience push is deferred to waitlist-confirm so only
    // confirmed contacts land in the audience.
    if (typeof data.email_confirmation_token === 'string') {
      await sendBlogConfirmationEmail({
        to: email,
        token: data.email_confirmation_token,
      });
    }

    // No email/PII in telemetry — flags only.
    logEvent('info', 'subscribe_result', ctx, {
      sent_confirmation: typeof data.email_confirmation_token === 'string',
    });

    return json({ ok: true }, 200);
  } catch (err) {
    // Keep the CORS'd 500 (the wrapper's generic 500 has no CORS headers);
    // mirror the failure into telemetry.
    console.error('waitlist-blog-subscribe unhandled error:', err);
    logEvent('error', 'subscribe_unhandled', ctx, {
      error_message: err instanceof Error ? err.message : String(err),
    });
    return json({ error: 'internal_error' }, 500);
  }
};

serve(withObservability(handler, { name: 'waitlist-blog-subscribe' }));

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

// --- Confirmation email --------------------------------------------------
//
// Sends a transactional double-opt-in email via Resend, pointing at the
// waitlist-confirm edge function. Mirrors sendConfirmationEmail() in
// waitlist-signup so both flows fail-soft in the same way: when
// RESEND_API_KEY is missing the payload is logged and the call
// short-circuits — the signup itself still succeeds, just stays
// unconfirmed (and so isn't pushed to the Resend audience).

interface BlogConfirmationEmailArgs {
  to: string;
  token: string;
}

async function sendBlogConfirmationEmail(
  args: BlogConfirmationEmailArgs,
): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress =
    Deno.env.get('WAITLIST_EMAIL_FROM') ?? 'Chem IRL <hello@chemirl.app>';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const confirmUrl =
    `${supabaseUrl}/functions/v1/waitlist-confirm` +
    `?token=${encodeURIComponent(args.token)}`;

  const subject = 'Confirm your Chem IRL blog subscription';

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#0F172A;max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">Confirm your subscription</h1>
  <p>Thanks for subscribing to the Chem IRL blog. Tap the button below to confirm your email — that's how we know you're real.</p>
  <p style="margin:32px 0;">
    <a href="${confirmUrl}" style="background:#0F172A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">Confirm my email</a>
  </p>
  <p style="color:#475569;font-size:14px;">Or copy this link into your browser:<br><span style="word-break:break-all;">${confirmUrl}</span></p>
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:32px 0;">
  <p style="color:#475569;font-size:12px;">If you didn't subscribe to the Chem IRL blog, you can ignore this email — your address won't be added to anything.</p>
</body></html>`;

  const text =
    `Thanks for subscribing to the Chem IRL blog. Confirm your email:\n` +
    `${confirmUrl}\n\n` +
    `If you didn't subscribe, ignore this email.\n`;

  if (!apiKey) {
    console.log(
      'waitlist-blog-subscribe: RESEND_API_KEY not set — would have sent email',
      JSON.stringify({ to: args.to, subject, confirmUrl }),
    );
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [args.to],
        subject,
        html,
        text,
        // Token is unique per signup attempt; safe stable id for retry dedup.
        idempotencyKey: `confirm-blog/${args.token}`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend send failed', { status: res.status, detail });
    }
  } catch (err) {
    // Don't bubble — the signup itself succeeded; email retry can come later.
    console.error('Resend send threw', err);
  }
}
