// Supabase Edge Function: Waitlist Confirm
//
// Shared confirm endpoint for both lists. Reached by the link in the
// confirmation email sent by either waitlist-signup (waitlist) or
// waitlist-blog-subscribe (blog). Wraps the SECURITY DEFINER RPC
// `confirm_waitlist_email_v3`: idempotently validates the token and marks
// email_confirmed_at WITHOUT burning the token, so an email-scanner
// prefetch (Outlook/M365 Safe Links, Gmail, …) followed by the human's
// click both resolve cleanly instead of "already used". Applies referral
// score for waitlist signups and returns the row's source so this function
// can push the freshly-confirmed contact to the right Resend audience.
//
// On success it 302s into the marketing site's /waitlist/success page
// with a `source` discriminator and (for waitlist) a referral `code`, so
// the user lands on the real shareable referral landing instead of a
// dead-end Supabase URL. Errors ALSO 302 there, with a `?state=` param,
// rather than rendering inline HTML: Supabase forcibly sandboxes HTML
// bodies served from the shared *.supabase.co function domain
// (Content-Type downgraded to text/plain + CSP sandbox + nosniff), so an
// inline error page renders as raw source text. A redirect carries no
// HTML body, so it is not sandboxed.
//
// JWT verification is disabled in supabase/config.toml — the link is
// opened directly from email, no client auth context.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const MARKETING_SUCCESS_URL = 'https://chemirl.app/waitlist/success';

// Confirmation outcomes the marketing /waitlist/success page renders from
// a `?state=` query param.
type ConfirmState = 'invalid' | 'expired' | 'already_confirmed' | 'error';

function redirectToStatus(state: ConfirmState): Response {
  const u = new URL(MARKETING_SUCCESS_URL);
  u.searchParams.set('state', state);
  return Response.redirect(u.toString(), 302);
}

serve(async (req) => {
  // Only GET is meaningful (link click from email). HEAD also fine.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();

  if (!token || token.length < 16 || token.length > 256) {
    return redirectToStatus('invalid');
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('waitlist-confirm: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return redirectToStatus('error');
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await admin.rpc('confirm_waitlist_email_v3', {
    p_token: token,
  });

  if (error) {
    console.error('confirm_waitlist_email_v3 rpc failed:', error);
    return redirectToStatus('error');
  }

  if (!data || data.success !== true) {
    const reason = data?.error ?? 'unknown';
    // Supabase sandboxes inline HTML on *.supabase.co, so every failure
    // 302s to the marketing site instead of rendering a page here. The
    // HTTP-status signal is dropped for the human; keep it in the log.
    console.error('waitlist-confirm: confirm failed', { reason });
    if (reason === 'expired_token') {
      return redirectToStatus('expired');
    }
    return redirectToStatus('invalid');
  }

  // Idempotent re-hit: an email-scanner prefetch already confirmed this
  // row, and now the human's click lands here. The contact was pushed to
  // Resend on that first (confirming) hit, so show the calm "already
  // confirmed" page — no celebration, no duplicate audience push.
  if (data.already_confirmed === true) {
    return redirectToStatus('already_confirmed');
  }

  const email = typeof data.email === 'string' ? data.email : null;
  const source: ConfirmedSource | null =
    data.source === 'blog_subscribe' || data.source === 'waitlist'
      ? data.source
      : null;

  if (!email || !source) {
    console.error(
      'waitlist-confirm: rpc returned success without email or source',
    );
    return redirectToStatus('error');
  }

  // Push the now-confirmed contact to the appropriate Resend audience.
  // Fail-soft: a Resend outage shouldn't break the user's success page —
  // the DB row is the canonical confirmed state, the audience is downstream.
  await addToResendAudience(email, source);

  const successUrl = new URL(MARKETING_SUCCESS_URL);
  successUrl.searchParams.set(
    'source',
    source === 'blog_subscribe' ? 'blog' : 'waitlist',
  );
  successUrl.searchParams.set('confirmed', '1');

  if (source === 'waitlist') {
    const referralCode =
      typeof data.referral_code === 'string' ? data.referral_code : null;
    if (!referralCode) {
      console.error(
        'waitlist-confirm: waitlist confirm returned without referral_code',
      );
      return redirectToStatus('error');
    }
    successUrl.searchParams.set('code', referralCode);
  }

  return Response.redirect(successUrl.toString(), 302);
});

// --- Resend audience push -------------------------------------------------
//
// Adds the freshly-confirmed subscriber to the right Resend audience based
// on which list they signed up for. The audiences endpoint is idempotent
// on email within an audience (Resend guarantee), so a re-click edge case
// doesn't duplicate. Fail-soft: log and continue if RESEND_API_KEY or the
// audience id is missing, or if Resend returns an error — the DB row is
// the canonical "is confirmed" state, the audience is downstream.

type ConfirmedSource = 'waitlist' | 'blog_subscribe';

async function addToResendAudience(
  email: string,
  source: ConfirmedSource,
): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const audienceId = Deno.env.get(
    source === 'blog_subscribe'
      ? 'RESEND_AUDIENCE_BLOG_ID'
      : 'RESEND_AUDIENCE_WAITLIST_ID',
  );

  if (!apiKey || !audienceId) {
    console.log(
      'waitlist-confirm: RESEND_API_KEY or audience id not set — would have added contact',
      JSON.stringify({ email, source }),
    );
    return;
  }

  try {
    const res = await fetch(
      `https://api.resend.com/audiences/${audienceId}/contacts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, unsubscribed: false }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error('Resend audiences add failed', {
        status: res.status,
        detail,
        source,
      });
    }
  } catch (err) {
    console.error('Resend audiences add threw', err);
  }
}
