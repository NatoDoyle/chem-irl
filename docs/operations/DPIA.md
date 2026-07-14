# Data Protection Impact Assessment (DPIA) + Article 30 Records

**Status: DRAFT for DPO / legal review — not legal advice.** A dating app
processes special-category data (sexual orientation) and does large-scale
profiling with location, so a DPIA is **mandatory** under GDPR Art. 35.
This draft is grounded in the system as built (2026-06-17; §2.6, GAP-8
and ROPA addendum 2026-07-06; §2.7 telemetry addendum 2026-07-09) so a reviewer
starts from facts, not a blank page. Sign-off by a qualified data
protection adviser is required before public launch.

- **Controller:** Chem IRL (entity/registration TBD — fill before filing).
- **Lead supervisory authority:** Data Protection Commission (Ireland).
- **Contact:** hello@chemirl.app (designate a DPO/privacy contact — TBD).
- **Scope:** the mobile app + Supabase backend + marketing site/waitlist.

## 1. Why a DPIA is required (Art. 35 triggers)

At least three triggers apply:

1. **Special-category data at scale** — the app collects `orientation`
   (sexual orientation), Art. 9(1) data. `gender` and `interested_in`
   compound this.
2. **Systematic profiling** — the Seriousness Score (Elo-style ranking
   from behavioural signals) and discovery ranking evaluate users to
   decide who they see and are seen by.
3. **Large-scale processing of location data** — approximate location
   (`last_known_lat/lng`) drives 5 km discovery.

## 2. Nature, scope, context, purposes

### 2.1 Data categories processed

| Category | Fields | Special category? |
|---|---|---|
| Identity | email, full_name, dob | dob → age (not special) |
| **Sexual life/orientation** | orientation, interested_in, gender | **YES — Art. 9** |
| Photos | profile photos, verification selfie | biometric *only if* used for unique ID — see §6 |
| Location | last_known_lat/lng (approx), city, timezone | not special; sensitive |
| Lifestyle | drinking, smoking, drugs, diet, activity, family_plans, pets, height, languages, interests, love_language, personality, astrology, job, education, bio, prompts | drugs/health-adjacent — assess |
| Communications | messages, availability, proposals, confirms | content data |
| Behavioural | likes, match outcomes, response latency, scoring signals, surveys | profiling inputs |
| Device/technical | push tokens, device_id, IP hash (waitlist), Sentry crash context (PII-scrubbed) | not special |
| Commercial | token balance/ledger, subscription status, purchase idempotency keys | not special |
| Safety | reports, enforcements, durable ban hashes | criminal-adjacent — handle carefully |
| AI (Iris, opt-in) | conversation transcripts + derived profile | may contain any of the above |

### 2.2 Purposes & lawful bases (Art. 6) + special-category condition (Art. 9)

| Purpose | Art. 6 basis | Art. 9 condition (if applicable) |
|---|---|---|
| Provide matching/discovery | 6(1)(b) contract | **9(2)(a) explicit consent** for orientation — see §5 GAP-1 |
| Age assurance (18+) | 6(1)(c) legal obligation / 6(1)(b) | — |
| Safety, moderation, bans | 6(1)(f) legitimate interest (user safety, abuse prevention) | 9(2)(g) substantial public interest *or* consent — assess |
| Payments / IAP | 6(1)(b) contract | — |
| Push notifications | 6(1)(a) consent (OS permission) | — |
| Anti-fraud (waitlist rate-limit, IP hash) | 6(1)(f) legitimate interest | — |
| Iris AI concierge | 6(1)(a) consent (opt-in feature) | 9(2)(a) explicit consent |
| Product analytics | 6(1)(a) consent (PENDING vendor decision D1) | — |
| Marketing email | 6(1)(a) consent (separate `consent_marketing`) | — |

### 2.3 Recipients / processors (see Art. 30 ROPA, §8)

Supabase (hosting, eu-west-1), Resend (email, EU SES), Sentry (crash —
PII scrubbed at source), Apple/Google (payment + receipt verification),
Anthropic (Iris, and the photo-moderation fallback path — ~30-day API
retention unless ZDR), Expo (push relay), Bronto (bronto.io — operational
telemetry/log ingest for app observability: pseudonymous UUIDs +
PII-scrubbed event payloads only, EU ingest endpoint, see §2.7), and the
first-party **Chem IRL Solutions platform** (solutions.chemirl.app —
photo moderation + support intake forwarding, see §2.6).
No data sold; no third-party advertising/tracking SDK as of this draft.

### 2.4 Retention

Account data: until user deletion (in-app, immediate hard delete).
`enforcement_bans` (sha256 hashes, no plaintext): retained indefinitely
under legitimate interest (re-registration prevention). `iap_transactions`:
retained for purchase-replay protection. Waitlist: until erasure (self-
serve for unconfirmed). Define explicit max-retention for inactive
accounts — see GAP-3.

### 2.5 International transfers

Primary processing is EU (Supabase eu-west-1). US processors (Sentry,
Apple, Google, Anthropic, possibly Expo/Resend infra) require a transfer
mechanism (SCCs / adequacy). Bronto telemetry ingests at an EU endpoint
(ingestion.eu.bronto.io); confirm Bronto's storage region, retention
default, and DPA alongside the rest — see GAP-4. Confirm each
processor's DPA + transfer basis before launch — see GAP-4.

### 2.6 First-party forwards to the Chem IRL Solutions platform (2026-07-06; as-built review 2026-07-13)

Two Supabase edge functions can forward data to the Chem IRL Solutions
platform (`solutions.chemirl.app`) — the company's own B2B platform, with
the dating app as its first tenant. Both paths are env-gated (active only
while the corresponding function secrets are set; enabled in production
since 2026-07-04) and **fail open**: if the platform call errors or times
out, the function falls back to its original behaviour and the user flow
is unaffected. Both recipients are operated by the same controller today
(see the entity note at the end of this section).

1. **Photo moderation** — `moderate-photo` POSTs **base64 photo bytes +
   media type only** to the platform's `/api/v1/moderate` (gate:
   `PHOTO_PLATFORM_URL/KEY`; auth: hashed workspace API key). No user ID,
   storage path, or other identifier crosses the boundary — the image is
   anonymous bytes to the platform. Platform-side processing is
   **transient**: the image is passed to the AI subprocessor in a single
   inference call and is not written to any platform database row,
   storage bucket, or cache; the only persisted record is a
   `usage_events` metering row (op + decision + cost — no image, no
   identifier; retained indefinitely). The AI subprocessor is **TensorX
   Ltd (Tensorix)**, Ireland — EU-only inference (Dublin/Helsinki),
   contractual zero-retention and no-training (ToS §3.3–3.4), acting as
   processor; note its ToS **prohibits special-category (Art. 9) data
   without a prior written agreement**, which is not yet in place
   (GAP-8). Fallback paths (any platform failure, or platform
   misconfiguration) go to Anthropic (US, ~30-day API retention unless
   ZDR). Verdicts are audited app-side in `photo_verification_checks`
   (cascade-deleted with the account) with backend provenance recorded;
   the app flow is identical whichever backend ran. The match check is
   LLM-vision identity-*consistency* checking, explicitly not biometric
   identification or liveness detection (relevant to §6).
2. **Support intake** — `support-submit` stores every submission in
   `support_submissions` (system of record; a forwarding failure never
   loses the submission), then — only for submissions that include an
   email — forwards **email, display name, subject, full message body,
   submission UUID, kind + per-kind whitelisted metadata** to the
   platform's `/api/v1/intake` (gate: `SUPPORT_AGENT_INTAKE_URL/KEY`).
   The hashed IP and user agent stored app-side are **not** forwarded.
   On the platform the submission is **persisted** as a support thread +
   message (email, name, subject, body, metadata) readable only by Chem
   IRL workspace members under RLS; the message content (subject, body,
   recent thread history — which can include the sender's email) is sent
   to the AI subprocessor (TensorX Ltd, as above; zero-retention/EU) to
   draft a reply into a human review queue — intake replies are never
   auto-sent. **Platform-side retention is currently indefinite: no TTL,
   scheduled purge, or dashboard deletion exists for threads/messages,
   and the DSAR erasure runbook does not yet reach these copies**
   (GAP-8 remediation item).

**Regions:** both Supabase projects — the app's and the platform's — are
eu-west-1, Ireland (verified via the Supabase Management API,
2026-07-13), and Tensorix inference is EU-only, but the platform's
Vercel functions are **not region-pinned in code** — absent a dashboard
setting they run in Vercel's US default region, so forwarded photo bytes
and support text transit US compute in between EU endpoints. Confirm/pin
the Vercel region (GAP-8).

**Logging:** neither forward places photo bytes, message bodies, or
emails in app-side telemetry (events carry pseudonymous user_id +
outcome flags only, per §2.7). Platform-side failure logging on the
photo path uses an unredacted `console.error`; hardening item under
GAP-8.

**Entity note:** both systems are operated by the same controller
today. CHEM IRL SOLUTIONS LTD incorporation is in progress; once the
platform sits in a separate legal entity these forwards become
controller→processor arrangements requiring a DPA (including an Art. 9
addendum for the photo flow), sub-processor flow-down to TensorX, and
privacy-policy disclosure — see GAP-8 and GAP-4.

### 2.7 App telemetry to Bronto (2026-07-09)

Operational telemetry for the whole product ships to Bronto (bronto.io,
log-ingest SaaS; dataset `chem-irl-app`) so failures and business events
are observable — see
[BRONTO_APP_OBSERVABILITY.md](../infrastructure/BRONTO_APP_OBSERVABILITY.md).

**What is shipped:** edge-function request metadata (function name,
request id, status, duration, outcome events with counts/flags),
mirrored rows from `analytics_events` (client funnel events),
`scoring_events` (domain events) and `ops_events` (cron-job outcomes),
and CI run outcomes. Events carry the pseudonymous `user_id` UUID where
relevant. Since 2026-07-11 `analytics_events` also includes
`client_error` rows recorded by the mobile app on handled errors and
render crashes: error class name, error message (PII-scrubbed at the
device, truncated), severity/level, and screen/action context — no
stack traces, no device identifiers.

**What is never shipped:** message bodies, emails, phone numbers,
photos/photo bytes, storage paths, confirmation/unsubscribe tokens, or
free-text subjects/bodies. Every payload passes the shared PII scrubber
at source (drops message/body/email/phone-class keys, hashes
email/phone patterns, masks photo-URL keys); request paths are logged
without query strings.

**Design properties:** strictly fail-open (a Bronto outage cannot affect
any user flow); ingest endpoint is EU (`ingestion.eu.bronto.io`).

**Deletion note:** `analytics_events` rows cascade-delete with the
account, but Bronto-side copies of already-shipped events (pseudonymous
UUID + event metadata) persist until Bronto's retention expires — the
erasure cascade does not reach Bronto. Record Bronto's retention
period + DPA under GAP-4 and reflect telemetry in the privacy policy
alongside GAP-6. (Bronto is the sole telemetry processor — decision
2026-07-10: no Sentry.)

## 3. Necessity & proportionality

- **Data minimisation:** lifestyle fields are optional; location is stored
  as approximate; IPs are hashed, never stored raw; bans store hashes, not
  identifiers. Good posture overall.
- **Proportionality to assess:** the breadth of optional profile
  attributes (astrology, personality, etc.) is justified by match quality
  but should be confirmed as genuinely optional and not gating.

## 4. Risks to data subjects

| # | Risk | Likelihood | Severity | Inherent |
|---|---|---|---|---|
| R1 | Breach exposing orientation + location (outing / physical safety) | Low | **Very high** | High |
| R2 | Under-18 access (child safety, illegal content exposure) | Low | Very high | High |
| R3 | Stalking/harm via location precision | Medium | High | High |
| R4 | Unlawful special-category processing (no valid explicit consent) | **Medium** | High | High |
| R5 | Profiling harms / opacity (scoring affects visibility) | Medium | Medium | Medium |
| R6 | Processor breach / transfer exposure | Low | High | Medium |
| R7 | AI (Iris) leakage or retention beyond expectation | Low | Medium | Medium |
| R8 | Ban-hash re-identification (rainbow table on emails) | Low | Medium | Low |

## 5. Mitigations in place + gaps

**In place:** RLS on all tables (audited 2026-06-09, F1–F11 closed);
AES-256 session-token encryption (LargeSecureStore); hashed IPs and ban
identifiers; server-side photo moderation; mandatory 18+ gate (client +
DB CHECK + completion trigger); approximate-only location; EU hosting;
Sentry PII scrubbing; in-app erasure; durable bans that survive deletion
without retaining PII; fail-closed payment verification.

**Gaps / required actions:**

- **GAP-1 (R4, priority):** signup currently bundles 18+/Terms/Privacy
  into one checkbox. That is very likely **not** valid Art. 9 *explicit,
  granular* consent for processing sexual orientation. Action: add a
  distinct, unbundled explicit-consent step for special-category data
  (separate from the ToS acceptance), with its own record. Until then the
  lawful basis for orientation processing is questionable.
- **GAP-2 (R3):** document and, if needed, coarsen location granularity;
  confirm exact stored precision and whether it can be trilaterated.
- **GAP-3:** define + implement an inactive-account retention limit
  (auto-erase or notify after N months idle).
- **GAP-4:** complete the processor DPA + transfer-mechanism register
  (SCCs) for every US sub-processor.
- **GAP-5 (R2):** age assurance is self-declared DOB. Assess whether the
  DPC/risk profile warrants stronger age verification.
- **GAP-6 (R5):** prepare a plain-language explanation of the scoring/
  ranking logic for the privacy policy (transparency, Art. 13–14).
- **GAP-7 (R7):** confirm Anthropic ZDR status for the Iris API key;
  document Iris retention in the privacy policy.
- **GAP-8 (R6):** Solutions-platform forwards (§2.6). **Documented
  as-built (2026-07-13):** forwarded photo bytes are transient at the
  platform (no persistence; metering row only) and the AI subprocessor
  is TensorX Ltd (EU-only inference, contractual zero-retention +
  no-training, GDPR processor); forwarded support submissions ARE
  persisted platform-side (threads/messages/drafts, RLS-scoped to
  workspace members) with **no retention limit or deletion path**; both
  Supabase projects are eu-west-1 (verified via Management API); no user
  identifiers cross the photo boundary and IP/user-agent never cross the
  intake boundary. **Still open:**
  1. *(legal — blocking for the photo flow's Art. 9 posture)* Obtain the
     prior **written agreement with TensorX Ltd for special-category
     data** its ToS requires — dating-app photos and support texts can
     reveal Art. 9 data, and the platform's own partner terms demand the
     same addendum of tenants.
  2. *(legal — on incorporation)* Once CHEM IRL SOLUTIONS LTD exists,
     execute a **controller→processor DPA** between the app entity and
     the platform entity covering both forwards (with TensorX flow-down
     as sub-processor), and fold the platform into the GAP-4
     processor/transfer register.
  3. *(ops — dashboard)* **Confirm the platform's Vercel function region
     and pin it to an EU region** (no pinning exists in code; default is
     US) so EU→EU data stops transiting US compute.
  4. *(engineering)* Define **retention/erasure for platform-side intake
     threads** (TTL or purge job) and add a platform-erasure step to
     DSAR_RUNBOOK.md; harden the platform photo route's failure logging
     to use the redacting logger.
  5. *(docs)* Reflect both flows in the public privacy policy
     (chemirl.app/privacy), alongside GAP-6.

## 6. Biometrics note

Photo verification match-checks a selfie against profile photos. If this
uses facial-feature comparison for **unique identification**, it is Art. 9
biometric data needing its own explicit-consent condition. Confirm with
the `moderate-photo` implementation owner whether the match is
identity-grade biometric or a coarse similarity heuristic — this changes
the Art. 9 analysis. (Action item, not resolved in this draft.)

## 7. DPIA outcome (to be completed by reviewer)

Residual risk after mitigations + GAP closure: **TBD by DPO.** Highest
priority before public launch: GAP-1 (explicit consent), GAP-4 (transfers),
GAP-5 (age assurance stance). Recommend DPC consultation only if residual
high risk remains after mitigation (Art. 36).

## 8. Article 30 — Records of Processing Activities (ROPA)

Controller-side record. Keep current as processing changes.

| Processing activity | Purpose | Categories of data subjects | Categories of data | Recipients | Transfers | Retention | Security |
|---|---|---|---|---|---|---|---|
| Account + matching | Provide the service | App users (18+) | identity, orientation, location, lifestyle, photos, behavioural | Supabase | EU | until deletion | RLS, encryption, EU hosting |
| Messaging | In-app comms | Matched users | message content, timestamps | Supabase | EU | until deletion | RLS |
| Safety & moderation | Abuse/safety | Reporters, accused | reports, enforcements, ban hashes | Supabase | EU | bans indefinite (hashed); cases until account deletion | RLS, hashing |
| Payments | Token/sub purchases | Paying users | purchase ids, entitlement | Supabase, Apple, Google | US (SCCs TBD) | replay-protection retention | service-role only RPC |
| Notifications | Engagement | Opted-in users | push token, device_id | Supabase, Expo | US (confirm) | until disabled/deletion | webhook secret |
| Crash reporting | Reliability | All app users | scrubbed crash context | Sentry | US (SCCs TBD) | Sentry default | PII scrubbed pre-send |
| AI concierge (Iris) | Optional bio help | Opted-in users | transcripts, derived profile | Anthropic | US (confirm ZDR) | ~30d API unless ZDR; app rows until iris-forget | opt-in, JWT |
| Waitlist | Pre-launch growth | Prospects | email, UTM, IP hash, consents | Supabase, Resend | EU | until erasure | RLS, hashed IP, rate-limit |
| Transactional email | Confirmations | Users/prospects | email, name | Resend | EU (SES) | per Resend | DKIM/SPF |
| Photo moderation & verification (§2.6) | Safety: pre-publish photo checks, selfie match | App users | photo bytes (transient at platform + AI — zero-retention; never persisted platform-side), verification verdicts | Supabase; Chem IRL Solutions platform (Vercel + Supabase eu-west-1) → TensorX Ltd (AI, EU processor, zero-retention/no-training); Anthropic (US) fallback | Supabase (both projects) + Tensorix EU — verified 2026-07-13; Vercel function region unpinned — likely US transit (GAP-8); Anthropic fallback US (SCCs — GAP-4) | app-side verdict audit rows until account deletion (cascade); platform keeps a metering row (op/decision only, no image, indefinite); image bytes transient everywhere | JWT + path-ownership check, 30/hr rate limit, hashed workspace API key, fail-open backend switch, no user identifiers cross the boundary |
| Support intake forwarding (§2.6) | Support/inquiry handling with AI-drafted, human-reviewed replies | Users + site visitors (submissions with an email) | email, display name, subject, full message body, submission UUID, whitelisted metadata (IP hash + user agent NOT forwarded) | Supabase; Chem IRL Solutions platform (threads/messages/drafts, RLS to workspace members) → TensorX Ltd (AI drafting + embeddings, EU processor, zero-retention) | Supabase (both projects) + Tensorix EU — verified 2026-07-13; Vercel function region unpinned — likely US transit (GAP-8) | app row = system of record, until handled/erasure; **platform copy currently indefinite — no TTL or deletion path; DSAR runbook does not reach it (GAP-8)** | CORS allowlist, honeypot, IP-hash rate limit, env-gated fail-open forward, hashed workspace API key, drafts human-reviewed (no auto-send) |
| App observability/telemetry (§2.7) | Reliability, ops visibility, abuse detection | App users, site visitors (request metadata), operators | pseudonymous user_id UUIDs, event names, counts/flags, scrubbed payloads | Bronto (bronto.io) | EU ingest; confirm storage region + DPA (GAP-4) | Bronto retention (confirm — GAP-4); survives account deletion (§2.7) | PII scrubbed at source, fail-open, service-role-only pipeline |

## 9. Related documents

- [DSAR_RUNBOOK.md](./DSAR_RUNBOOK.md) — data-subject rights handling.
- [MODERATION_RUNBOOK.md](./MODERATION_RUNBOOK.md) — safety processing.
- [APP_REVIEW_COMPLIANCE.md](./APP_REVIEW_COMPLIANCE.md) — store privacy labels.
- Privacy Policy (chemirl.app/privacy) — public-facing; must reflect §2 + GAP-6/GAP-7 once closed.
