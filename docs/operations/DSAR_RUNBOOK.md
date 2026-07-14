# DSAR Runbook (GDPR data subject requests)

How to handle access/portability/erasure requests for the **app**
(waitlist requests have their own self-serve path). Lead supervisory
authority: Irish DPC. Statutory clock: **30 days** from receipt (one
60-day extension possible for complex requests — notify within the first
30 either way).

## Intake + identity verification

Requests arrive via hello@chemirl.app or the /support form
(`support_submissions`). Before disclosing anything, verify the requester
controls the account email: reply to the **account's** email address and
require a response (the OTP login itself is equivalent proof — if they
can log in, they own the mailbox). Never disclose to a third-party
address.

Log every request (date received, type, identity-verified date,
completed date) — a simple ledger satisfies the accountability principle.

## Erasure (Art. 17) — already self-serve

- **App account**: Settings → Delete Account in-app (hard delete +
  cascades + storage purge). If the user cannot log in, run the same
  deletion manually: `DELETE FROM auth.users WHERE id = '<user_id>';`
  (cascades mirror delete-account; then clear `tokens`/
  `token_transactions` rows for that id if any remain, and storage under
  `profiles/<user_id>/`).
- **Waitlist**: self-serve via the emailed link (`waitlist-forget`) for
  unconfirmed signups; confirmed rows are deleted manually
  (`DELETE FROM waitlist_signups WHERE email = ...`).
- **Iris (AI concierge)**: feature-scoped erasure via in-app flow
  (`iris-forget`) without deleting the account.
- **What survives erasure, deliberately**: `enforcement_bans` rows
  (sha256 hashes only, no plaintext PII) under legitimate interest
  (fraud/abuse prevention — banned users must not re-register), and
  `iap_transactions` (hashed-free but PII-light purchase idempotency
  keys) to prevent replaying consumed purchases onto new accounts.
  Disclose this retention in erasure confirmations.

## Access / portability (Art. 15 / 20) — manual export

Run as service role with the verified `user_id`; deliver as JSON over an
encrypted channel (or password-protected archive) to the verified email.

```sql
SELECT jsonb_build_object(
  'account',        (SELECT to_jsonb(u) - 'user_id' FROM public.users u WHERE u.user_id = :uid),
  'profile',        (SELECT to_jsonb(p) - 'id' FROM public.profiles p WHERE p.id = :uid),
  'matches',        (SELECT jsonb_agg(to_jsonb(m)) FROM public.matches m WHERE m.user_a = :uid OR m.user_b = :uid),
  'messages_sent',  (SELECT jsonb_agg(to_jsonb(ms)) FROM public.messages ms WHERE ms.sender_id = :uid),
  'likes_sent',     (SELECT jsonb_agg(to_jsonb(l)) FROM public.likes l WHERE l.liker_id = :uid),
  'proposals',      (SELECT jsonb_agg(to_jsonb(pr)) FROM public.proposals pr WHERE pr.sender_id = :uid),
  'confirms',       (SELECT jsonb_agg(to_jsonb(c)) FROM public.confirms c WHERE c.confirmer_id = :uid),
  'subscription',   (SELECT to_jsonb(s) FROM public.subscriptions s WHERE s.user_id = :uid),
  'token_balance',  (SELECT to_jsonb(t) FROM public.tokens t WHERE t.user_id = :uid),
  'token_ledger',   (SELECT jsonb_agg(to_jsonb(tt)) FROM public.token_transactions tt WHERE tt.user_id = :uid),
  'purchases',      (SELECT jsonb_agg(to_jsonb(it)) FROM public.iap_transactions it WHERE it.user_id = :uid),
  'blocks_made',    (SELECT jsonb_agg(to_jsonb(b)) FROM public.blocks b WHERE b.blocker_id = :uid),
  'reports_made',   (SELECT jsonb_agg(to_jsonb(r)) FROM public.reports r WHERE r.reporter_id = :uid),
  'push_tokens',    (SELECT jsonb_agg(to_jsonb(pt)) FROM public.push_tokens pt WHERE pt.user_id = :uid),
  'surveys',        (SELECT jsonb_agg(to_jsonb(sv)) FROM public.surveys sv WHERE sv.user_id = :uid),
  'analytics_events', (SELECT jsonb_agg(to_jsonb(ae)) FROM public.analytics_events ae WHERE ae.user_id = :uid)
) AS export;
```

Plus photos: list `profiles/<user_id>/**` in the `profiles` storage
bucket and include signed URLs (time-limited) or the files themselves.

**Third-party disclosures to mention in the response**: Supabase (EU
hosting), Resend (transactional email), Bronto (operational telemetry —
PII scrubbed at source, pseudonymous IDs; see DPIA §2.7), Apple/Google
(payments), Anthropic (Iris conversations; ~30 day API retention unless
ZDR).

**Do NOT include in exports**: other users' data (their messages to the
requester are *their* personal data too — include the requester's sent
messages and redact counterpart identifiers where feasible), reports
*about* the requester (Art. 15(4) — protects reporters), internal
moderation notes.

## Rectification (Art. 16)

Almost everything is self-serve in Profile/Settings. DOB is intentionally
not user-editable after the age gate; verified manual correction via
support only (guard the 18+ boundary — the DB CHECK will reject under-18
values regardless).

## TODOs

- T3: self-serve in-app export to close the manual loop.
- DPIA + Art. 30 records (roadmap T2.5) — separate document.
