# Domain & subdomain architecture

Canonical map of how `chemirl.app` is carved up, and the rule for when to add a
subdomain. Paired with [`CLOUDFLARE_SETUP.md`](./CLOUDFLARE_SETUP.md) (the DNS
records themselves) and [`OPENCLAW_CMO_VPS.md`](./OPENCLAW_CMO_VPS.md) (the
marketing sender).

## The rule

Create a subdomain only when a surface needs **its own deploy target**, **its own
email-sending reputation**, or **its own brand** — not speculatively. A marketing
page, a blog, or an API proxy that doesn't meet one of those bars stays a path on
an existing host.

## Map

| Host | Purpose | Status | Deploy target |
|---|---|---|---|
| `chemirl.app` (apex) | Dating-app marketing + SEO canonical. Also the required host for any future universal-link files (`/.well-known/apple-app-site-association`, `assetlinks.json`). | Live | Vercel project `chem-irl` (static export) |
| `www.chemirl.app` | Redirect → apex | Live | Vercel (redirect) |
| `solutions.chemirl.app` | Chem IRL Solutions B2B platform **and** its marketing | Live (platform) | Separate repo `chem-irl-solutions-platform`, own Vercel + Supabase projects |
| `mail.chemirl.app` | Dedicated Resend sending domain for **all** app mail | Planned | Resend (send-only; no web deploy) |
| `app.chemirl.app` | Reserved for the coming web app / product surface | Reserved | Its own Vercel project (when built) |
| `api.chemirl.app` | — | **Not used** | Skipped — the app calls Supabase directly; a vanity proxy needs the Supabase custom-domain add-on and buys nothing yet |
| `blog.chemirl.app` | — | **Not used** | Skipped — the blog stays `chemirl.app/blog`; a subdirectory consolidates SEO authority, a subdomain splits it |

`app.chemirl.mobile` is the mobile **bundle ID** (reverse-DNS), not a subdomain — don't conflate it with `app.chemirl.app`.

## Email sending subdomain (`mail.chemirl.app`)

**Why.** Today every stream — waitlist confirmations, blog opt-in, the D7
marketing nudge, and auth OTP (via Supabase's Resend SMTP) — sends from
`hello@chemirl.app` on the **bare apex**. A spam-complaint spike from bulk
marketing (the autonomous CMO) would damage the same domain reputation that
password/OTP and transactional mail — and the website — depend on. Moving
sending to a subdomain isolates that. The apex SPF is currently
`v=spf1 include:_spf.mx.cloudflare.net ~all` (Cloudflare inbound routing only —
no Resend include), so a clean subdomain set is also tidier than layering Resend
onto the apex.

**Setup.**
1. **Resend** — add domain `mail.chemirl.app`, EU sending region (matches the
   [Dublin plan](../DUBLIN_LAUNCH_PLAN.md)). Resend emits DKIM `CNAME`(s), an SPF
   `TXT`, and a return-path `MX`, all **on the subdomain** — they do not touch the
   apex's Cloudflare inbound `MX` or apex SPF.
2. **Cloudflare** — add exactly the records Resend provides for `mail.chemirl.app`.
   The apex `_dmarc.chemirl.app` (`p=none`) already covers the subdomain via
   relaxed org-domain alignment; optionally add a subdomain-specific
   `_dmarc.mail.chemirl.app`.
3. **Cut over** — set the Supabase Edge Function secret
   `supabase secrets set WAITLIST_EMAIL_FROM='Chem IRL <hello@mail.chemirl.app>'`,
   point Supabase Auth's SMTP "From" at `@mail.chemirl.app` (dashboard), and the
   autonomous CMO's newsletter From follows the same secret.

**Ordering matters.** Verify the domain in Resend **before** flipping the
`WAITLIST_EMAIL_FROM` secret — sending from an unverified domain fails. The code
fallback in the edge functions stays `Chem IRL <hello@chemirl.app>` on purpose:
its job is to be a *safe default* if the secret is ever missing, so it must keep
pointing at a domain that is verified today. Update the fallbacks to `mail.` only
after `mail.chemirl.app` is verified and the cutover is stable.

**Tradeoff.** The visible From changes to `hello@mail.chemirl.app` (display name
stays "Chem IRL"). That is the point — it isolates reputation. Volume is low
pre-launch, so the subdomain warms gently. Secrets reference:
[`web/env.example`](../../web/env.example).

## `app.chemirl.app` — reserved

The dating product is mobile-only today, so nothing serves at `app.` yet — but a
web surface is coming, so the name is reserved to lock the convention. When built
it gets **its own Vercel project** (independent of the marketing static export).
Two wiring notes for that day:

- It will be **CORS-blocked** calling the Supabase edge functions until its origin
  is added to `DEFAULT_ALLOWED_ORIGINS` / the `WAITLIST_ALLOWED_ORIGINS` secret in
  each function, and to the CSP `connect-src` in `web/vercel.json`.
- If it serves web→mobile share/deep links, the `apple-app-site-association` and
  `assetlinks.json` files still live on the **apex**, not on `app.`

## Solutions marketing consolidation

The Solutions **platform** is already correctly separated (own subdomain, repo,
and Supabase project). The one inconsistency: the Solutions **marketing page**
still sits at `chemirl.app/solutions` (footer-only, excluded from the sitemap),
which name-collides with the live platform at `solutions.chemirl.app`. It should
move onto the subdomain — either as a `web/vercel.json` redirect (keeping links
alive) or a full relocation into the platform repo. Its inquiry form posts to the
`support-submit` edge function, whose CORS allowlist is `{chemirl.app,
www.chemirl.app}` — so the new origin must be added there. This is tracked
separately (it deletes/moves files and crosses repos).

## Brand separation note

`solutions.chemirl.app` is *soft* separation (observably part of `chemirl.app`).
The [DPIA](../operations/DPIA.md) contemplates Solutions as a separate legal
entity; if it becomes its own company/brand it would eventually want its own
**root** domain. No action now — flagged as a fork, tied to the pending Apple
seller-identity (individual vs org) decision.

## Verification

- **DNS:** `dig +short mail.chemirl.app TXT` (SPF present);
  `dig +short <selector>._domainkey.mail.chemirl.app CNAME` (DKIM); Resend
  dashboard shows `mail.chemirl.app` **Verified**.
- **Deliverability:** send a real waitlist confirm to a `mail-tester.com` address
  (or use Gmail → "Show original") and confirm SPF **pass**, DKIM **pass** with
  `d=mail.chemirl.app`, DMARC **pass** (aligned to apex).
- **No inbound regression:** `dig +short chemirl.app MX` still shows Cloudflare
  Email Routing → role addresses (`support@`, `safety@`, …) unaffected.
