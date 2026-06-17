# App Review Compliance Pack (Dating / UGC)

What App Review will probe for a dating app with user-generated content,
mapped to what Chem IRL actually ships and where it lives. Use this when
filling in App Store Connect metadata and as the source for Reviewer
Notes. Status reflects production as of 2026-06-12.

## Apple UGC checklist (Guideline 1.2)

Apple requires all four of: content filtering, report + timely action,
blocking, and published contact info. Dating apps get extra scrutiny.

| Requirement | What we have | Where |
|---|---|---|
| Filter objectionable material | Server-side photo moderation on every upload + verification selfie match-check (safety classes: sexual/violence/weapons/drugs/hate/minors/spam) | `moderate-photo` edge function; `PhotoVerificationScreen`; `lib/photoModeration.ts` |
| Report mechanism + timely action | 8-category in-app reporting; server-stamped 24h `sla_deadline`; documented triage + enforcement procedure | `SafetyActionSheet` → `submit_report` RPC; [MODERATION_RUNBOOK.md](./MODERATION_RUNBOOK.md) |
| Block mechanism | Block from Match Detail / Chat / View Profile; auto-unmatch; both-direction suppression in feed, likes, messages, proposals | `block_user` RPC (migration `20260610094556`) |
| Published contact info | In-app Settings → Support → chemirl.app/support (form + hello@chemirl.app) | `SettingsScreen`; `support-submit` edge function |
| Users agree to terms | Mandatory 18+/ToS/Privacy attestation checkbox at signup, persisted with timestamp | `SignUpEmailScreen`; `profiles.terms_accepted(_at)` |

## Age assurance

- **18+ gate**: mandatory DOB step (first onboarding screen, no skip);
  under-18 → hard stop + sign-out; DB CHECK `users_dob_18_plus` enforces
  the boundary server-side; profile completion is trigger-blocked without
  a DOB. (Migration `20260611163555`.)
- **Age rating questionnaire**: answer honestly as a dating app →
  expect 17+/18+ rating. Do NOT understate; mismatch is a rejection.

## Account deletion (Guideline 5.1.1(v))

In-app: Settings → Danger Zone → Delete Account → typed "DELETE"
confirmation → `delete-account` edge function (hard delete of
`auth.users` + cascades + storage purge + token-table cleanup).
Immediate, no support-ticket detour — exactly what the guideline wants.

## Privacy

- Privacy Policy / Terms / Safety pages live at chemirl.app and are
  linked in-app (Settings → Legal).
- **Privacy nutrition labels** (fill at submission): collected and
  linked to identity — email, name, DOB, photos, approximate location
  (lat/lng for discovery), messages, purchases. No third-party
  advertising/tracking SDKs as of today (analytics decision D1 pending —
  update labels if PostHog lands).
- iOS privacy manifest: verify the aggregated `PrivacyInfo.xcprivacy` in
  the first EAS production build artifact (roadmap T1.8).

## The demo-account problem (OTP-only auth)

Auth is email OTP with no passwords — a reviewer cannot receive our
codes. **Before TestFlight Beta App Review (T1.7):**

1. Create a dedicated review account (e.g. `review@chemirl.app`).
2. Configure a **fixed test OTP** for it in Supabase Auth (test
   addresses with predefined codes), so the printed code always works.
3. Complete its profile fully (photos, completed onboarding) so the
   reviewer lands in a working Discover feed — seed at least a handful
   of plausible Dublin profiles for it to see.
4. Reviewer Notes must include: the email, the fixed code, and the
   walkthrough below.

## Reviewer Notes — walkthrough script (draft)

> Chem IRL is an 18+ dating app for Dublin. Sign in with the review
> credentials above (the verification code is fixed for this account).
> Safety features to verify: (1) every profile/chat has a "…" menu with
> Report (8 categories) and Block — blocking unmatches immediately;
> (2) reports are actioned within 24 hours by our moderation team;
> (3) Settings → Support links our published contact; (4) Settings →
> Delete Account permanently deletes the account in-app; (5) signup
> requires date-of-birth (18+) and terms agreement. In-app purchases
> (token packs, Chem Plus subscription) are server-verified via the App
> Store Server API.

## Known submission-blocking TODOs

- T1.1/T1.2: ASC app record, Paid Apps agreement, IAP SKUs.
- T1.7: fixed-OTP review account + seeded demo content.
- T1.8: confirm privacy manifest in the build artifact.
- D1: analytics decision → privacy labels updated accordingly.
- Screenshots/description/keywords (T2.1).
