# Store Submission Pack (App Store + Google Play)

Copy-paste source for every text field, questionnaire answer, and config
value the store consoles ask for. Companion to
[APP_REVIEW_COMPLIANCE.md](./APP_REVIEW_COMPLIANCE.md) (policy: what we
must satisfy) — this file is the operational half (the exact strings to
paste). Grounded in the shipped app as of 2026-07-13.

Everything in SCREAMING [BRACKETS] needs the owner; §9 lists where each
value comes from. Everything else is paste-ready — do not soften or
re-hedge the copy blocks.

App identity (verified in `mobile/app.json`):

| Field | Value |
|---|---|
| iOS bundle ID | `app.chemirl.mobile` |
| Android package | `app.chemirl.mobile` |
| EAS project ID | `40fbab02-b775-4e8b-9b3c-011528e37684` |
| Version source | remote (`eas.json` → `appVersionSource: "remote"`) |

---

## 1. App Store listing (App Store Connect → App Information / Version)

| Field | Value | Limit |
|---|---|---|
| Name | `Chem IRL` | 30 |
| Subtitle | `Stop talking, start meeting.` | 30 (28 used) |
| Primary category | Lifestyle | — |
| Secondary category | Social Networking | — |
| Support URL | `https://chemirl.app/support` | — |
| Marketing URL | `https://chemirl.app` | — |
| Privacy Policy URL | `https://chemirl.app/privacy` | — |
| Copyright | `© 2026 CHEM IRL SOLUTIONS LTD` | — |

**Promotional text** (170 max; editable without review — 149 used):

> Match, propose 2–3 real times, and meet within 7 days. Proposals expire after 72 hours — no pen pals, no endless chat. Dating for people who show up.

**Description:**

> Chemistry and vibe aren't on a screen. Chem IRL exists to get two interested people from "matched" to sitting across from each other — in days, not months.
>
> Here's how it works. Match with someone, then propose 2–3 specific meeting times within the next 7 days. They pick one, or counter. Proposals expire after 72 hours, so plans get made while the interest is real. No pen pals. No three-week chats that go nowhere.
>
> Say what you want, honestly. Casual, long-term, open, exploring — Chem IRL is intent-agnostic. What matters is that you know what you want, you say it, and you show up. Profiles are built around honest intent, and the app is built around action.
>
> Built for safety from day one: Chem IRL is 18+ only, every photo passes server-side moderation, and photo verification keeps profiles real. Report and block from any profile or chat — reports are actioned within 24 hours. Delete your account any time, directly in the app.
>
> Chem IRL is launching in Dublin. Optional extras: Chem+ (monthly subscription) unlocks unlimited browsing, and token packs let you reactivate an expired match.
>
> Terms of Use: https://chemirl.app/terms
> Privacy Policy: https://chemirl.app/privacy

(The Terms/Privacy links in the description are required metadata for
apps selling auto-renewable subscriptions — leave them in.)

**Keywords** (100 max; comma-separated, no spaces — 98 used):

```
dating,meet,meetup,irl,singles,dublin,ireland,match,first date,relationship,love,chemistry,serious
```

---

## 2. Google Play listing (Play Console → Store presence)

| Field | Value | Limit |
|---|---|---|
| App name | `Chem IRL` | 30 |
| Category | Dating | — |
| Contact email | `hello@chemirl.app` | — |
| Contact website | `https://chemirl.app` | — |
| Privacy policy | `https://chemirl.app/privacy` | — |

**Short description** (80 max — 76 used):

> Propose real times, meet within the week. Dating optimized for actual dates.

**Full description** (4000 max):

> Chemistry and vibe aren't on a screen. Chem IRL exists to get two interested people from "matched" to sitting across from each other — in days, not months.
>
> HOW IT WORKS
> • Match with someone near you.
> • Propose 2–3 specific meeting times within the next 7 days.
> • They pick one, or counter. Proposals expire after 72 hours.
> • Confirm, show up, and find out in person.
>
> No pen pals. No three-week chats that go nowhere. Plans get made while the interest is real.
>
> HONEST ABOUT WHAT YOU WANT
> Casual, long-term, open, exploring — Chem IRL is intent-agnostic. What matters is that you know what you want, you say it, and you show up. Profiles are built around honest intent, and the app is built around action.
>
> BUILT FOR SAFETY
> • 18+ only, enforced at signup.
> • Every photo passes server-side moderation; photo verification keeps profiles real.
> • Report and block from any profile or chat — reports are actioned within 24 hours.
> • Delete your account any time, directly in the app.
>
> Chem IRL is launching in Dublin. Optional extras: Chem+ (monthly subscription) unlocks unlimited browsing, and token packs let you reactivate an expired match.
>
> Terms of Use: https://chemirl.app/terms
> Privacy Policy: https://chemirl.app/privacy

---

## 3. Age-rating questionnaires (answer honestly — expect 17+/18+)

Understating any answer is a rejection risk far worse than the rating
itself ([APP_REVIEW_COMPLIANCE.md](./APP_REVIEW_COMPLIANCE.md) § Age
assurance). Exact questionnaire wording shifts over time; the answers
below map to the facts of the app — if a question isn't listed, derive
the answer from the same facts.

### 3.1 Apple (App Store Connect → App Information → Age Rating)

| Question topic | Answer | Why |
|---|---|---|
| Cartoon/realistic violence, horror, medical/treatment info | None | Not present |
| Profanity or crude humor | Infrequent/Mild | Possible in UGC (bios, chat); moderated |
| Mature/Suggestive themes | Frequent/Intense | It is a dating app; select honestly |
| Sexual content or nudity | None | Prohibited and enforced by server-side photo moderation |
| Alcohol, tobacco, or drug use or references | Infrequent/Mild | Optional lifestyle profile fields (drinking/smoking/drugs) |
| Simulated gambling / contests | None | Not present |
| Unrestricted web access | No | No in-app browser |
| App facilitates dating / connecting with strangers | Yes | Core product |
| Users can communicate with other users | Yes — with people they don't know | Match chat |
| User-generated content | Yes — with moderation, reporting, and blocking | Photos, bios, messages; `moderate-photo`, `submit_report`, `block_user` |
| Made for Kids | No | 18+ product |

**Expected outcome:** 17+ on the legacy scale / 18+ on the current
tiered scale. Accept it — do not tune answers downward to hit a lower
tier.

### 3.2 Google Play (IARC questionnaire, Play Console → App content)

| Question topic | Answer | Why |
|---|---|---|
| App category | Social networking / dating | Core product |
| Violence, blood, horror | No | Not present |
| Sexual material or nudity | No | Prohibited; server-side photo moderation |
| Profanity | Yes, possible in user content | Moderated UGC |
| References to alcohol, tobacco, illegal drugs | Yes — references only | Optional lifestyle profile fields |
| Simulated gambling / real gambling | No | Not present |
| Users can interact or exchange content | Yes | Chat, photos, profiles |
| Users can share their physical location with other users | No | Approximate location drives discovery internally; never displayed to other users |
| App shares user-provided personal info with third parties | No | Processors only (see §4.2 sharing note) |
| Contains ads | No | No ad SDK |

**Expected outcome:** Mature 17+ (ESRB) / PEGI 18 territory. Also
complete the Play "Dating apps" declarations under App content — the
answers all follow from [APP_REVIEW_COMPLIANCE.md](./APP_REVIEW_COMPLIANCE.md)
(report + block + moderation + published contact + 18+ gate).

---

## 4. Privacy labels worksheet

Source of truth: [DPIA.md](./DPIA.md) §2.1 (data categories), §2.3
(processors), §2.7 (telemetry). Facts that drive every row: data is
collected **and linked to identity** (accounts are identified; telemetry
carries the account UUID); **nothing is used for cross-app/ad tracking**
(no third-party advertising or tracking SDK — analytics is
Supabase-native `analytics_events` + first-party Bronto telemetry,
decision 2026-07-10). No ATT prompt is required because no tracking
occurs.

### 4.1 Apple privacy nutrition labels (exact selections)

| Apple data type | Collected? | Linked to identity? | Tracking? | Purposes |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | Yes | Yes | No | App Functionality |
| Contact Info → Phone Number | No | — | — | Email-OTP auth only; never collected |
| Sensitive Info (sexual orientation, gender, relationship intent, lifestyle incl. drinking/smoking/drugs fields) | Yes | Yes | No | App Functionality |
| User Content → Photos or Videos | Yes | Yes | No | App Functionality |
| User Content → Other User Content (bio, prompts, in-app messages, opt-in Iris transcripts) | Yes | Yes | No | App Functionality |
| User Content → Emails or Text Messages | No | — | — | In-app chat is declared under Other User Content (it is not email/SMS) |
| Location → Coarse Location | Yes | Yes | No | App Functionality (discovery/distance filtering) |
| Location → Precise Location | No | — | — | See caveat below |
| Financial Info → Purchase History | Yes | Yes | No | App Functionality (token/subscription entitlements) |
| Identifiers → User ID | Yes | Yes | No | App Functionality, Analytics |
| Identifiers → Device ID (push token, device_id) | Yes | Yes | No | App Functionality (push notifications) |
| Usage Data → Product Interaction | Yes | Yes | No | Analytics, App Functionality |
| Diagnostics → Crash Data | Yes | Yes | No | App Functionality (client_error telemetry is PII-scrubbed but keyed by account UUID → "linked") |
| Other Data (date of birth) | Yes | Yes | No | App Functionality (18+ gate, age filters) |
| Health & Fitness, Contacts, Browsing History, Search History, Financial (other) | No | — | — | Not collected |

**Location caveat (owner judgment):** the app requests
`Location.Accuracy.Balanced` (~100 m) and stores lat/lng for ~km-scale
discovery only (`LocationPermissionScreen.tsx`; DPIA calls it
approximate). Apple defines "precise" as ≥3 decimal places of lat/lng,
and ~100 m sits at that boundary. Coarse is the honest selection for how
the data is requested and used; if App Review pushes back, switch the
row to Precise Location (same purposes) rather than argue.

### 4.2 Google Play Data safety form (equivalents)

Global answers: **Collects data: Yes. Shares data: No** (all transfers —
Supabase, Resend, Apple/Google receipt APIs, Anthropic/Solutions-platform
photo moderation, Expo push, Bronto telemetry — are service providers
processing on our behalf, which Play's definition excludes from
"sharing"; see DPIA §2.3/§2.6/§2.7). **Encrypted in transit: Yes.
Deletion mechanism: Yes** — in-app (Settings → Delete Account, immediate
hard delete).

| Play category → type | Collected | Purpose |
|---|---|---|
| Personal info → Name | Yes | App functionality |
| Personal info → Email address | Yes | App functionality, Account management |
| Personal info → User IDs | Yes | App functionality, Analytics |
| Personal info → Sexual orientation | Yes | App functionality |
| Personal info → Other info (DOB, gender, relationship intent, lifestyle fields) | Yes | App functionality |
| Photos and videos → Photos | Yes | App functionality |
| Messages → Other in-app messages | Yes | App functionality |
| Location → Approximate location | Yes | App functionality |
| Financial info → Purchase history | Yes | App functionality |
| App activity → App interactions | Yes | Analytics, App functionality |
| App info and performance → Crash logs, Diagnostics | Yes | Analytics, App functionality |
| Everything else (contacts, precise location, audio, calendar, ads data, etc.) | No | — |

**Known gap — account-deletion web URL:** Play Console asks for a URL
where users can request account deletion from outside the app. In-app
deletion exists; there is no dedicated web deletion page. Enter
`https://chemirl.app/support` and ensure the support page copy
explicitly mentions account-deletion requests (owner action — §9).

---

## 5. Reviewer notes + demo account

### 5.1 The fixed-code problem (decision needed before submission)

Auth is email OTP with no passwords (`signInWithOtp` → 6-digit code).
A reviewer cannot receive our emails, so the review account needs a code
that always works. **Supabase's built-in test-OTP feature is SMS-only**
(`sms_test_otp` in the auth config); as of this writing there is no
first-party fixed **email** OTP — verify in Dashboard → Authentication →
Providers → Email in case that has landed, then pick:

- **Option A (recommended): review-account bypass in the verify screen.**
  For `reviewy@chemirl.app` only, the client skips `signInWithOtp` and
  calls `signInWithPassword(email, enteredCode)`; the owner sets that
  password once via the Admin API. The printed code then works forever,
  unattended, with zero behavior change for every other address. Small
  client change in `mobile/src/lib/auth.ts` + the verify screen — needs
  its own PR (not part of this pack).
- **Option B (fragile, avoid):** raise email-OTP expiry to the max and
  paste a freshly generated code into Review Notes at submission time.
  Breaks if review takes longer than the expiry or the reviewer taps
  "resend code" (which invalidates the pasted one).

Whichever path: the fixed code is `[FIXED-OTP-CODE]` below.

### 5.2 Demo data (seeded, not manual)

`scripts/seed-review-demo.mjs` seeds everything the walkthrough needs:
the `safety@chemirl.app` moderator row, a completed profile on
`reviewy@chemirl.app`, and 7 fictional Dublin demo profiles that have
already "liked" the review account (so the reviewer's first like creates
a match instantly, unlocking chat/propose/report/block). **It has NOT
been run** — it requires both role accounts to exist first (one-time OTP
sign-in each) and owner-provided photos; see the script header.

### 5.3 Reviewer notes (paste into App Review Information / Play notes)

> DEMO ACCOUNT
> Email: reviewy@chemirl.app
> Verification code: [FIXED-OTP-CODE] (this account uses a fixed code — enter it on the code screen; no email access is needed. All other accounts receive one-time codes by email.)
>
> Chem IRL is an 18+ dating app launching in Dublin, Ireland. The demo account is pre-populated with fictional demo profiles operated by us, so Discover is a working feed. The demo profiles have already liked this account: liking any profile in Discover creates a match immediately, so you can reach every post-match feature in under a minute.
>
> Suggested walkthrough:
> 1. Sign in with the credentials above.
> 2. Discover tab: browse profiles, like one — a match is created.
> 3. Matches tab: open the match. Propose a date (pick 2–3 time windows within 7 days — this is the core mechanic; proposals expire after 72 hours). Send a chat message.
> 4. Safety: every profile and chat has a "…" menu with Report (8 categories; reports are actioned by our moderation team within a 24-hour SLA) and Block (blocking unmatches immediately and hides both users from each other everywhere).
> 5. Settings → Support links our published contact (chemirl.app/support).
> 6. Settings → Delete Account permanently deletes the account in-app (typed confirmation), no support ticket required.
> 7. Signup (any other email) requires date of birth — under-18 is a hard stop — and terms agreement.
> 8. In-app purchases: token packs (consumable) and the Chem+ monthly auto-renewing subscription are validated server-side via the App Store Server API / Google Play Developer API before any entitlement is granted.
>
> Moderation contact: safety@chemirl.app. General contact: hello@chemirl.app.

---

## 6. IAP display copy (en-US / en-IE)

Product IDs are hardcoded in `mobile/src/lib/iap.ts` — create the SKUs
with these exact IDs. Tokens are consumable (1 token reactivates one
expired match — `mobile/src/lib/tokens.ts`); Chem+ is an auto-renewing
monthly subscription. Apple limits: display name 30 chars, description
45 chars (the copy below fits both stores).

| Product ID | Type | Display name | Description | Price |
|---|---|---|---|---|
| `chem_tokens_3` | Consumable | `3 Chem Tokens` | `Reactivate expired matches — 3 tokens.` | [PRICE-TBD] |
| `chem_tokens_10` | Consumable | `10 Chem Tokens` | `Reactivate expired matches — 10 tokens.` | [PRICE-TBD] |
| `chem_tokens_25` | Consumable | `25 Chem Tokens` | `Reactivate expired matches — 25 tokens.` | [PRICE-TBD] |
| `chem_plus_monthly` | Auto-renewing subscription (monthly) | `Chem+ Monthly` | `Unlimited browsing. Auto-renews monthly.` | [PRICE-TBD] |

Notes:
- Apple: put `chem_plus_monthly` in a subscription group (suggested
  group name: `Chem+`), subscription duration 1 month.
- The Chem+ description reflects PRODUCT.md's paid-tier indulgences
  (unlimited swipe / bottomless inbox). Confirm against the shipped
  paywall copy before finalizing.
- Pricing is an open owner decision ([PRICE-TBD] ×4) — pick tiers in
  App Store Connect / Play Console; keep €-parity across stores.

---

## 7. Screenshot shot-list

Capture on iPhone 6.9" and 6.5" (required iOS sizes; app is
portrait-only, no iPad — `supportsTablet: false`) and a Play phone set
(1080×1920 or taller). Same 7 shots per size, in this order, one caption
each (brand voice: imperative, specific, no engagement bait):

| # | Screen | Caption |
|---|---|---|
| 1 | Discover feed (demo profiles visible) | `Real people near you in Dublin.` |
| 2 | Match detail with the propose CTA | `Matched? Propose a time, not small talk.` |
| 3 | Propose screen, 2–3 time windows picked | `Pick 2–3 times within the next 7 days.` |
| 4 | Chat with a live proposal card | `Proposals expire in 72 hours. Plans get made.` |
| 5 | Confirmed date state | `One tap to confirm. The date is the point.` |
| 6 | Own profile with verified photos | `Verified photos. Honest intentions.` |
| 7 | Safety action sheet (Report categories / Block) | `Report and block, actioned within 24 hours.` |

Optional 8th (both stores allow up to 10): Chem+ paywall —
`Want to browse endlessly? That's Chem+.` Take every screenshot from the
seeded demo account so the feed shows the fictional Dublin profiles,
never real users.

---

## 8. `eas.json` submit.production template

`mobile/eas.json` currently has `"submit": { "production": {} }`.
Replace that block with:

```json
"submit": {
  "production": {
    "ios": {
      "ascAppId": "[ASC-APP-ID]",
      "appleTeamId": "[APPLE-TEAM-ID]"
    },
    "android": {
      "serviceAccountKeyPath": "./secrets/play-service-account.json",
      "track": "internal"
    }
  }
}
```

Where each value comes from:

- `[ASC-APP-ID]` — the numeric Apple ID of the app record: App Store
  Connect → Apps → Chem IRL → App Information → "Apple ID". Exists only
  after the app record is created (roadmap T1.1).
- `[APPLE-TEAM-ID]` — developer.apple.com → Account → Membership
  details → Team ID (10 characters).
- `./secrets/play-service-account.json` — a Google Cloud service-account
  key granted access in Play Console → Users and permissions (create the
  service account via Play Console → API access). Save the JSON at
  `mobile/secrets/play-service-account.json` and **add `secrets/` to
  `mobile/.gitignore` before saving the file — never commit it.**
- `"track": "internal"` — first submissions go to the internal testing
  track; promote in Play Console. Change to `"production"` only for a
  public rollout.
- Apple sign-in for `eas submit` is interactive by default; optionally
  set `EXPO_APPLE_ID` or an App Store Connect API key via
  `eas credentials` to run it non-interactively.

---

## 9. Owner checklist (everything this pack cannot fill)

Mirror these into `../MASTER MANUAL TASKS - Chem IRL & Solutions.md`:

- [ ] **[ASC-APP-ID]** — create the App Store Connect app record
  (bundle `app.chemirl.mobile`), then copy the numeric Apple ID (§8).
- [ ] **[APPLE-TEAM-ID]** — copy from developer.apple.com Membership (§8).
- [ ] **Play service-account JSON** — create + download, store at
  `mobile/secrets/play-service-account.json`, gitignore it (§8).
- [ ] **[FIXED-OTP-CODE]** — decide §5.1 Option A vs B; if A, approve the
  small auth-bypass PR, set the password via the Admin API, and record
  the code somewhere safe (it goes into Review Notes only).
- [ ] **One-time OTP sign-ins** for `reviewy@chemirl.app` and
  `safety@chemirl.app` (mints their auth.users rows), then run
  `scripts/seed-review-demo.mjs` with owner-provided, rights-cleared
  photos in `scripts/seed-photos/` (script header documents the flow).
- [ ] **[PRICE-TBD] ×4** — pick price tiers for the three token packs and
  Chem+ (§6); sign the Paid Apps agreement in ASC first (T1.2).
- [ ] **Support-page deletion copy** — add explicit "request account
  deletion" wording to chemirl.app/support before entering it as Play's
  deletion URL (§4.2).
- [ ] **Privacy manifest check** — confirm the aggregated
  `PrivacyInfo.xcprivacy` in the first EAS production build matches §4.1
  (roadmap T1.8).
- [ ] **Screenshots** — capture §7 from the seeded demo account.
