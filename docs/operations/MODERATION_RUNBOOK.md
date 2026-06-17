# Moderation Runbook

How user reports are received, triaged, and actioned. This documents the
system that is **live in production** as of 2026-06-12: `submit_report` /
`block_user` RPCs, the `reports` → `enforcements` → `enforcement_bans`
chain, and the 24-hour SLA stamped on every report.

> **Why 24 hours matters:** Apple's UGC guidance expects reports on
> objectionable content/users to be acted on within 24 hours. The
> `sla_deadline` column is not decorative — App Review can ask how it is
> met, and [APP_REVIEW_COMPLIANCE.md](./APP_REVIEW_COMPLIANCE.md) cites
> this runbook as the answer.

## How reports arrive

- In-app: kebab menu on Match Detail / Chat / View Profile →
  `SafetyActionSheet` → `submit_report(p_accused, p_category, p_description)`.
- The RPC inserts into `reports` with `status='pending'` and
  `sla_deadline = now() + 24 hours` (set server-side; not client-controllable).
- Categories (DB enum `report_category`): `spam_scam`,
  `fake_impersonation`, `harassment_hate`, `threat_coercion`, `nudity`,
  `minor`, `off_platform_solicitation`, `other`.
- Block is independent of report (product decision). `block_user`
  auto-unmatches and suppresses feed/likes/messages/proposals both ways.

## Who moderates

Moderator access is gated on a row in `public.moderators` (RLS policies on
`reports`/`enforcements` check it — audit findings F4/F4b). **The table is
currently empty**; seed before beta:

```sql
INSERT INTO public.moderators (user_id)
VALUES ('<auth.users id of the moderator>');
```

Until a web admin exists, moderation runs through Supabase Studio (SQL
editor) with the queries below, executed as a seeded moderator (or via the
SQL editor's postgres role).

## Triage cadence

- **Beta target:** check the queue twice daily (morning/evening Dublin
  time); the SLA query below is the source of truth.
- `minor` and `threat_coercion` reports are **drop-everything**: action
  immediately on sight, not at the next cadence window.

### Queue queries

Open reports, oldest first, with time remaining:

```sql
SELECT r.case_id, r.category, r.status, r.created_at,
       r.sla_deadline, r.sla_deadline - now() AS time_left,
       r.reporter_id, r.accused_id, r.description
FROM public.reports r
WHERE r.status = 'pending'
ORDER BY r.sla_deadline ASC;
```

Overdue (SLA breached — should always be empty):

```sql
SELECT count(*) AS overdue
FROM public.reports
WHERE status = 'pending' AND sla_deadline < now();
```

> **TODO (pending decision):** wire the overdue count into an automated
> alert. Candidate channel: the Autonomous CMO's daily Telegram digest
> (OpenClaw VPS) via a small read-only RPC. Blocked on choosing the
> channel — see launch roadmap T1.10.

## Actioning a report

Record the decision as an `enforcements` row. The `action` enum:
`warning`, `content_removal`, `temporary_ban`, `permanent_ban`,
`device_ban`.

```sql
-- Example: permanent ban
INSERT INTO public.enforcements (case_id, accused_id, action, reason)
VALUES ('<case_id>', '<accused user_id>', 'permanent_ban',
        'harassment_hate: <one-line factual summary>');

-- Example: 7-day temporary ban
INSERT INTO public.enforcements (case_id, accused_id, action, ttl_days, reason)
VALUES ('<case_id>', '<accused user_id>', 'temporary_ban', 7, '<summary>');

-- Close the report
UPDATE public.reports SET status = 'resolved' WHERE case_id = '<case_id>';
```

**Ban persistence is automatic.** Inserting an enforcement with a ban
action (`temporary_ban` / `permanent_ban` / `device_ban`) fires
`record_enforcement_ban()`, which writes a row to `enforcement_bans`
containing sha256 hashes of the accused's email/phone (`ttl_days` →
`expires_at`; permanent bans have `expires_at = NULL`). That row:

- has **no foreign keys**, so it survives the user deleting their account
  (their reports/enforcements cascade away; the ban does not), and
- blocks re-registration: `handle_new_user()` refuses any signup whose
  email/phone hash matches an active ban (the OTP signup fails
  server-side).

### Category guidance

| Category | Default action |
|---|---|
| `minor` | `permanent_ban` immediately; preserve evidence (screenshots, message exports) BEFORE any deletion; assess NCMEC/Gardaí reporting obligations |
| `threat_coercion` | `permanent_ban`; preserve evidence; consider advising the reporter to contact Gardaí |
| `nudity` | `content_removal` + `warning` first offence; ban on repeat |
| `harassment_hate` | judgment call: `warning` → `temporary_ban` → `permanent_ban` escalation |
| `spam_scam`, `off_platform_solicitation` | `permanent_ban` for clear commercial spam/scams; `warning` for grey areas |
| `fake_impersonation` | request re-verification (photo verification flow) or ban if clearly fake |
| `other` | triage to the closest category |

## Unbanning

```sql
-- Find the ban
SELECT ban_id, action, reason, created_at, expires_at
FROM public.enforcement_bans
WHERE banned_user_id = '<user_id>';

-- Lift it
DELETE FROM public.enforcement_bans WHERE ban_id = '<ban_id>';
```

Temporary bans lapse on their own when `expires_at` passes (the signup
gate only matches active bans).

## Audit trail

- `reports` + `enforcements` are the per-case record (note: both cascade
  away if the *accused* deletes their account — the durable trace of the
  ban itself is `enforcement_bans`).
- Keep factual, minimal `reason` strings — they may be read in a GDPR
  access request or a dispute.
