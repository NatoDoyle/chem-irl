# Data Protection Impact Assessment (DPIA) + Article 30 Records

**Status: DRAFT for DPO / legal review — not legal advice.** A dating app
processes special-category data (sexual orientation) and does large-scale
profiling with location, so a DPIA is **mandatory** under GDPR Art. 35.
This draft is grounded in the system as built (2026-06-17) so a reviewer
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
Anthropic (Iris — ~30-day API retention unless ZDR), Expo (push relay).
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
mechanism (SCCs / adequacy). Confirm each processor's DPA + transfer
basis before launch — see GAP-4.

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

## 9. Related documents

- [DSAR_RUNBOOK.md](./DSAR_RUNBOOK.md) — data-subject rights handling.
- [MODERATION_RUNBOOK.md](./MODERATION_RUNBOOK.md) — safety processing.
- [APP_REVIEW_COMPLIANCE.md](./APP_REVIEW_COMPLIANCE.md) — store privacy labels.
- Privacy Policy (chemirl.app/privacy) — public-facing; must reflect §2 + GAP-6/GAP-7 once closed.
