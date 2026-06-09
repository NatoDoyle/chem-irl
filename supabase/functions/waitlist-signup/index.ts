// Supabase Edge Function: Waitlist Signup
//
// Anonymous POST endpoint called by the static marketing site
// (web/src/app/download — and a forthcoming web/src/components/WaitlistForm.tsx)
// to register a Dublin waitlist signup. Wraps the SECURITY DEFINER RPC
// `claim_waitlist_signup_v2` (granted only to service_role) and returns the
// caller's position + referral_code.
//
// JWT verification is disabled in supabase/config.toml ([functions.waitlist-signup]).
// CORS is locked down to the production marketing domain plus Vercel
// preview deployments (see buildCorsHeaders). Override via the
// `WAITLIST_ALLOWED_ORIGINS` Supabase secret (comma-separated) for
// local dev or staging origins.
//
// Week 1 scope (this file): no email sending. The RPC returns an
// email_confirmation_token; we throw it away here and send an email in
// the Week 2 follow-up that adds Resend integration.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EMAIL_RE, isDisposableEmail } from '../_shared/email-validation.ts';

const ALLOWED_AGE_BANDS = ['18-21', '22-26', '27-31', '32-36', '37-44', '45+'];
const ALLOWED_GENDERS = ['female', 'male', 'nonbinary', 'prefer_not_to_say'];

// Rate limit: max successful signups per IP-hash per rolling window.
// Calibrated for the launch — humans never sign up 5+ times in an hour;
// bots that get past honeypot will hit this fast.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

// Silent dedup: a 2nd signup from the same IP hash with a *different*
// email inside this window is bounced with the no-op success shape.
// Per docs/DUBLIN_LAUNCH_PLAN.md §2.6. Different-email gate (vs raw IP
// match) avoids breaking legit double-clicks — those are still handled
// by the RPC's email-uniqueness path.
const SILENT_DEDUP_WINDOW_SECONDS = 60;

// Default-allow set for the public marketing surfaces.
const DEFAULT_ALLOWED_ORIGINS = new Set<string>([
  'https://chemirl.app',
  'https://www.chemirl.app',
]);

// Vercel preview deployments for the chem-irl project.
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
    if (isDisposableEmail(email)) {
      return json({ error: 'disposable_email' }, 400);
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

    // Channel attribution (WAITLIST_AUDIT.md §4) — campaign labels captured by
    // the frontend on landing. Clamped to the DB CHECK limit (120).
    const utm_source = clampStr(body.utm_source, 120);
    const utm_medium = clampStr(body.utm_medium, 120);
    const utm_campaign = clampStr(body.utm_campaign, 120);
    const utm_term = clampStr(body.utm_term, 120);
    const utm_content = clampStr(body.utm_content, 120);

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

    // --- Rate limit per IP hash (best-effort; fail open on query errors
    //     so transient DB issues don't block legitimate signups) ---
    if (ipHash) {
      // Silent dedup runs first — abusers spamming many emails from one IP
      // get the no-op success shape (same as the honeypot) so they can't
      // probe response shape to distinguish signal from noise. Real users
      // re-submitting their own email aren't matched (different-email gate).
      if (await isRapidIpDuplicate(admin, ipHash, email)) {
        return json(
          { success: true, was_new: true, position: 0, referral_code: '', email_confirmed: false },
          200,
        );
      }

      const allowed = await checkRateLimit(admin, ipHash);
      if (!allowed) {
        return json({ error: 'rate_limited' }, 429, {
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      }
    }

    // _v2 = v1 + utm_* write-through (migration 20260609190942). Deploy this
    // function only AFTER that migration is applied — _v2 must exist first.
    const { data, error } = await admin.rpc('claim_waitlist_signup_v2', {
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
      p_utm_source: utm_source,
      p_utm_medium: utm_medium,
      p_utm_campaign: utm_campaign,
      p_utm_term: utm_term,
      p_utm_content: utm_content,
    });

    if (error) {
      console.error('claim_waitlist_signup_v2 rpc failed:', error);
      return json({ error: 'signup_failed' }, 500);
    }

    if (!data || data.success !== true) {
      return json({ error: data?.error ?? 'signup_failed' }, 400);
    }

    // Send confirmation email on new signups only. Feature-flagged on
    // RESEND_API_KEY: when unset (e.g. before Resend is configured), log
    // the would-be payload to the function logs and continue. The signup
    // still succeeds — the user just stays in the unconfirmed cohort
    // (uncounted by waitlist_count_dublin() until they confirm).
    if (data.was_new === true && typeof data.email_confirmation_token === 'string') {
      await sendConfirmationEmail({
        to: email,
        firstName: first_name,
        position: data.position ?? null,
        token: data.email_confirmation_token,
        referralCode: typeof data.referral_code === 'string' ? data.referral_code : null,
      });
    }

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

// deno-lint-ignore no-explicit-any
async function checkRateLimit(admin: any, ipHash: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
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

// deno-lint-ignore no-explicit-any
async function isRapidIpDuplicate(admin: any, ipHash: string, email: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - SILENT_DEDUP_WINDOW_SECONDS * 1000).toISOString();
    const { count, error } = await admin
      .from('waitlist_signups')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .neq('email', email)
      .gte('created_at', since);
    if (error) {
      console.error('rapid-dedup query failed (failing open):', error);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (err) {
    console.error('rapid-dedup threw (failing open):', err);
    return false;
  }
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

// --- Confirmation email ---------------------------------------------------
//
// Sends a transactional email via Resend. The link points back at the
// `waitlist-confirm` edge function, which marks email_confirmed_at and
// applies referral score (if any). When RESEND_API_KEY is missing the
// payload is logged and the call short-circuits — the signup still
// succeeds (just stays unconfirmed until the next attempt).

interface ConfirmationEmailArgs {
  to: string;
  firstName: string | null;
  position: number | null;
  token: string;
  // The signup's own referral_code, used to build a durable status link
  // (chemirl.app/waitlist/success?code=…) so the user can return to their
  // position/score and share link any time. Null only if the RPC somehow
  // omitted it — the status link is then dropped from the email.
  referralCode: string | null;
}

async function sendConfirmationEmail(args: ConfirmationEmailArgs): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress = Deno.env.get('WAITLIST_EMAIL_FROM') ?? 'Chem IRL <hello@chemirl.app>';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const confirmUrl = `${supabaseUrl}/functions/v1/waitlist-confirm?token=${encodeURIComponent(args.token)}`;

  // Durable, personal status link on the marketing site. Carries the user's
  // referral_code so /waitlist/success can show their live position, score,
  // and share link — before AND after they confirm. Overridable for staging
  // via the WAITLIST_SUCCESS_URL secret (mirrors waitlist-confirm's constant).
  const successBase =
    Deno.env.get('WAITLIST_SUCCESS_URL') ?? 'https://chemirl.app/waitlist/success';
  const statusUrl = args.referralCode
    ? `${successBase}?code=${encodeURIComponent(args.referralCode)}`
    : null;

  const greeting = args.firstName ? `Hey ${args.firstName},` : 'Hey,';
  const positionLine = args.position
    ? `You're #${args.position} on the Dublin waitlist.`
    : `You're on the Dublin waitlist.`;

  const subject = 'Confirm your Chem IRL waitlist spot';

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#0F172A;max-width:560px;margin:0 auto;padding:32px 24px;">
  <h1 style="font-size:22px;margin:0 0 16px;">Confirm your spot</h1>
  <p>${greeting}</p>
  <p>${positionLine} Tap the button below to confirm your email — that's how we know you're real.</p>
  <p style="margin:32px 0;">
    <a href="${confirmUrl}" style="background:#0F172A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">Confirm my email</a>
  </p>
  <p style="color:#475569;font-size:14px;">Or copy this link into your browser:<br><span style="word-break:break-all;">${confirmUrl}</span></p>
  ${
    statusUrl
      ? `<p style="color:#475569;font-size:14px;">Check your spot and grab your referral link any time:<br><a href="${statusUrl}" style="color:#0F766E;word-break:break-all;">${statusUrl}</a></p>`
      : ''
  }
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:32px 0;">
  <p style="color:#475569;font-size:12px;">If you didn't sign up for Chem IRL, you can ignore this email — your address won't be added to anything.</p>
</body></html>`;

  const statusText = statusUrl
    ? `\nCheck your spot and grab your referral link any time:\n${statusUrl}\n`
    : '';
  const text = `${greeting}\n\n${positionLine} Confirm your email:\n${confirmUrl}\n${statusText}\nIf you didn't sign up for Chem IRL, ignore this email.\n`;

  // Feature flag: if Resend isn't wired up yet, log the payload and bail.
  if (!apiKey) {
    console.log(
      'waitlist-signup: RESEND_API_KEY not set — would have sent email',
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
