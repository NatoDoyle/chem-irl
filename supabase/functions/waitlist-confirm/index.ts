// Supabase Edge Function: Waitlist Confirm
//
// Reached by the link in the confirmation email sent by waitlist-signup.
// Wraps the SECURITY DEFINER RPC `confirm_waitlist_email`: validates the
// single-use token, marks email_confirmed_at, applies any referral score,
// and on success 302s into the marketing site's /waitlist/success page so
// the user lands on the real shareable referral landing instead of a
// dead-end Supabase URL. Errors still render inline since the marketing
// site has no equivalent error path.
//
// JWT verification is disabled in supabase/config.toml — the link is
// opened directly from email, no client auth context.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
};

const MARKETING_SUCCESS_URL = 'https://chemirl.app/waitlist/success';

serve(async (req) => {
  // Only GET is meaningful (link click from email). HEAD also fine.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(req.url);
  const token = (url.searchParams.get('token') ?? '').trim();

  if (!token || token.length < 16 || token.length > 256) {
    return errorPage('Invalid or missing confirmation link.', 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('waitlist-confirm: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return errorPage('Something went wrong on our end. Try again in a few minutes.', 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data, error } = await admin.rpc('confirm_waitlist_email', {
    p_token: token,
  });

  if (error) {
    console.error('confirm_waitlist_email rpc failed:', error);
    return errorPage('Something went wrong. Try clicking the link again.', 500);
  }

  if (!data || data.success !== true) {
    const reason = data?.error ?? 'unknown';
    if (reason === 'invalid_or_used_token' || reason === 'invalid_token') {
      return errorPage(
        "This confirmation link has expired or already been used. If you've already confirmed, you're all set.",
        410,
      );
    }
    return errorPage('We could not confirm this email. Try signing up again.', 400);
  }

  const referralCode = typeof data.referral_code === 'string' ? data.referral_code : null;
  if (!referralCode) {
    console.error('waitlist-confirm: rpc returned success without referral_code');
    return errorPage('Something went wrong on our end. Try again in a few minutes.', 500);
  }
  const successUrl = new URL(MARKETING_SUCCESS_URL);
  successUrl.searchParams.set('code', referralCode);
  successUrl.searchParams.set('confirmed', '1');
  return Response.redirect(successUrl.toString(), 302);
});

// --- HTML rendering -------------------------------------------------------

function shell(title: string, bodyInner: string, status: number): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${title} — Chem IRL</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F8FAFC;color:#0F172A;margin:0;padding:0;line-height:1.5;}
    main{max-width:520px;margin:0 auto;padding:64px 24px;}
    .card{background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(15,23,42,.06);}
    h1{font-size:24px;margin:0 0 16px;font-weight:700;}
    p{margin:0 0 16px;color:#334155;}
    .muted{color:#64748B;font-size:14px;}
    .pill{display:inline-block;background:#EEF7F8;color:#0F766E;padding:4px 12px;border-radius:999px;font-size:13px;font-weight:600;margin-bottom:16px;}
    code{background:#F1F5F9;padding:2px 6px;border-radius:4px;font-size:13px;}
    a{color:#0F172A;text-decoration:underline;}
  </style>
</head>
<body>
  <main>
    <div class="card">${bodyInner}</div>
  </main>
</body>
</html>`,
    { status, headers: HTML_HEADERS },
  );
}

function errorPage(message: string, status: number): Response {
  return shell(
    'Confirmation issue',
    `
    <h1>We hit a snag</h1>
    <p>${escapeHtml(message)}</p>
    <p class="muted">If this keeps happening, write to <a href="mailto:hello@chemirl.app">hello@chemirl.app</a> and we'll sort it.</p>
  `,
    status,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
