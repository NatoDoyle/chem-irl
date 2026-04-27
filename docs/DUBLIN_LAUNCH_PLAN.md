# Chem IRL — Dublin Launch Plan (Strategy + Build)

## Context

You asked how big the Dublin waitlist needs to be before opening beta and the public app. The conversational answer (~1.5k waitlist for beta, 6–8k for soft launch, 15k for public) is sound, but two things need to be reconciled before that strategy can run:

1. **The waitlist form is dead.** `web/src/app/download/page.tsx` (lines 93–106) renders an `<input type="email">` and a submit button with **no `onSubmit`, no fetch, no API route**. The site is `output: 'export'` (fully static), so the form has no backend at all. The "2,000+ on the waitlist" line at line 153 is hardcoded copy. Any cold-start traffic right now leaks. **You cannot start the playbook on a leaking funnel.**
2. **The existing `App Plans/` strategy uses smaller numbers** than the conversation. `Marketing Plan v1` §13 (Dublin city seeding) says: *"Phase 0 (2 weeks): 150–300 waitlist. Phase 1 (2–4 weeks): closed beta 100–300. Phase 2: open to waitlist."* That is ~1/5 the scale of the conversation. We need one set of numbers — see §1 below for the recommended reconciliation.

You chose **Strategy + build, 1–2 month build runway, Supabase as the source of truth**. This plan delivers both: the engineering work to make the waitlist actually capture, attribute referrals, and instrument decisions; and the phased rollout that uses it.

The plan honors what is already locked-in by `App Plans/Brand & Growth v2` (referral = +40 referrer / +20 referee credits, awarded when both mark "went") and `App Plans/Marketing Plan v1` (north-star: confirmed-dates/WAU ≥ 0.15, median TTD ≤ 7d; female confirm-in-24h ≥ 35% gate). Where this plan differs, the differences are flagged.

---

## 1) Strategic targets (reconciled)

The Marketing Plan's small numbers (100–300 active in beta) optimise for €200/mo budget realism. The conversation's larger numbers (400+ in beta, 2k for soft launch) optimise for **density** — at <300 active in a 1.5M-person metro, the app feels dead, and the core mechanic (proposing 2–3 specific times within a 5km radius this week) starves. Density wins for a two-sided marketplace.

**Recommended phasing — supersedes Marketing Plan §13:**

| Phase | Window | Waitlist (Dublin) | Active (Dublin) | Gate to advance |
|---|---|---|---|---|
| **A. Build** | Weeks 0–8 | 0 (closed) | 0 | Waitlist system live, end-to-end tested with 5 internal accounts |
| **B. Cold start** | Weeks 8–14 | 0 → 200 | 0 | 200 Dublin signups, ≥40% female |
| **C. Referral compounding** | Weeks 14–22 | 200 → 1,500 | 0 | 1,500 Dublin signups, ≤60/40 male skew, ≥30% gave usable "why" answer |
| **D. Closed beta** | Weeks 22–28 | 1,500 → 3,000 | 0 → 400 | Verification ≥70%, female confirm-in-24h ≥35% over 14 days, no Sev-1 trust incidents |
| **E. Soft launch** | Weeks 28–36 | 3k → 8k | 400 → 2,000 | Show-rate ≥75%, payer share ≥6% MAU, K-factor ≥0.5 |
| **F. Public Dublin** | Week 36+ | 8k → 15k+ | 2,000 → 5,000+ | All Phase E gates held for 4 consecutive weeks |

The 35% female-confirm-in-24h gate from Marketing Plan §1 is preserved everywhere. So is verification ≥70%.

**Decision needed from you (single question):** lock the phasing above, OR keep Marketing Plan v1's smaller numbers (Phase 1 beta = 100–300 active). Recommend the larger numbers — I'll proceed on that assumption and flag any specific spend or funnel ask that grows with it.

---

## 2) Phase A — Build (Weeks 0–8)

Goal: by end of Week 8, anyone landing on `/download` from Dublin can submit email + minimal profile, get a confirmation email + waitlist position + a unique referral link, and any signup is attributable to a referrer when applicable. You can run all of this from a Supabase dashboard with manual SQL.

### 2.1 Supabase — schema, RPCs, edge function

**New migration** (next available timestamp; latest applied is `20260326000001`):

```
supabase/migrations/<YYYYMMDD>000001_waitlist.sql
```

Tables:

- `waitlist_signups`
  - `id uuid pk default gen_random_uuid()`
  - `email citext unique not null`
  - `first_name text` (max 80)
  - `age_band text check (age_band in ('18-21','22-26','27-31','32-36','37-44','45+'))`
  - `gender text check (gender in ('female','male','nonbinary','prefer_not_to_say'))`
  - `city text not null default 'dublin'` — gate to Dublin in app code; column lets us expand
  - `why_signup text` (max 500) — open-text user research field
  - `referral_code text unique not null default encode(gen_random_bytes(6),'base64')` — referrer's outbound link
  - `referred_by_code text references waitlist_signups(referral_code)` — nullable
  - `position int` — assigned by trigger on insert (= row count + 1)
  - `gender_weighted_score numeric default 0` — mutated by trigger on referrals; used for "skip the line" math (see §2.2)
  - `email_confirmed_at timestamptz`
  - `email_confirmation_token text unique`
  - `consent_marketing boolean not null default false` — explicit GDPR opt-in
  - `consent_privacy boolean not null default false` — must be true to insert (CHECK)
  - `ip_hash text` — sha256 of IP for fraud dedup, never raw IP
  - `user_agent text`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`

- `waitlist_referrals` — denormalised event log for analytics & fraud
  - `id uuid pk`
  - `referrer_id uuid references waitlist_signups(id) on delete cascade`
  - `referred_id uuid references waitlist_signups(id) on delete cascade`
  - `referrer_gender text` — snapshotted at attribution time
  - `referred_gender text`
  - `score_awarded numeric` — 1.0 base, 2.0–3.0 for female-to-female (see §2.2)
  - `created_at timestamptz default now()`
  - `unique (referrer_id, referred_id)`

- `waitlist_share_events` — clicks on share buttons (whatsapp/x/copy)
  - `id`, `signup_id`, `channel text`, `created_at`

RLS (default deny; mirrors patterns in `supabase/migrations/20260322000001_fix_rls_policies_and_security.sql`):

- `alter table … enable row level security;`
- No SELECT/INSERT/UPDATE policies for `anon` or `authenticated`. **All writes go through the edge function using the service role key.** All reads happen through `SECURITY DEFINER` RPCs that return scalar/aggregate data, never PII.

RPCs:

- `waitlist_count_dublin()` → `int` — `SECURITY DEFINER`, returns `count(*) from waitlist_signups where city='dublin' and email_confirmed_at is not null`. Granted to `anon`. This drives the live counter.
- `waitlist_signup_status(p_email citext)` → `jsonb` — returns `{position, referral_code, referred_count, email_confirmed}` for the user's own status page (rate-limited via edge function).
- `waitlist_position_for_code(p_code text)` → `jsonb` — returns position + referred_count for the success page.
- `claim_waitlist_signup(...)` — only ever called by the edge function (service role); does the dedup, position assignment, referral attribution, returns `{position, referral_code, was_new}`.
- `apply_referral_score(p_referrer_id uuid, p_referred_id uuid)` — invoked by trigger on `email_confirmed_at`; resolves gender-weighted score, inserts into `waitlist_referrals`, increments `gender_weighted_score` on referrer.

Migration must end with `select pg_notify('pgrst','reload schema');` per `CLAUDE.md` → Project safety rules.

**Edge function:** `supabase/functions/waitlist-signup/index.ts`

- Pattern: copy structure from `supabase/functions/push/` and `validate-receipt/`.
- Method: POST only.
- Body: `{ email, first_name, age_band, gender, city, why_signup, referred_by_code, consent_marketing, consent_privacy }`
- Validates: email format; city == 'dublin'; consent_privacy true; rate-limit per IP hash (5 req / hour, in-memory or Upstash Redis if cheap); honeypot field rejected.
- Calls `claim_waitlist_signup` RPC.
- Sends confirmation email via Resend with confirmation token link.
- Returns `{position, referral_code}` JSON.

**Email confirmation:** a second tiny edge function `waitlist-confirm` accepts the token, sets `email_confirmed_at`, fires `apply_referral_score` if the row has a `referred_by_code`. Only confirmed signups count toward `waitlist_count_dublin()` and toward referrer scores — this kills throwaway-email gaming.

### 2.2 Referral economy — reconciling skip-the-line vs +40/+20 credits

Brand & Growth §6.A locks the in-app reward at "referrer +40 credits, referee +20 when both mark 'went'." That is **post-install, in-app**, gated on actual dates. It does not solve the **pre-launch waitlist** problem (where there is no app to spend credits in).

Two complementary mechanics, do both:

1. **Pre-launch:** the **`gender_weighted_score`** field drives invitation order when beta opens. Each referral whose referee confirms email = +1.0 to referrer's score. Cross-gender or female-to-female = ×2.0. Capped at 5 scoring referrals per referrer (then plateaus to ×0.25 to discourage spam — Robinhood lesson). Order at beta-invite time: `order by gender_weighted_score desc, created_at asc`. This is Hinge's playbook adapted.
2. **Post-launch:** the +40/+20 credits remain exactly as Brand & Growth §6.A specifies. No change.

Referrers see "you're #X on the list — 5 friends moves you up to top tier" copy on their success page. They do NOT see live position changes from rivals (avoids gaming).

### 2.3 Resend (or alternative) — transactional + lifecycle

- Provider: **Resend** (€0 up to 3k emails/mo, EU sending region, fits the €200/mo cap).
- Domain: configure SPF/DKIM/DMARC on the existing `chem-irl` domain. One-time setup.
- Templates (React Email or plaintext):
  - `waitlist_confirm` — confirm your email, link to confirmation token
  - `waitlist_welcome` — position #N, your referral link, what happens next
  - `waitlist_referral_landed` — fires when a friend confirms via your link
  - `waitlist_d7_nudge` — share with 2 single friends (couple-of-friends prompt from conversation)
  - `waitlist_beta_invite` — when their turn comes
- Lifecycle scheduling: Supabase scheduled function (`pg_cron`) running hourly, finds rows due for next email, calls Resend, marks state.

### 2.4 Frontend wiring — the static Next.js site

Files to modify:

- `web/src/app/download/page.tsx` — replace lines 93–106 with a controlled, multi-field form. Email + first name + age band (radio) + gender (radio) + city (locked to Dublin in beta, copy: "Dublin only for now") + why-signup (textarea, optional) + consent checkboxes. On submit: POST to edge function URL, show inline errors, on success route to `/waitlist/success?code=...`.
- `web/src/components/Footer.tsx` — keep the email field as a quick capture, but route it through the same edge function (don't duplicate logic). Or simpler: remove Footer email and link "Join waitlist →" to `/download`.
- **New page:** `web/src/app/waitlist/success/page.tsx` — accepts `?code=` query, calls `waitlist_position_for_code` RPC client-side via Supabase JS, shows: "You're #N on the Dublin list", referral link with copy button, three share buttons (WhatsApp / X / iMessage URL scheme), copy: "Want to skip the line? 5 single friends and you jump to the top tier."
- **New page:** `web/src/app/waitlist/[code]/page.tsx` — referral landing page. Pre-fills `referred_by_code` in the form. Static-export-compatible: use `generateStaticParams` returning empty + dynamic client routing, OR simpler — keep `/download?ref=CODE` query param and skip dynamic routes.
- **New component:** `web/src/components/WaitlistCounter.tsx` — client component, calls `waitlist_count_dublin()` RPC on mount with SWR-style revalidation. Replaces hardcoded "2,000+" on `download/page.tsx:153` and homepage. Show `null` (not "0") on first load to avoid the empty-app feel.
- **New lib:** `web/src/lib/waitlist.ts` — Supabase client init (anon key, public; do NOT bundle service role), `submitWaitlistSignup()`, `getWaitlistCount()`, `getStatusForCode()`. Mirrors `mobile/src/lib/supabase/client.ts` pattern but without the `LargeSecureStore` (web doesn't need encrypted session storage — there's no session).

Add `@supabase/supabase-js` to `web/package.json` via `bun add @supabase/supabase-js`. Confirm no breaking change for static export (it's client-side only — fine).

`.env.example` adds `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (already in `web/.env`).

### 2.5 Analytics

- **Plausible** (lightweight, GDPR-compliant, no cookie banner, EU-hosted). €9/mo for the basic plan — fits budget. Add via `<Script />` in `web/src/app/layout.tsx`.
- Custom events: `waitlist_form_started`, `waitlist_form_submitted`, `waitlist_email_confirmed` (server-side from the confirm function via Plausible API), `referral_share_clicked`, `referral_landing_viewed`.
- **PostHog free tier** (1M events/mo) optional; only add if you want funnel + replay. Defer to Phase B if budget is tight.

### 2.6 Anti-fraud & GDPR

- IP hash (sha256, no raw IP stored) + dedup: same hash twice in 60s = reject silently.
- Honeypot field in form (hidden `<input name="website">`; if non-empty → reject).
- Email confirmation required for any score / counter contribution.
- Disposable-email block list (use a static list, e.g. `mailinator.com`, `tempmail.com`, ~200 domains; refresh quarterly).
- Privacy: explicit consent checkbox, link to `/privacy`. Data deletion: a one-line edge function endpoint `waitlist-forget` that hard-deletes by email + token from confirmation. GDPR Art. 17.
- Cookie policy: with Plausible, no cookie banner needed; document that explicitly.

### 2.7 Operational (no code, but plan it)

- Supabase Studio query: weekly digest — total Dublin signups, gender split, top-10 referrers, % email-confirmed.
- Save these as `db/waitlist_ops_queries.sql` (reference, not migration).
- Create a `feat/waitlist-system` branch per `agent_docs/git_workflow.md`. The build is >5 files, so it'll be a multi-PR series, not one PR.

### 2.8 Build sequence inside Phase A

| Week | Deliverable | Definition of done |
|---|---|---|
| 0 | Migration drafted + reviewed (no apply yet) | Schema reviewed; RLS deny-all confirmed; safety review checklist done |
| 1 | Migration applied to staging Supabase; edge function `waitlist-signup` deployed (no email yet) | Internal POST returns `{position, code}` with curl |
| 2 | Resend configured; `waitlist_confirm` email + confirm function live | End-to-end POST → email → click → `email_confirmed_at` set |
| 3 | Form on `/download` wired; success page `/waitlist/success` live | 5 internal Dublin test accounts go through full flow |
| 4 | Referral attribution: `?ref=CODE` query, `referred_by_code` plumbed, `apply_referral_score` trigger live | Test: account A refers B, B confirms, A's score = 1.0 (or 2.0 if F→F) |
| 5 | Live counter component + replace static "2,000+" | Counter shows real Dublin number; updates within 60s of new confirm |
| 6 | Lifecycle emails (D0 welcome, D7 nudge); Plausible installed; share buttons | Each email rendered correctly across Gmail/Apple Mail/Outlook |
| 7 | Anti-fraud hardening (rate limit, honeypot, disposable block, hash IP); GDPR delete endpoint | Manual abuse test (10 req/sec, throwaway emails) all rejected |
| 8 | Production cutover: apply migration to prod Supabase, deploy edge functions to prod, ship Vercel build, smoke-test | 5 real friends sign up from 5 different networks; 100% success |

If any week slips, **slip the launch, do not skip a step.** A leaking waitlist that ships on time is worse than a tight one that ships in week 10.

---

## 3) Phase B — Cold start, 0 → 200 (Weeks 8–14)

Pre-condition: §2 done. The waitlist is live and instrumented.

These 200 do not come from referrals — referrals only compound after ~200. They come from manual, unscalable work. Aligns with Marketing Plan §13 Phase 0 (150–300 in 2 weeks via UGC + creator microtests) but the conversation's "5–8 niche communities + universities + content + direct outreach" is more concrete.

Channels (target conversions):

- **5–8 niche Dublin communities** — pick where "wants to meet someone serious" already self-selects: Sandymount/Phoenix Park run clubs, Gravity / Awesome Walls climbing gyms, GAA social leagues, Draíocht board game café, language exchanges, Dublin Hiking Club, book clubs. Show up in person, talk to organisers, pitch once. **Target: 20–30 signups per community = 100–240.**
- **Trinity / UCD / DCU** — postgrad and final-year students. Society newsletters at €50–100 each. **Target: 30–50.**
- **5–10 short-form videos** (TikTok / IG Reels) — philosophy-led ("the app for people tired of texting strangers for three weeks"), not feature explainers. One moderately viral Dublin video (~10k views) usually drives 200–400 signups for a well-positioned dating app. **Target: 50–150.**
- **30–50 personal direct messages** — individual asks, not a blast. "Sign up + send me 3 names of single friends 22–35." **Target: 100+.**

Floor 200, ceiling 500. Budget: <€100 (society newsletter buys + maybe €20 print QR codes for cafés/gyms). The €200/mo cap from Marketing Plan §5 is preserved.

Gate to advance: **200 confirmed Dublin signups, ≥40% female.** If male skew is worse than 60/40 by week 14, do not advance — it gets harder to fix once compounding starts. Apply the female-creator-budget lever from Marketing Plan §13 Phase 2 early.

---

## 4) Phase C — Referral compounding, 200 → 1,500 (Weeks 14–22)

Pre-condition: 200 confirmed Dublin signups; gender skew within bounds.

Mechanics already built in Phase A. What changes is **promotion** of the referral mechanic to existing waitlisters:

- **D0 welcome email** already includes the referral link (built in §2.3).
- **D7 nudge** explicitly asks for **two specific single friends** (Hinge's "couple-of-friends" mechanic). Two named asks beats "share this link."
- **Female referrals weighted ×2** — make this visible: "Female friends move you up faster — we're keeping things balanced."
- **Cap at 5 scoring referrals**, then ×0.25 plateau — copy: "After 5 friends, you're already top tier. More invites are great but won't move you further."
- **Geographic gating in copy** everywhere: "Dublin only for now. Tell your single Dublin friends — they need to be in before launch."

Optional (decide week 16): **public top-20 leaderboard** — first names + neighbourhood ("Aoife from Rathmines, 14 referrals"). High virality, but it incentivises fraud. Only enable if anti-fraud (§2.6) is holding up. Defer-by-default.

Expected K-factor: 1.5–2.0 referrals per signup over 8 weeks → 200 → ~600 → ~1,400. Realistic range 1,200–1,800.

Gate to advance: **1,500 Dublin signups, ≤60/40 male skew, ≥30% have answered the "why signup" field.** That last one is your single most valuable user-research artifact going into beta — read every entry.

---

## 5) Phase D — Closed beta, 400 active (Weeks 22–28)

Invite top 400 from the waitlist by `gender_weighted_score desc, created_at asc`. **Invite women ahead of pace** — to hit 50/50 active inside the app, the invite cohort needs to be ~55/45 female because women drop off harder (Marketing Plan §1).

Run for 4–6 weeks. Validate:

- Confirm-in-24h rate (proxy for whether structured proposals work).
- Female confirm-in-24h ≥ 35% sustained for 14 days (Marketing Plan §1 gate).
- Verification ≥ 70% (same gate).
- Median time-to-date ≤ 7 days.
- Show-rate ≥ 75% (no-shows are the killer for word-of-mouth).
- No Sev-1 trust incidents (catfish, harassment that the moderation SLA missed).

Activities: weekly call with 5 randomly-sampled active users, Sev-1 review of every report, gender-balance dashboard daily.

Gate to soft launch: all five quantitative gates held for ≥14 days, no Sev-1.

---

## 6) Phase E — Soft launch, 400 → 2,000 active (Weeks 28–36)

Open invites in waves of ~400 from the waitlist, weekly. Watch the gender gate at every wave; if female confirm-in-24h drops <35% for 7 days, **stop male invites** until it recovers (Marketing Plan §13 Phase 2). This is non-negotiable — Bumble built its market this way.

By week 36 the live counter should comfortably show >2,000 active in Dublin within 5km of any standard query. That is the density threshold below which the app feels dead and people churn before completing the loop.

Gate to public: payer share ≥ 6% MAU, K-factor ≥ 0.5, 4 consecutive weeks holding.

---

## 7) Phase F — Public Dublin launch, 2,000 → 5,000+ (Week 36+)

Lift the waitlist gate. Anyone in Dublin can install + verify + use the app. Keep city gating (no signups outside Dublin metro) until expansion criteria from Marketing Plan §21 hit.

This is also the point at which the waitlist counter component becomes a public installs counter, and the `download/page.tsx` page changes its primary CTA from "Join waitlist" to "Download" with App Store / Play Store badges.

---

## 8) Decision gates summary

| From → To | Quantitative gate | Qualitative gate |
|---|---|---|
| A → B | All §2.8 weekly DoDs met; 5 internal accounts complete full flow | No critical bugs in form submission, email delivery, or position assignment |
| B → C | 200 confirmed Dublin signups, ≥40% female | "Why signup" field gives genuine signal (not bot-like) |
| C → D | 1,500 Dublin signups, ≤60/40 skew, ≥30% answered why | Top-20 referrers look genuine (not gaming) |
| D → E | Female confirm-24h ≥35% (14d), verification ≥70%, show-rate ≥75%, median TTD ≤7d, zero Sev-1 | 5/5 user calls show the proposal flow makes sense |
| E → F | Payer share ≥6%, K-factor ≥0.5, gates from D held (4 weeks) | No regression in word-of-mouth tone (monitor r/ireland, TikTok mentions) |
| F → City 2 | 4 weeks of all gates held in Dublin; ≥1 month positive financial trend | Marketing Plan §21 |

---

## 9) Critical files

**Existing — to modify:**
- `web/src/app/download/page.tsx` (lines 93–106 form, line 153 hardcoded counter)
- `web/src/components/Footer.tsx` (Footer email field — link to /download instead, or wire to same endpoint)
- `web/src/app/page.tsx` (homepage — replace any static counter with `<WaitlistCounter />`)
- `web/.env.example` (add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`)
- `web/package.json` (add `@supabase/supabase-js`)

**New — to create:**
- `supabase/migrations/<TS>000001_waitlist.sql` (schema + RPCs + RLS + pg_notify reload)
- `supabase/functions/waitlist-signup/index.ts` (POST endpoint; mirror `supabase/functions/push/` shape)
- `supabase/functions/waitlist-confirm/index.ts` (token confirmation + referral score apply)
- `supabase/functions/waitlist-forget/index.ts` (GDPR delete)
- `web/src/lib/waitlist.ts` (Supabase client + helpers — do not bundle service role key)
- `web/src/components/WaitlistCounter.tsx` (live counter, SWR revalidate)
- `web/src/components/WaitlistForm.tsx` (extract form so it can be reused on `/download` and a referral landing variant)
- `web/src/app/waitlist/success/page.tsx` (post-signup with share buttons + position)
- `db/waitlist_ops_queries.sql` (reference queries for weekly digest)

**Reuse — patterns to copy:**
- `supabase/functions/push/` for edge function boilerplate (CORS, error shape, env validation)
- `supabase/migrations/20260322000001_fix_rls_policies_and_security.sql` for RLS pattern
- `mobile/src/lib/supabase/client.ts` for Supabase JS init pattern (web variant is simpler — no SecureStore)

**Strategy docs to honor / reference (do not modify):**
- `App Plans/Marketing Plan — Web‑first Launch, €200_mo Pre‑Revenue → Native (v1).txt` — north-star metrics, lifecycle map
- `App Plans/Brand & Growth — Identity, Narrative, Loops, PR (v2, updated positioning).txt` — referral economy, copy, voice
- `App Plans/Functional Spec — How the App Works (v3).txt` — proposal/confirm flow this all funnels into

---

## 10) Verification

**Phase A end-to-end (Week 8):**

1. From a clean browser session, open `https://chem-irl.com/download`. Confirm form has all fields and the live counter shows the real number, not 2,000+.
2. Submit a real email (use a Gmail alias) with `?ref=` from another seeded code. Confirm:
   - Browser routes to `/waitlist/success?code=…`
   - Position number renders within 1s
   - All three share buttons produce the expected URL with the user's own code embedded
3. Receive `waitlist_confirm` email within 60s. Click confirmation link.
4. Verify in Supabase Studio:
   - `email_confirmed_at` set
   - `waitlist_referrals` row created
   - Referrer's `gender_weighted_score` incremented (×2.0 if F→F)
   - `waitlist_count_dublin()` RPC return value increased by 1
5. Receive `waitlist_welcome` email immediately after confirmation; receive `waitlist_d7_nudge` after 7 days (test by manually forwarding the cron clock in staging).
6. Submit the same email twice — second submit returns existing position, doesn't duplicate.
7. Submit with disposable email (`@mailinator.com`) — rejected with friendly error.
8. Submit 6 times within a minute from the same IP — first 5 OK, 6th rate-limited.
9. Hit `/waitlist-forget?token=…` — row deleted; counter decremented; no orphaned `waitlist_referrals` rows (cascade works).
10. Plausible dashboard shows `waitlist_form_submitted` and `waitlist_email_confirmed` events.

**Phase B–F gate verification:** Supabase Studio queries (saved in `db/waitlist_ops_queries.sql`):

```sql
-- Total confirmed Dublin signups by gender
select gender, count(*) from waitlist_signups
where city='dublin' and email_confirmed_at is not null
group by gender;

-- Top-20 referrers by score (for beta-invite ordering)
select first_name, gender, gender_weighted_score, position
from waitlist_signups
where city='dublin' and email_confirmed_at is not null
order by gender_weighted_score desc, created_at asc
limit 20;

-- "Why signup" sample for user research
select why_signup from waitlist_signups
where city='dublin' and email_confirmed_at is not null and length(why_signup) > 20
order by random() limit 50;

-- K-factor proxy (referrals per confirmed signup, last 7 days)
with new_signups as (
  select id from waitlist_signups
  where email_confirmed_at > now() - interval '7 days'
), new_referrals as (
  select count(*) c from waitlist_referrals
  where created_at > now() - interval '7 days'
)
select (select c from new_referrals)::float / nullif((select count(*) from new_signups),0) as k_factor;
```

In-app gates (Phase D onward) are validated through the existing event taxonomy in Marketing Plan §11; that is out of scope for the waitlist build but the events are already fired by the mobile app.

---

## 11) What this plan does not cover (and why)

- **Mobile app readiness for beta** — out of scope. Marketing Plan and Functional Spec already cover the in-app loop. This plan only covers getting the right people on the waitlist and ordering them for invite.
- **Trust & Safety SOPs** — covered by `App Plans/Trust & Safety Pack v1`. Required before Phase D opens but not blocking Phase A build.
- **Payments / monetisation** — referenced in gates (payer share ≥6%) but the Stripe/RevenueCat work is in `Development Plan v1` and `Functional Spec v3`. Not blocked by waitlist build.
- **Native app store listings** — needed before Phase E soft launch, not before Phase A.
- **Switching the marketing site away from `output: 'export'`** — not needed. All dynamic behaviour goes through Supabase edge functions on the client. Static export stays.

---

## 12) Open questions before execution

Lock these before kicking off Week 0:

1. **Phasing numbers** — confirm the larger numbers in §1 (Recommended) vs Marketing Plan v1's smaller numbers. Plan assumes the larger.
2. **Resend vs another ESP** — Resend is recommended for fit + price. If you have an existing Mailchimp/ConvertKit you'd rather use, that changes §2.3 only.
3. **Plausible vs PostHog vs both** — Plausible alone covers the basics. PostHog adds funnel/replay for €0 on free tier. Recommend Plausible Phase A, add PostHog Phase B if useful.
4. **Public referrer leaderboard** — defer-by-default (Phase C, week 16 decision). Confirm OK to defer.
5. **Lifecycle email cadence** — D0/D7 are confirmed in Marketing Plan §8. Add D14 share-progress and D30 stay-tuned? Recommend yes; flag if you want a different cadence.

Recommend treating questions 2–5 as "decide as we hit them, do not block Week 0." Question 1 should be locked now.
