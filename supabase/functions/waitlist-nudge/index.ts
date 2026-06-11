// Supabase Edge Function: Waitlist D7 Nudge
//
// Sends the one-time "you're #N — confirmed friends move you up" email to
// confirmed, marketing-consented signups that are ≥7 days old and not yet
// nudged. Wraps the service-role RPCs get_waitlist_nudge_batch_v1 /
// mark_waitlist_nudged_v1 (migration 20260611090859).
//
// Trigger: the CMO scheduler on the OpenClaw VPS POSTs here daily. Like the
// `push` function, JWT verification is disabled and the caller authenticates
// with the x-webhook-secret header (WAITLIST_NUDGE_SECRET).
//
// Modes:
//   { "dry_run": true }  → composes everything, sends nothing, marks nothing,
//                          returns previews (founder approves copy this way).
//   { }                  → sends via Resend, marks only successful sends.
//
// Deliverability/compliance: every send carries List-Unsubscribe +
// List-Unsubscribe-Post (RFC 8058 one-click) pointing at waitlist-unsubscribe
// with an HMAC-signed address (WAITLIST_UNSUB_SECRET), which flips
// consent_marketing off. Consent gating lives in the batch RPC itself.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

interface NudgeRow {
  id: string;
  email: string;
  first_name: string | null;
  position: number | null;
  referral_code: string | null;
  confirmed_referrals: number;
}

function b64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405 });
  }

  const secret = Deno.env.get('WAITLIST_NUDGE_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const unsubSecret = Deno.env.get('WAITLIST_UNSUB_SECRET');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!supabaseUrl || !serviceRoleKey || !unsubSecret) {
    console.error('waitlist-nudge: missing required env');
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  let body: { dry_run?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body = real run with defaults
  }
  const dryRun = body.dry_run === true;
  const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.rpc('get_waitlist_nudge_batch_v1', { p_limit: limit });
  if (error) {
    console.error('get_waitlist_nudge_batch_v1 failed:', error);
    return new Response(JSON.stringify({ error: 'batch_fetch_failed' }), { status: 500 });
  }
  const rows = (data ?? []) as NudgeRow[];

  const fromAddress = Deno.env.get('WAITLIST_EMAIL_FROM') ?? 'Chem IRL <hello@chemirl.app>';
  const successBase =
    Deno.env.get('WAITLIST_SUCCESS_URL') ?? 'https://chemirl.app/waitlist/success';

  const previews: Array<{ email: string; subject: string; text: string }> = [];
  const sentIds: string[] = [];
  let failed = 0;

  for (const row of rows) {
    const email = String(row.email).toLowerCase();
    const sig = await hmacHex(unsubSecret, email);
    const unsubUrl =
      `${supabaseUrl}/functions/v1/waitlist-unsubscribe?e=${b64url(email)}&sig=${sig}`;
    const statusUrl = row.referral_code
      ? `${successBase}?code=${encodeURIComponent(row.referral_code)}`
      : successBase;
    const shareUrl = row.referral_code
      ? `https://chemirl.app/download?ref=${encodeURIComponent(row.referral_code)}`
      : 'https://chemirl.app/download';

    const greeting = row.first_name ? `Hey ${row.first_name},` : 'Hey,';
    const refLine =
      row.confirmed_referrals > 0
        ? `${row.confirmed_referrals} ${row.confirmed_referrals === 1 ? 'friend has' : 'friends have'} confirmed through your link so far.`
        : 'No friends through your link yet.';
    const positionBit = row.position ? `#${row.position} ` : '';
    const subject = row.position
      ? `You're #${row.position} on the Dublin list`
      : `Your spot on the Dublin list`;

    const text = `${greeting}

You're ${positionBit}on the Chem IRL Dublin waitlist. ${refLine}

Each friend who signs up with your link and confirms moves you up:
${shareUrl}

Check your spot: ${statusUrl}

—
Stop these updates: ${unsubUrl}
(Your spot and link are unaffected.)
`;

    const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#0F172A;max-width:560px;margin:0 auto;padding:32px 24px;">
  <p>${greeting}</p>
  <p>You're ${positionBit}on the Chem IRL Dublin waitlist. ${refLine}</p>
  <p>Each friend who signs up with your link and confirms moves you up:</p>
  <p style="word-break:break-all;"><a href="${shareUrl}" style="color:#0F766E;">${shareUrl}</a></p>
  <p style="margin:32px 0;">
    <a href="${statusUrl}" style="background:#0F172A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;">Check your spot</a>
  </p>
  <hr style="border:none;border-top:1px solid #E2E8F0;margin:32px 0;">
  <p style="color:#475569;font-size:12px;"><a href="${unsubUrl}" style="color:#475569;">Stop these updates</a> — your spot and link are unaffected.</p>
</body></html>`;

    if (dryRun) {
      if (previews.length < 10) previews.push({ email, subject, text });
      continue;
    }

    if (!resendKey) {
      console.error('waitlist-nudge: RESEND_API_KEY missing — refusing real run');
      return new Response(JSON.stringify({ error: 'resend_not_configured' }), { status: 503 });
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [email],
          subject,
          html,
          text,
          headers: {
            'List-Unsubscribe': `<${unsubUrl}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });
      if (res.ok) {
        sentIds.push(row.id);
      } else {
        failed += 1;
        console.error('resend send failed', { status: res.status, detail: await res.text() });
      }
    } catch (err) {
      failed += 1;
      console.error('resend send threw', err);
    }
  }

  let marked = 0;
  if (sentIds.length > 0) {
    const { data: markData, error: markError } = await admin.rpc('mark_waitlist_nudged_v1', {
      p_ids: sentIds,
    });
    if (markError) {
      // Sends happened but marking failed — surface loudly: a retry would
      // double-send these. Operator must mark manually before re-running.
      console.error('mark_waitlist_nudged_v1 failed for ids:', sentIds, markError);
      return new Response(
        JSON.stringify({ error: 'mark_failed_after_send', sent: sentIds.length, ids: sentIds }),
        { status: 500 },
      );
    }
    marked = Number(markData) || 0;
  }

  return new Response(
    JSON.stringify(
      dryRun
        ? { dry_run: true, eligible: rows.length, previews }
        : { dry_run: false, eligible: rows.length, sent: sentIds.length, failed, marked },
    ),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
