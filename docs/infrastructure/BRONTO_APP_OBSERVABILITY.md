# Bronto app observability — `chem-irl-app`

**Status: canonical reference** for the product-wide Bronto event stream
(edge functions, DB, mobile analytics, CI). Shipped 2026-07-09 as PRs
#175 (shared module + buffering), #178/#180 (wrapper adoption in all 14
edge functions), #182 (telemetry-ship), #184 (ops_events), #176 (CI).

The marketing/sales agents' streams (`chem-irl-cmo`, `chem-irl-cso`) are
separate services documented in [OPENCLAW_CMO_VPS.md](./OPENCLAW_CMO_VPS.md)
and [OPENCLAW_CSO.md](./OPENCLAW_CSO.md); the ingest conventions are shared.

**Bronto is additive.** Sentry stays the crash/alerting tool on all three
layers; Bronto is the queryable "what happened, when, how, where" stream.
Everything here is **strictly fail-open**: with `BRONTO_API_KEY` unset,
every producer is a silent no-op, and a Bronto outage can never break a
request, job, or workflow.

## 1. Ingest mechanics (org convention)

- `POST https://ingestion.eu.bronto.io` (override: `BRONTO_INGEST_URL`)
- Headers: `x-bronto-api-key`, `x-bronto-service-name: chem-irl-app`,
  `Content-Type: application/json`
- Body: NDJSON — one JSON event per line; batches are one POST.

## 2. Event schema (field dictionary)

Every event is built by `supabase/functions/_shared/bronto.ts` →
`buildEvent()` (CI curls the same shape by hand) and passes the shared
PII scrubber before leaving the process.

| Field | Values | Notes |
|---|---|---|
| `timestamp` | ISO 8601 UTC (`Z`) | Edge/CI: emit time. Forwarded DB rows: the row's `created_at` (when it *happened*, not when it shipped). NOTE: Bronto's `@time` index axis is always **arrival** time — verified 2026-07-10 by probing `timestamp`/`@timestamp`/`time`/`event_time`, none are honored. Near-real-time events sit within ~2 min of truth; for backfilled history, filter on the `timestamp` *field*, not the time-range picker. |
| `service` | `chem-irl-app` | `BRONTO_SERVICE` override exists but should stay default. |
| `env` | `production` \| `staging` | From `SENTRY_ENV` (per Supabase project); CI: `production` on main pushes, `staging` on PRs. Unset defaults to `production` — keep `SENTRY_ENV=staging` set on the staging project. |
| `layer` | `edge` \| `db` \| `mobile` \| `ci` | The primary discriminator. |
| `fn` | edge function name | Edge events only (incl. telemetry-ship's own events). |
| `event` | see §3 | `request_start`/`request_complete`/`request_failed` + per-function outcome events; forwarded rows use the row's own event name. |
| `level` / `status` | `debug\|info\|warn\|error` / `ok\|warn\|error` | `status` derives from `level`. |
| `request_id` | UUID | Correlates all events of one edge request (same id in `supabase functions logs`). |
| `user_id` | UUID | Pseudonymous; stamped at flush so pre-auth events carry it too. |
| `source` + `source_id` | table name + row PK | Forwarded DB rows only — the **at-least-once dedupe key**. |
| `shipped_at` | ISO 8601 | Forwarded rows: when telemetry-ship sent them. |
| extras | scrubbed | Event-specific fields (counts, kinds, decisions, http_status…). |

**PII rules:** every payload passes `scrubSentryPayload`
(`_shared/sentry-scrubber.ts`): drops `message`/`body`/`email`/`phone`-class
keys, hashes email/E.164 patterns in values, masks photo-URL keys,
truncates long strings. Producers additionally never put emails, tokens,
subjects, bodies, or storage paths into extras (belt and braces).
`safePath()` keeps query strings (confirm/unsubscribe tokens) out of
request events.

## 3. Producers by layer

### `layer: edge` — all 14 edge functions, in real time

`withObservability` (`_shared/observability.ts`) buffers every `logEvent`
line into `ctx.pending` and flushes **one NDJSON POST per request** via
`EdgeRuntime.waitUntil` on both success and error paths. OPTIONS
preflights and `ctx.tags.bronto_suppress = '1'` requests are dropped.

Baseline events per request: `request_start`, `request_complete`
(status + duration_ms) or `request_failed` (error message/name). Notable
outcome events:

| fn | Events worth alerting on |
|---|---|
| waitlist-signup | `signup_result {was_new, has_referral}`; `signup_honeypot` / `signup_silent_dedup` (fake-200s — subtract from conversion counts); `signup_rate_limited`; `signup_rpc_failed` |
| waitlist-confirm | `confirm_result {state}` — invalid / expired / already_confirmed / error / confirmed(+source) |
| waitlist-blog-subscribe | `subscribe_result {sent_confirmation}`, `subscribe_honeypot`, `subscribe_rpc_failed` |
| waitlist-forget | `erasure_result {outcome}` (GDPR Art. 17) |
| waitlist-nudge | `nudge_batch {dry_run, eligible, sent, failed, marked}`; **`nudge_mark_failed {sent}`** = sends unmarked, a re-run would double-send — page on this |
| waitlist-unsubscribe | `unsubscribe_result {method}`; `unsubscribe_invalid_sig` (bursts = address-oracle probing) |
| support-submit | `submit_result {kind, has_email}`; **`platform_forward {target: support_agent, forward_status}`** — the fail-open Brigade intake forward, errors here mean the support agent sees nothing |
| moderate-photo | `moderation_decision {kind, decision, backend}`; **`platform_forward {target: photo_platform, forward_status, fallback}`** — Solutions-platform cutover degradation; `moderation_upstream_failed`, `moderation_tool_missing`, `moderation_audit_insert_failed` |
| validate-receipt / validate-subscription | request lifecycle + `subscription_result {platform, status}`, `subscription_verify_failed {reason}`, `subscription_unavailable` (fail-closed 503), `subscription_staging_trusted` (must never appear in production) |
| delete-account | `account_delete_result {storage_objects_removed}` (the durable deletion record), `account_delete_failed {step}` |
| iris-forget | `erasure_complete {conversations, memory_rows, checks, selfies}` |
| iris-chat / push | request lifecycle (SSE flush happens at time-to-first-byte for iris-chat) |
| telemetry-ship | `ship_batch {…counts, done}`, `ship_batch_failed`, `ship_cursor_conflict`, `ship_unauthorized`; idle minutes are suppressed |

### `layer: mobile` — analytics_events, forwarded (≤ ~2 min lag)

The app keeps writing to the `analytics_events` table (no client
changes; `mobile/src/lib/analytics.ts` taxonomy: onboarding steps,
like_sent, match_created, proposal_*, message_sent, iris_*,
verification_*, report_submitted, …). `telemetry-ship` forwards rows with
`platform` (ios/android), scrubbed `properties`, and
`source: analytics_events`. Full history was backfilled by the epoch
cursors on first rollout.

### `layer: db` — scoring_events + ops_events, forwarded

- `scoring_events` (domain events from triggers: like/match/proposal/
  confirm/report/survey/stale_match) — **`feed_impression` is excluded**
  in-query (~20 rows per discovery-feed call, pure volume noise).
- `ops_events` — one ok/error row per pg_cron job run via the
  `run_*_v1()` wrappers: `expire_matches {expired_count}`,
  `materialize_scores {message}`, `stale_match_events {stale_count}`.
  `status: error` rows carry `SQLERRM`. NOTE: wrapper failures are
  visible HERE, not in `cron.job_run_details` (recorded-and-swallowed by
  design — a re-raise would roll back the error row).

### `layer: ci` — GitHub Actions

`ci.yml`'s aggregate `bronto` job emits one `ci_run` per workflow run
(`{status, branch, sha, pr, job_mobile, job_web, job_docs, job_brand}`).
`blog-sync.yml`'s `blog_publish` event stays on `chem-irl-cmo`.

## 4. Delivery semantics

- **Edge:** exactly-once per request in practice, but lost if the isolate
  dies before the background POST settles (accepted; fail-open).
- **Forwarded rows:** at-least-once. telemetry-ship advances a per-source
  keyset cursor `(last_created_at, last_id)` **only after a successful
  ship**, with a compare-and-swap so overlapping runs can't
  double-advance. Crash between ship and advance ⇒ the batch re-ships
  next minute. **Dedupe on `source` + `source_id`** when counting.
- 60s watermark: rows younger than a minute are left for the next run
  (commit-skew guard). Batch cap 500 rows/source/minute.
- Account-deletion race: `analytics_events` cascades on delete — rows
  created and deleted within the shipping window never ship; the
  `delete-account` edge event still lands.

## 5. Environment & secrets

| Name | Where | Purpose |
|---|---|---|
| `BRONTO_API_KEY` | Supabase function secrets (staging + prod), GitHub Actions secret, VPS `.env` | Ingest auth (same org key everywhere; also the MCP read key) |
| `BRONTO_INGEST_URL` | Supabase function secrets | Default `https://ingestion.eu.bronto.io` |
| `BRONTO_SERVICE` | Supabase function secrets | `chem-irl-app` |
| `SENTRY_ENV` | Supabase function secrets | Drives the `env` field — must be `staging` on the staging project |
| `TELEMETRY_SHIP_SECRET` | Supabase function secrets | x-webhook-secret for telemetry-ship |
| Vault `telemetry_ship_url` | Supabase Vault (SQL) | Full function URL the cron job POSTs to |
| Vault `telemetry_ship_secret` | Supabase Vault (SQL) | Same value as `TELEMETRY_SHIP_SECRET` |

## 6. Bootstrap runbook (per project: staging first, then production)

1. **Inventory (read-only):** `supabase migration list --linked`;
   `SELECT jobname, command FROM cron.job;` (note which expire-job name
   variant(s) exist, and whether an out-of-migration `expire_proposals`
   sweep is scheduled — see §9); row counts of `analytics_events` /
   `scoring_events` for backfill sizing.
2. **Function secrets:**
   ```bash
   supabase secrets set \
     BRONTO_API_KEY=<org key> \
     BRONTO_INGEST_URL=https://ingestion.eu.bronto.io \
     BRONTO_SERVICE=chem-irl-app \
     TELEMETRY_SHIP_SECRET=$(openssl rand -hex 32)
   supabase secrets list   # verify SENTRY_ENV is correct for the project
   ```
3. **Vault (one-time SQL, with approval — BEFORE db push):**
   ```sql
   SELECT vault.create_secret(
     'https://<project-ref>.supabase.co/functions/v1/telemetry-ship',
     'telemetry_ship_url');
   SELECT vault.create_secret('<TELEMETRY_SHIP_SECRET value>',
     'telemetry_ship_secret');
   ```
4. **Deploy:** `supabase functions deploy push validate-receipt iris-chat
   waitlist-signup waitlist-confirm waitlist-forget waitlist-blog-subscribe
   waitlist-nudge waitlist-unsubscribe support-submit delete-account
   iris-forget moderate-photo validate-subscription telemetry-ship`
   **then** `supabase db push` (function live before the cron starts
   POSTing; the reversed order is only noisy, never breaking).
5. **Backfill:** cursors start at epoch, so history drains at ≤500
   rows/source/minute automatically. To accelerate:
   ```bash
   while :; do
     out=$(curl -s -X POST \
       https://<project-ref>.supabase.co/functions/v1/telemetry-ship \
       -H "x-webhook-secret: $TELEMETRY_SHIP_SECRET"); echo "$out"
     echo "$out" | grep -q '"done":true' && break
   done
   ```

## 7. Verification / smoke checks

- `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;`
  and `SELECT * FROM net._http_response ORDER BY id DESC LIMIT 5;` —
  the minutely job should show 200s.
- Insert one test `analytics_events` row (approved SQL) → a
  `layer:mobile` event in Bronto within ~2 min, cursor advanced; POST the
  function again → no re-ship (CAS held).
- `SELECT run_expire_matches_v1();` → `ops_events` row → Bronto
  `layer:db` event next minute.
- Curl any wrapped function (even a 401 emits `request_start`/
  `request_complete`); confirm no `bronto_ship_failed` lines in
  `supabase functions logs <fn>`.
- One query per layer in Bronto returns `service:chem-irl-app` events.

## 8. Querying

Use the **Bronto MCP** on the OpenClaw gateway (`ssh openclaw`; config
`mcp.servers.bronto` in `~/.openclaw/openclaw.json` — tools
`bronto__search_logs`, `bronto__timeseries`, `bronto__get_datasets`), the
same read path the CMO/CSO agents use. Useful starting filters:

- `service:chem-irl-app layer:edge level:error` — anything failing at the edge
- `event:platform_forward forward_status:error` — Solutions-platform / support-agent forward degradation (note: the top-level `status` on these events is the level-derived `warn`; the reserved `status` field can't be set from extras by design)
- `event:nudge_mark_failed` — double-send hazard, act before re-running the nudge
- `event:ci_run status:error` — red CI on main
- `layer:db event:expire_matches` — cron sweep history with counts
- `request_id:<uuid>` — the full story of one request across events

## 9. Known follow-ups (optional)

- **`expire_proposals` sweep** exists outside migrations (referenced in
  `20260609182327_lock_proposals_update.sql`); once confirmed in
  `cron.job`, wrap as `run_expire_proposals_v1()` mirroring PR-E's
  pattern so it reports to `ops_events` too.
- **Mobile error events**: the mobile Sentry seam (`captureWithTags`)
  could additionally record scrubbed error events into
  `analytics_events` so Bronto sees client errors, not just Sentry.
  Deliberately out of scope for the initial rollout (user decision:
  no client changes).
- **Web client funnel events** (`waitlist_form_started` etc.) remain a
  silent no-op seam (`web/src/lib/analytics.ts`) by decision — edge
  functions cover conversions; Vercel Analytics covers pageviews.
- ~~**Bronto-side alerting**~~ **DONE 2026-07-10**: `cmo/appwatch.py` on
  the OpenClaw VPS queries this dataset daily inside `cmo-alertcheck`
  (07:33 UTC → Telegram): any `status:error` events (grouped),
  `platform_forward forward_status:error`, `subscription_staging_trusted`
  in production, and warns above a noise floor. Fail-open, but a query
  failure emits a "watch FAILED" line instead of silence. See
  [OPENCLAW_CMO_VPS.md](./OPENCLAW_CMO_VPS.md) §5.
- **Edge Sentry (`SENTRY_DSN_EDGE`)** is still unset — no Sentry project
  exists for any layer. Until one is created, this appwatch check is the
  app's only error alerting.

## 10. Privacy

Recorded in [../operations/DPIA.md](../operations/DPIA.md) (§2.3
processors, §2.5 transfers, §2.7 app telemetry, §8 ROPA): pseudonymous
UUIDs + scrubbed payloads only; EU ingest endpoint; Bronto-side copies
survive account deletion and are bounded by Bronto retention (confirm
retention + DPA under GAP-4).
