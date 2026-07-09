# Supabase Migration Drift Snapshot — 2026-04-27

## Context

On 2026-04-27, while preparing to push the waitlist schema migration
(`supabase/migrations/20260427000001_waitlist.sql`), `supabase migration list
--linked` revealed 17 migration IDs recorded in the remote
`schema_migrations` table that have **no corresponding local migration file**
in `supabase/migrations/`. These were almost certainly applied via the
Supabase Dashboard SQL Editor (or via a `supabase db reset` cycle) earlier
in the project, before the local migration-file workflow was adopted, and
were never written back as files.

To unblock `supabase db pull` and `supabase db push`, these 17 IDs were
marked as `reverted` in the remote `schema_migrations` tracking table on
2026-04-27 via `supabase migration repair --status reverted`. **The actual
schema changes those migrations made are still present in the live database.**
This document is the durable record that they ever existed.

## The 17 ghost migration IDs

| Version          | Applied (remote, UTC)   | Notes |
|------------------|-------------------------|-------|
| 20260121224323   | 2026-01-21 22:43:23     | ghost — no local file |
| 20260126220000   | 2026-01-26 22:00:00     | ghost — no local file |
| 20260126220001   | 2026-01-26 22:00:01     | ghost — no local file |
| 20260127121324   | 2026-01-27 12:13:24     | ghost — no local file |
| 20260127121849   | 2026-01-27 12:18:49     | ghost — no local file |
| 20260130120000   | 2026-01-30 12:00:00     | ghost — no local file |
| 20260130123000   | 2026-01-30 12:30:00     | ghost — no local file |
| 20260205090000   | 2026-02-05 09:00:00     | ghost — no local file (likely first of an 11-step seed batch on 2026-02-05) |
| 20260205090500   | 2026-02-05 09:05:00     | ghost — no local file |
| 20260205091000   | 2026-02-05 09:10:00     | ghost — no local file |
| 20260205091500   | 2026-02-05 09:15:00     | ghost — no local file |
| 20260205092000   | 2026-02-05 09:20:00     | ghost — no local file |
| 20260205092500   | 2026-02-05 09:25:00     | ghost — no local file |
| 20260205093000   | 2026-02-05 09:30:00     | ghost — no local file |
| 20260205094000   | 2026-02-05 09:40:00     | ghost — no local file |
| 20260205094500   | 2026-02-05 09:45:00     | ghost — no local file |
| 20260322223711   | 2026-03-22 22:37:11     | ghost — no local file (sits between local 20260322220219 and 20260322230000) |

## Reproducing the schema in code

The pulled `<TS>_remote_baseline.sql` migration file (created by
`supabase db pull remote_baseline --linked` immediately after the repair)
captures the *cumulative* effect of these 17 migrations as a single
schema dump. That file is the source of truth going forward.

If you ever need to inspect the historical remote `schema_migrations`
contents (for example to correlate an obscure DB object with one of these
ghost IDs), you can:

```sql
-- Run via Supabase Dashboard SQL Editor (the table lives in the
-- supabase_migrations schema, not public).
SELECT version, name, statements, created_by
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

After the repair on 2026-04-27, that table no longer contains the 17 IDs
above. If you want to restore the records (without re-running any SQL),
use `supabase migration repair --status applied <version>` for each ID.

## Why we didn't pull-then-keep the ghost IDs in tracking

`supabase db pull` cannot run while the remote tracking table contains
versions that have no local files (the CLI calls this a history mismatch).
The two CLI-supported escape hatches are:

1. `--status reverted` for each ghost (chosen) — clears tracking, lets pull
   capture remote state as a single new baseline file. Safest for proceeding
   with new migrations.
2. `--status applied` for each ghost — but this requires creating an empty
   local file for each ID first (otherwise the next `db push` would re-flag
   the same mismatch). 17 empty placeholder files would clutter the
   migrations directory without adding value.

Option 1 was chosen as the lower-friction path. This doc preserves the
information lost by that choice.

## Going forward

- All future schema changes go through migration files in
  `supabase/migrations/`. Never apply schema changes directly via the
  Dashboard SQL Editor unless absolutely necessary — and if you do, write
  a corresponding migration file and run `migration repair --status applied`
  to keep tracking and files aligned.
- `CLAUDE.md` already encodes the rule "Never modify an already-applied
  Supabase migration. To check if a migration has been applied, run in the
  Supabase Dashboard SQL Editor: `SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '<timestamp>';`"

## Other 2026-04-27 cleanup actions

In the same session that performed the repair above, two related
out-of-band actions were taken on the live DB to unblock the migration push:

1. **Dropped a stub `public.waitlist_signups` table** (4 columns:
   `waitlist_id`, `email`, `source`, `created_at`; 0 rows; nothing
   referencing it). Created via Dashboard at some point as a placeholder;
   would have collided with `20260427000001_waitlist.sql`'s 19-column
   schema. Drop was via `DROP TABLE IF EXISTS public.waitlist_signups CASCADE;`
   executed through the Supabase MCP. No data loss.

2. **Fixed five migration files** to make the backlog applicable. None of
   the fixes were applied to remote-only state — they all addressed local
   migration files that had to land cleanly to unblock `supabase db push`:
   - `20260319000001`: `uuid_generate_v4()` → `gen_random_uuid()` (uuid-ossp
     was not in search_path); `DROP FUNCTION IF EXISTS get_discovery_feed_v2`
     before its `CREATE OR REPLACE` (return type change); cron calls wrapped
     in `pg_extension WHERE extname='pg_cron'` guards.
   - `20260322000001`: `p.user_id` → `p.id` in `get_discovery_feed` body
     (profiles uses `id`, not `user_id`).
   - `20260322230000`: `IF NOT EXISTS` on `ALTER TABLE matches ADD COLUMN
     expires_at` and `CREATE INDEX idx_matches_expires_at`.
   - `20260326000001`: `DROP FUNCTION IF EXISTS expire_matches()` before
     redefinition (return type changes from `TABLE(...)` to `void`); cron
     `expire-matches-hourly` schedule wrapped in pg_cron guard.
   - `20260427000001`: `gen_random_bytes(...)` qualified to
     `extensions.gen_random_bytes(...)` (pgcrypto lives in `extensions`
     schema, not in default search_path).

## Known follow-up: Discover RPCs reference `p.user_id`

Two `LANGUAGE plpgsql` RPCs landed with bodies that reference the
non-existent `profiles.user_id` column:
- `get_discovery_feed_v2` (created by `20260319000001`)
- `get_discovery_feed_v3` (created by `20260326000001`, called by
  `mobile/src/screens/discover/DiscoverScreen.tsx:67`)

PL/pgSQL doesn't validate column references at function CREATE time, so
these applied without error but **fail at runtime** with
`ERROR: column p.user_id does not exist`. Verified via direct call on
2026-04-27.

This is **not a regression introduced by this session** — `get_discovery_feed_v3`
did not exist on the remote DB before this push, so any mobile app call to
it was already failing with `function does not exist`. The push changed the
error mode from "function missing" to "column missing"; the Discover screen
remains non-functional in either case.

The fix is a follow-up `CREATE OR REPLACE FUNCTION` migration that rewrites
both bodies with `p.id` instead of `p.user_id` (matching the working
`get_discovery_feed` v1). Tracked separately.
