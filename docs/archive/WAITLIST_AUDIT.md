# Chem IRL — Waitlist Funnel Launch-Readiness Audit

_Read-only audit. Date: 2026-06-01. Scope: signup funnel from landing page → DB → email →
referral. Every file:line below was read directly; items that can't be confirmed from code
(secrets, DNS, deployed region, rendered HTML) are flagged "needs manual/runtime check."_

## Summary

| # | Area | Status | One-line verdict |
|---|------|--------|------------------|
| 1 | Email capture (end to end) | ✅ Working | Durable save before email; dedup via `CITEXT UNIQUE`; plus-addressing allowed; email failure never loses the lead. |
| 2 | Referral loop | ✅ Working | Unique persistent code, attribution on confirm, self-referral blocked, share link (`/download`) has a real OG preview. |
| 3 | Email deliverability | ⚠️ Concern | Resend wired correctly but **feature-flagged off if `RESEND_API_KEY` unset** → silent dead confirm funnel; no referral link in the email; SPF/DKIM/spam need manual check. |
| 4 | Source tracking (UTM) | ❌ Missing | **No UTM capture anywhere** — frontend, function, and DB. Channel attribution is impossible. |
| 5 | GDPR / compliance | ⚠️ Concern | Privacy page linked + consent required ✅; but consent has no timestamp, erase is unconfirmed-only, EU region not in code. |
| 6 | Landing page | ✅ Working | Responsive, valid internal links, OG images present (incl. root via file convention), static-build-safe. |
| 7 | List usability + abuse | ⚠️ Concern | Honeypot + per-IP rate limit + disposable block ✅; no captcha and IP limit is bypassable; export is manual SQL; no channel filter (ties to #4). |

**Two runtime config checks gate the entire funnel** (see "Needs manual/runtime
verification") — if either is wrong, signups silently fail despite the form reporting
success.

---

## Stack & funnel map

- **Landing/form:** static Next.js 16 (App Router, `output: 'export'`) in `web/`. The
  email-capture form is `web/src/components/WaitlistForm.tsx`, embedded on
  `web/src/app/download/page.tsx` (the `/download` route). Home `/` (`web/src/app/page.tsx`)
  is a marketing page whose CTAs link to `/download`.
- **Submit path:** `web/src/lib/waitlist.ts` → `POST {SUPABASE_URL}/functions/v1/waitlist-signup`.
- **Backend:** Supabase edge functions `supabase/functions/waitlist-{signup,confirm,forget,blog-subscribe}/`,
  each `verify_jwt = false`, calling SECURITY DEFINER RPCs with the service-role key.
- **DB:** `supabase/migrations/` — core table `waitlist_signups` (+ `waitlist_referrals`,
  `waitlist_share_events`). Migrations: `20260427000001_waitlist.sql` (core),
  `20260428000001_waitlist_source_column.sql`, `20260429130000_per_list_membership.sql`,
  `20260519161831_confirm_waitlist_email_v3_idempotent.sql` (current RPCs).
- **Email:** Resend (`https://api.resend.com/emails`), keyed by `RESEND_API_KEY`,
  feature-flagged off when unset.
- **Referral:** per-signup `referral_code` (unique), `referred_by_code` FK, gender-weighted
  scoring applied on *confirmation*. Share link → `/download?ref=CODE`.

---

## 1. Email capture, end to end — ✅ Working

**What's in place**
- Form posts a JSON payload (`WaitlistForm.tsx:94-104`) to the `waitlist-signup` edge
  function (`waitlist.ts:75-82`).
- Success UI is **not optimistic**: `submitWaitlistSignup` only returns success on a real
  HTTP 2xx **and** `obj.success === true` (`waitlist.ts:100-103`); the form navigates to
  the success page only when `result.success && result.referral_code`
  (`WaitlistForm.tsx:108-114`). Network/JSON failures map to typed errors
  (`waitlist.ts:83-92`).
- **Durable persistence:** the row is inserted by the `claim_waitlist_signup` RPC
  (`waitlist-signup/index.ts:178-190`) **before** any email is attempted (`:206-213`).
- **Dedup:** `email CITEXT UNIQUE NOT NULL` (`20260427000001_waitlist.sql:31`) —
  case-insensitive, so `User@x.com` and `user@x.com` collide. Plus a compound
  `UNIQUE(email, source)` (`20260429130000_per_list_membership.sql`). The RPC checks for an
  existing row first and returns a friendly `was_new:false` instead of a 500.
- **Plus-addressing:** client uses native `type="email"` (`WaitlistForm.tsx:145`); server
  regex `EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/` (`_shared/email-validation.ts:6`) and the
  DB CHECK (`20260427000001_waitlist.sql:32`) both accept `user+tag@gmail.com`.
- **Failure path under load:** if the email send throws or returns non-OK, errors are
  swallowed (`waitlist-signup/index.ts:365-372`) — the signup still succeeds and the lead
  is saved. The rate-limit query fails *open* (`:242-250`), so a transient DB hiccup
  doesn't block legitimate signups.

**Caveat:** the form depends on `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
being injected at **build** time; if missing it returns `configuration_missing` and shows
"The form's misconfigured on our end" (`waitlist.ts:69-71`, `WaitlistForm.tsx:353-354`).
→ runtime check (see fix list P0-2).

**Recommendation:** none on code. Verify the two `NEXT_PUBLIC_SUPABASE_*` vars are set in
the Vercel production environment before launch.

---

## 2. Referral loop — ✅ Working

**What's in place**
- **Unique persistent code:** `referral_code TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(6),'hex')`
  (`20260427000001_waitlist.sql:45-46`) — 12 hex chars, generated once at insert.
- **Attribution:** signup accepts `referred_by_code` (`WaitlistForm.tsx:100`,
  `waitlist-signup/index.ts:138,185`); the RPC validates it exists and silently drops
  unknown codes. Credit is applied on the **referee's email confirmation** via
  `apply_referral_score_for_signup` (`20260519161831...:101-104`).
- **Self-referral blocked:** defense-in-depth guard `IF v_referrer.id = v_signup.id THEN RETURN`
  (`20260427000001_waitlist.sql:339-341`), plus it's practically impossible at insert (you
  can't know your own code before it's generated). Scoring is idempotent via
  `UNIQUE(referrer_id, referred_id)` + an `EXISTS` check (`:72`, `:343-349`).
- **"Valid referral" is well-defined = a confirmed referee:** `waitlist_referrals` rows only
  exist after confirmation, and the public `referred_count` counts those rows. Raw
  unconfirmed signups don't move the referrer. Gender-weighted (F→F and cross-gender = 2.0,
  same-gender = 1.0, ×0.25 plateau after 5) (`:351-365`).
- **Share link has a real OG preview:** `buildReferralUrl` returns
  `https://chemirl.app/download?ref=CODE` (`waitlist.ts:171-174`), and `/download` sets a
  full `openGraph`/`twitter` block with `images: ['/opengraph-image.png']`
  (`download/page.tsx:13-28`). A shared referral link renders a rich card, not a naked URL.
- The referral link is surfaced to the user immediately on the success page
  (`WaitlistSuccess.tsx:227,267`), pre-confirmation, and again on the post-confirm redirect.

**What's missing / weak**
- The referral link is **not in any email** (see §3) — the loop is reinforced only on-site.

**Recommendation:** add the personal referral link to the confirmation (or a follow-up
welcome) email so the ask reaches the inbox, not only a success page the user may have
closed.

---

## 3. Email deliverability — ⚠️ Concern

**What's in place**
- Resend integration: `POST https://api.resend.com/emails` (`waitlist-signup/index.ts:351`),
  from `WAITLIST_EMAIL_FROM` or `Chem IRL <hello@chemirl.app>` (`:315`). Confirmation email
  is sent only for new signups (`:206-213`), with a confirm link to the `waitlist-confirm`
  function (`:317`). On confirm, the user is added to a Resend audience (`waitlist-confirm`).
- Double-opt-in: the confirm flow is idempotent and 7-day-expiring (`confirm_waitlist_email_v3`,
  `20260519161831...:49-115`).

**What's broken / risky**
- **Feature-flag silent failure (high risk):** if `RESEND_API_KEY` is unset, the function
  logs "would have sent email" and returns **success anyway** (`:342-347`). The signup row
  is saved but **no confirmation email is ever sent** → the user can't confirm →
  `waitlist_count_dublin()` (which counts confirmed only, `20260427000001_waitlist.sql:125-127`)
  stays at 0 → no referral ever scores. The form, the success page, and the public counter
  would all behave as if things work while the entire confirmed funnel is dead. This is the
  single most dangerous silent failure in the funnel.
- **No referral link in the email body** (`:326-337`) — only position + confirm button.
- **No "resend confirmation" path:** if the email is lost or fails transiently, re-submitting
  the form dedups to a no-op (no new email). The user is stuck unconfirmed.
- **SPF / DKIM / DMARC and actual spam-folder placement — needs manual/runtime check.**
  Not determinable from code.

**Recommendation:** before launch, confirm `RESEND_API_KEY` (and `WAITLIST_EMAIL_FROM`,
`RESEND_AUDIENCE_WAITLIST_ID`, `RESEND_AUDIENCE_BLOG_ID`) are set in the edge-function
secrets and that the `chemirl.app` domain is verified in Resend with SPF/DKIM/DMARC. Add the
referral link to the email; add a resend path.

---

## 4. Source tracking (UTM) — ❌ Missing  🚩

**This is the most important gap for an organic, multi-channel launch.**

- The frontend reads **only** `?ref=` from the URL (`WaitlistForm.tsx:17-21,54-58`); the
  payload interface has no UTM fields (`waitlist.ts:30-42`). No `utm_*` is read or sent.
- The edge function accepts no UTM and passes none to the RPC (`waitlist-signup/index.ts:114-190`).
- The `waitlist_signups` table has **no UTM columns** — `grep -rin utm supabase/migrations/`
  returns nothing.
- Net effect: even if a campaign URL carries `?utm_source=reddit`, it is silently dropped at
  every layer. You will not be able to answer "which of Reddit / Product Hunt / press /
  referral drove these signups" from the data.
- Plausible (`layout.tsx:76-82`) captures page-level UTMs for *traffic* analytics, but those
  are not joined to individual signup rows, so you can't segment the *list* by channel for
  invites or cohort analysis.
- Related robustness gap: the home `/` → `/download` CTA is a plain link
  (`page.tsx:101,288`) that forwards no query string, so any `?ref=`/`?utm=` on the root is
  lost before the form. (Referral links point straight at `/download`, so they're unaffected;
  this only bites campaign links that land on `/`.)

**Recommendation (code change — the one substantive fix):** add `utm_source/medium/campaign/
term/content` columns (new migration), thread them through `claim_waitlist_signup`, accept
them in `waitlist-signup`, and capture them on the frontend — persisting to `sessionStorage`
on landing so they survive the `/`→`/download` hop. Until this exists, point campaign links
directly at `/download?utm_...` as a stopgap so at least Plausible attributes the click.

---

## 5. GDPR / compliance — ⚠️ Concern

**What's in place**
- Privacy policy exists (`web/src/app/privacy/page.tsx`) and is **linked from the form
  itself** with a **required** consent checkbox (`WaitlistForm.tsx:245-261`); `consent_privacy`
  is re-enforced server-side (`waitlist-signup/index.ts:118,126-128`). Marketing consent is a
  separate, optional checkbox (`:235-243`).
- Right-to-erasure endpoint exists: `waitlist-forget` → `forget_waitlist_signup` (hard DELETE).
- No raw IP stored — only `sha256` hash (`waitlist-signup/index.ts:142-143`); RLS is
  default-deny on all waitlist tables (`20260427000001_waitlist.sql:110-115`), so the email
  list can't be read or written by anon callers.

**What's weak / missing**
- **Consent has no timestamp** — `consent_marketing` / `consent_privacy` are booleans only
  (`20260427000001_waitlist.sql:54-55`); no `consented_at`. A GDPR audit trail typically wants
  when consent was given.
- **Erasure is unconfirmed-only:** `forget_waitlist_signup` deletes only rows with
  `email_confirmed_at IS NULL` (per the v3 migration notes, `20260519161831...:281-310`).
  Confirmed users can't self-serve deletion — they'd have to email support.
- **Unsubscribe:** marketing unsubscribe rides on Resend audiences; the blog flow mentions an
  unsubscribe link, but the transactional confirmation email contains none.
- **EU data residency — needs manual/runtime check.** No region is set in code
  (`config.toml`, migrations); it's a dashboard setting. `docs/deployment/DEPLOYMENT_CHECKLIST.md`
  lists "Region: EU" as a to-do, not a guarantee.

**Recommendation:** add `consented_at` timestamp(s); confirm the Supabase project region is an
EU region in the dashboard and record it in the deployment checklist; surface an
unsubscribe/erase link in lifecycle emails.

---

## 6. Landing page — ✅ Working

**What's in place**
- **Mobile:** Next injects the viewport meta; the form and pages use responsive Tailwind
  (`flex flex-wrap` chips `WaitlistForm.tsx:172,189`; `md:`/`lg:` breakpoints on
  `download/page.tsx:73,79`). No fixed-width / mobile-breaking layout found.
- **Internal links valid:** Nav (`Nav.tsx`) and Footer (`Footer.tsx`) targets
  (`/how-it-works`, `/safety`, `/support`, `/blog`, `/download`, `/about`, `/privacy`,
  `/terms`) all resolve to existing routes under `web/src/app/`.
- **OG/meta present, including root:** `web/src/app/opengraph-image.png` sits at the app-root
  segment, so Next.js App Router auto-applies it as the `og:image` for `/` **and** every child
  route by file convention — even though `layout.tsx`'s `openGraph` object omits `images`. Key
  funnel pages (`/download`, `/how-it-works`, etc.) additionally set explicit
  `openGraph`/`twitter` images. Blog posts get a dynamic `opengraph-image.tsx`. (The initial
  worry that the root share has no image is a false alarm — the file convention covers it.)
- **Build-safety:** the form reads the URL via `useSyncExternalStore` with an SSR snapshot
  (`WaitlistForm.tsx:54-58`, `WaitlistSuccess.tsx:94-109`), **not** `useSearchParams` — so
  there's no "useSearchParams without Suspense" static-export trap. `window` access is guarded.
  `output: 'export'` with no dynamic server APIs.

**Minor:** home `/` doesn't forward `?ref=`/`?utm=` to `/download` (see §4).

**Recommendation:** validate the rendered OG tags with a social-preview debugger (X card
validator, Facebook sharing debugger, opengraph.xyz) for `/` and `/download?ref=…` —
file-convention OG is standard Next behavior but can't be confirmed from source alone. Run
`bun run build` once to confirm a clean static export.

---

## 7. List usability + abuse protection — ⚠️ Concern

**Abuse protection in place**
- **Honeypot** `website` field; non-empty → fake success (`WaitlistForm.tsx:220-233`,
  `waitlist-signup/index.ts:107-112`).
- **Per-IP-hash rate limit:** `RATE_LIMIT_MAX = 5` per `RATE_LIMIT_WINDOW_SECONDS = 3600`
  (5/hour) sliding window (`index.ts:29-30,234-251`), fail-open on query error.
- **Silent rapid-multi-email dedup:** same IP + different email within
  `SILENT_DEDUP_WINDOW_SECONDS = 60` → fake success (`index.ts:37,163-168,254-269`).
- **Disposable-email blocklist** (~26 domains, `_shared/email-validation.ts:8-36`).

**Weak / missing**
- **No captcha/Turnstile.** The 5/hour limit is **per IP** — a distributed bot rotating ~100
  IPs could insert ~500 rows/hour. Acceptable for a soft launch with monitoring; risky if the
  form gets posted to a public list.
- **Export is manual:** no admin export RPC/view — pulling the invite list means service-role
  SQL in the Supabase dashboard. Filtering works by `source`, `gender`, `age_band`,
  `email_confirmed_at`, `created_at` (all indexed, `20260427000001_waitlist.sql:89-102`), but
  **not by channel** (no UTM, §4). `city` is always `'dublin'` (CHECK), so city filtering is
  moot for now.

**Recommendation:** add a `get_waitlist_export_v1(filters)` service-role RPC for repeatable
invite pulls; consider Vercel Firewall / Cloudflare Turnstile if public spam appears.

---

## Needs manual / runtime verification

1. **`RESEND_API_KEY` set** in Supabase edge-function secrets (plus `WAITLIST_EMAIL_FROM`,
   `RESEND_AUDIENCE_WAITLIST_ID`, `RESEND_AUDIENCE_BLOG_ID`). If unset, **all confirmations
   silently no-op** (§3). _Highest-impact unknown._
2. **`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in Vercel prod build.**
   If missing, the form can't post at all (§1).
3. **SPF / DKIM / DMARC on `chemirl.app`** verified in Resend; check real inbox/spam placement.
4. **Supabase project region = EU** (GDPR, §5) — dashboard-only setting.
5. **Rendered OG tags** for `/` and `/download?ref=…` via a card validator (§6).
6. **Edge functions deployed** (`supabase functions list`) and the **v3 migration applied**
   (`supabase migration list --linked`).
7. **`NEXT_PUBLIC_DOMAIN`** set (else referral URLs default to `chemirl.app` — fine if that's
   the prod domain) and **`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`** set for analytics.

---

## Prioritized fix list (ordered by how badly each leaks signups before launch)

**P0 — verify/fix before any traffic (a wrong setting here silently kills the funnel):**
1. Confirm **`RESEND_API_KEY` + email domain auth** — else every signup stays unconfirmed,
   counter stuck at 0, zero referrals score, all while the form says "success." (§3)
2. Confirm **Vercel prod has `NEXT_PUBLIC_SUPABASE_*`** — else nobody can submit. (§1)
3. **Add UTM capture** (frontend + function + RPC + migration). Without it you spend
   attention/budget on Reddit/PH/press blind. (§4) — _the one substantive code change._

**P1 — strongly recommended before launch:**
4. Confirm **Supabase region is EU** and document it. (§5)
5. **Put the referral link in the confirmation/welcome email** to actually drive the loop. (§2/§3)
6. **Validate OG previews** with a card debugger; run `bun run build` for a clean export. (§6)

**P2 — post-launch hardening:**
7. Add `consented_at` timestamp(s) for the GDPR audit trail. (§5)
8. Add a "resend confirmation email" path. (§3)
9. Add edge rate-limiting / captcha if spam appears (per-IP limit is bypassable). (§7)
10. Add a `get_waitlist_export_v1` RPC for invite pulls. (§7)
11. Forward `?ref=`/`?utm=` from `/` to `/download` (or stash UTM in `sessionStorage`). (§4/§6)

---

## How this audit was verified

Code claims were verified first-hand by reading: `WaitlistForm.tsx`, `waitlist.ts`,
`WaitlistSuccess.tsx`, `download/page.tsx`, `page.tsx`, `layout.tsx`,
`waitlist-signup/index.ts`, `20260427000001_waitlist.sql`, `_shared/email-validation.ts`,
`config.toml`, plus a filesystem check for the OG image file and a `grep` proving UTM's
absence. Runtime-only facts (secrets, DNS/email auth, deployed region, rendered HTML) are
isolated in "Needs manual/runtime verification" and are **not** asserted as verified.
