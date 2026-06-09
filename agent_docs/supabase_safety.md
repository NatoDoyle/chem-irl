# Supabase and database safety

> Concise companion to the database rules in `CLAUDE.md`. If the two ever drift, **`CLAUDE.md` wins.**

## Migration immutability
- Never modify an already-applied migration.
- Check whether a timestamp is applied (preferred): `supabase migration list --linked`. Alternatively, query `supabase_migrations.schema_migrations` via the Supabase MCP / CLI:

```sql
SELECT 1
FROM supabase_migrations.schema_migrations
WHERE version = '<timestamp>';
```

  If the timestamp appears in the applied list, create a new timestamped migration instead of editing the old one.

## Timestamp collisions
- Before adding a migration, check `supabase/migrations/` for an existing file sharing the same `YYYYMMDDHHMMSS` prefix — two files with the same prefix collide. Use `supabase migration new <slug>` to get a non-colliding timestamp. (See commit `fe85dd6` for the prior incident.)

## RPC / function versioning
- Do not change an existing RPC/function return shape (e.g. a `RETURNS TABLE`) in place. Create a versioned replacement such as `_v2` and update its callers.

## Schema cache reloads
- When adding or changing functions exposed as PostgREST RPCs, include `SELECT pg_notify('pgrst','reload schema');` in the migration so the API picks up the new shape.

## RLS
- `upsert` with `onConflict` can trigger an UPDATE, so an UPDATE policy is required for that path — an INSERT policy alone is not enough.

## Edge functions serving HTML
- Edge functions on the shared `*.supabase.co` domain cannot serve rendered HTML (Supabase rewrites it to `text/plain` + CSP `sandbox`). To show a user-facing page, **302-redirect to the marketing site** — a redirect has no body, so it is not sandboxed. See `waitlist-confirm`'s `redirectToStatus()`.

## Applying & querying
- Apply approved migrations with `supabase db push`. Treat MCP/CLI SQL against the live database as production access: read-only by default, mutations only with explicit approval.
