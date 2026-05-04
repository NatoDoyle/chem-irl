// Supabase Edge Function: Support Submit
//
// Handles all four submission kinds from the marketing-site /support page:
//   - bug      (email required)
//   - feature  (email required)
//   - contact  (email required)
//   - tip      (email optional)
//
// Mirrors the waitlist-blog-subscribe pattern: anonymous-callable from the
// static Next.js marketing site (verify_jwt = false in supabase/config.toml),
// CORS allowlist locked to chemirl.app origins via shared
// WAITLIST_ALLOWED_ORIGINS env, IP-hash rate limit (best-effort, fail-open),
// honeypot + disposable-email rejection. The function uses its own
// service-role Supabase client to call the SECURITY DEFINER RPC
// `submit_support_request`, which is the only way data lands in
// support_submissions (RLS denies anon writes).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { EMAIL_RE, isDisposableEmail } from '../_shared/email-validation.ts';

const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

const SUBJECT_MIN = 3;
const SUBJECT_MAX = 200;
const BODY_MIN = 10;
const BODY_MAX = 5000;
const DISPLAY_NAME_MAX = 80;

const DEFAULT_ALLOWED_ORIGINS = new Set<string>([
  'https://chemirl.app',
  'https://www.chemirl.app',
]);

const VERCEL_PREVIEW_RE =
  /^https:\/\/chem-irl(-[a-z0-9-]+)?-nathans-projects-[a-z0-9-]+\.vercel\.app$/;

type Kind = 'bug' | 'feature' | 'contact' | 'tip';
const VALID_KINDS: ReadonlySet<Kind> = new Set<Kind>([
  'bug',
  'feature',
  'contact',
  'tip',
]);

const VALID_BUG_OS: ReadonlySet<string> = new Set([
  'ios',
  'android',
  'web',
  'other',
]);
const VALID_CONTACT_TOPICS: ReadonlySet<string> = new Set([
  'press',
  'partnership',
  'general',
  'other',
]);

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
  // Intentionally reuse WAITLIST_ALLOWED_ORIGINS — these are the same
  // marketing-site origins for both surfaces. Don't add a second env.
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
    return json({ success: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await safeJson(req);
    if (!body) return json({ success: false, error: 'invalid_json' }, 400);

    // Honeypot — bots auto-fill hidden fields; real users never see them.
    // Pretend success so the bot can't probe the difference.
    if (typeof body.website === 'string' && body.website.trim().length > 0) {
      return json({ success: true, submission_id: null }, 200);
    }

    const kindRaw = typeof body.kind === 'string' ? body.kind : '';
    if (!VALID_KINDS.has(kindRaw as Kind)) {
      return json({ success: false, error: 'invalid_kind' }, 400);
    }
    const kind = kindRaw as Kind;

    if (body.consent_privacy !== true) {
      return json({ success: false, error: 'consent_required' }, 400);
    }

    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    if (subject.length < SUBJECT_MIN || subject.length > SUBJECT_MAX) {
      return json({ success: false, error: 'subject_too_short' }, 400);
    }

    const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
    if (bodyText.length < BODY_MIN || bodyText.length > BODY_MAX) {
      return json({ success: false, error: 'body_too_short' }, 400);
    }

    const emailRaw =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    let email: string | null = null;
    if (emailRaw.length > 0) {
      if (emailRaw.length > 320 || !EMAIL_RE.test(emailRaw)) {
        return json({ success: false, error: 'invalid_email' }, 400);
      }
      if (isDisposableEmail(emailRaw)) {
        return json({ success: false, error: 'disposable_email' }, 400);
      }
      email = emailRaw;
    } else if (kind !== 'tip') {
      // Email is required for bug/feature/contact, optional for tip.
      return json({ success: false, error: 'invalid_email' }, 400);
    }

    let displayName: string | null = null;
    if (typeof body.display_name === 'string') {
      const dn = body.display_name.trim();
      if (dn.length > 0) {
        if (dn.length > DISPLAY_NAME_MAX) {
          return json({ success: false, error: 'display_name_too_long' }, 400);
        }
        displayName = dn;
      }
    }

    const metadata = sanitizeMetadata(kind, body.metadata);

    const ipRaw = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
    const ipHash = ipRaw ? await sha256Hex(ipRaw) : null;
    const userAgent = req.headers.get('user-agent') ?? null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env');
      return json({ success: false, error: 'server_misconfigured' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (ipHash) {
      const allowed = await checkRateLimit(admin, ipHash);
      if (!allowed) {
        return json({ success: false, error: 'rate_limited' }, 429, {
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
        });
      }
    }

    const { data, error } = await admin.rpc('submit_support_request', {
      p_kind: kind,
      p_email: email,
      p_display_name: displayName,
      p_subject: subject,
      p_body: bodyText,
      p_metadata: metadata,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
    });

    if (error) {
      console.error('submit_support_request rpc failed:', error);
      return json({ success: false, error: 'submit_failed' }, 500);
    }
    if (!data || data.success !== true) {
      return json(
        { success: false, error: data?.error ?? 'submit_failed' },
        400,
      );
    }

    return json(
      { success: true, submission_id: data.submission_id ?? null },
      200,
    );
  } catch (err) {
    console.error('support-submit unhandled error:', err);
    return json({ success: false, error: 'internal_error' }, 500);
  }
});

// --- Helpers ---------------------------------------------------------------

// Whitelist per-kind metadata keys. Unknown keys are silently dropped so
// attackers can't smuggle extra payload into the row.
function sanitizeMetadata(kind: Kind, raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const m = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  const clamp = (v: unknown, max: number): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    if (t.length === 0) return undefined;
    return t.length > max ? t.slice(0, max) : t;
  };

  if (kind === 'bug') {
    const v = clamp(m.app_version, 40);
    if (v !== undefined) out.app_version = v;
    if (typeof m.os === 'string' && VALID_BUG_OS.has(m.os)) out.os = m.os;
    const r = clamp(m.steps_to_reproduce, 2000);
    if (r !== undefined) out.steps_to_reproduce = r;
  } else if (kind === 'feature') {
    const v = clamp(m.use_case, 2000);
    if (v !== undefined) out.use_case = v;
  } else if (kind === 'contact') {
    if (
      typeof m.topic === 'string' &&
      VALID_CONTACT_TOPICS.has(m.topic)
    ) {
      out.topic = m.topic;
    }
  } else if (kind === 'tip') {
    const t = clamp(m.tip_topic, 80);
    if (t !== undefined) out.tip_topic = t;
    const url = clamp(m.source_url, 500);
    if (url !== undefined) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          out.source_url = parsed.toString();
        }
      } catch {
        // Drop unparseable URLs silently.
      }
    }
  }

  return out;
}

// deno-lint-ignore no-explicit-any
async function checkRateLimit(admin: any, ipHash: string): Promise<boolean> {
  try {
    const since = new Date(
      Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000,
    ).toISOString();
    const { count, error } = await admin
      .from('support_submissions')
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
