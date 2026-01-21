# Database Migrations Guide

## Overview

This repository uses **Supabase CLI migrations** as the source of truth for database schema changes. All migrations are stored in `/supabase/migrations/` and applied via `supabase db push`.

**Source of Truth:** `/supabase/migrations/*.sql`  
**Deployment Method:** `supabase db push` (via Supabase CLI)

## Prerequisites

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   # Or via Homebrew: brew install supabase/tap/supabase
   ```

2. **Verify installation:**
   ```bash
   supabase --version
   ```

3. **Login to Supabase:**
   ```bash
   supabase login
   ```

## Project Linking

Before applying migrations, you must link your local repository to a Supabase project.

### Link to Staging Project

1. Get your staging project reference ID from Supabase Dashboard → Project Settings → General
2. Link to staging:
   ```bash
   supabase link --project-ref <your-staging-project-ref>
   ```
   Example: `supabase link --project-ref abcdefghijklmnop`

### Link to Production Project

1. Get your production project reference ID
2. Link to production:
   ```bash
   supabase link --project-ref <your-production-project-ref>
   ```

**Note:** You can only be linked to one project at a time. To switch between staging and production, run `supabase link` again with the appropriate project ref.

## Migration Status

**⚠️ Prerequisite:** You must be linked to a project (`supabase link --project-ref <ref>`) before checking migration status. The command compares local migrations with remote history.

Check which migrations have been applied to the linked project:

```bash
npm run db:status
# Or: supabase migration list
```

This shows:
- Which migrations are pending (not yet applied)
- Which migrations are already applied
- Migration timestamps and names

To see schema differences between local migrations and remote database:

```bash
npm run db:diff
# Or: supabase db diff --linked
```

**Note:** `db:diff` prints SQL differences to stdout (for inspection). To create a new migration file from differences, use `supabase db diff --linked -f <filename>`.

## Applying Migrations

### To Staging

1. **Link to staging project:**
   ```bash
   supabase link --project-ref <staging-ref>
   ```

2. **Review pending migrations:**
   ```bash
   npm run db:status
   # Or: supabase migration list
   ```

3. **Apply migrations:**
   ```bash
   npm run db:push:staging
   ```
   Or directly:
   ```bash
   supabase db push
   ```

4. **Verify deployment:**
   ```bash
   cd mobile
   npm run verify:staging
   ```

### To Production

1. **Link to production project:**
   ```bash
   supabase link --project-ref <production-ref>
   ```

2. **Review pending migrations:**
   ```bash
   npm run db:status
   # Or: supabase migration list
   ```

3. **Apply migrations:**
   ```bash
   npm run db:push:production
   ```
   Or directly:
   ```bash
   supabase db push
   ```

4. **Verify deployment:**
   ```bash
   cd mobile
   npm run verify:staging  # Update .env.seed to point to production
   ```

## Creating New Migrations

1. **Create a new migration file:**
   ```bash
   supabase migration new <descriptive_name>
   ```
   Example: `supabase migration new add_user_preferences_table`

   This creates a timestamped file in `/supabase/migrations/` like:
   `20240115120000_add_user_preferences_table.sql`

2. **Write your SQL:**
   - Add a header comment explaining what the migration does
   - Use `IF NOT EXISTS` / `IF EXISTS` where appropriate for idempotency
   - Test locally first if possible

3. **Test the migration:**
   ```bash
   # Link to a test/staging project
   supabase link --project-ref <test-ref>
   supabase db push
   ```

4. **Commit the migration file:**
   ```bash
   git add supabase/migrations/
   git commit -m "Add migration: <description>"
   ```

## Migration Order

Migrations are applied in timestamp order (filename order). The current migration sequence:

1. `20240101000000_initial_schema.sql` - Core database schema
2. `20240102000000_rls.sql` - Row Level Security policies
3. `20240103000000_kpi_views.sql` - KPI views and analytics
4. `20240104000000_scoring.sql` - Scoring engine functions
5. `20240105000000_security_fixes.sql` - Security patches for functions
6. `20240106000000_auth_otp_migration.sql` - Auth OTP columns
7. `20240107000000_profiles_auto_create_trigger.sql` - Auto-create profiles trigger
8. `20240108000000_proposal_confirmation_fix.sql` - Proposal confirmation constraint
9. `20240109000000_push_notifications.sql` - Push tokens table
10. `20240110000000_read_receipts.sql` - Read receipts feature
11. `20240111000000_automation.sql` - Automation functions and pg_cron

## Adopting Migrations on an Existing Project

If your Supabase project already has database objects created manually (via SQL Editor), you need to safely adopt the migration system without re-running SQL that would fail on existing objects.

### Safe Adoption Runbook

**⚠️ Prerequisites:** You must be linked to the project (`supabase link --project-ref <ref>`) before proceeding.

#### Step 1: Check Schema Differences

First, verify if your database schema matches the migrations:

```bash
npm run db:diff
# Or: supabase db diff --linked
```

**Expected Output:**

- **"No schema changes found"** → Your database schema matches migrations. Proceed to Step 2.
- **SQL output** → Your database has differences. Proceed to Step 3 (Reconciliation Flow).

#### Step 2: Inspect Migration Status

Check which migrations are recorded in the remote database:

```bash
npm run db:status
# Or: supabase migration list
```

This shows:
- **LOCAL** migrations (in `/supabase/migrations/`)
- **REMOTE** migrations (present in remote migration history)
- Comparison of LOCAL vs REMOTE versions

**Interpretation:**
- If migrations appear in LOCAL but **not in REMOTE** → They haven't been applied yet. If `db:diff` showed "No schema changes found", the database has the schema but migrations aren't tracked. Mark all as applied (Step 4).
- If a migration appears in REMOTE but the CLI explicitly shows it as `failed` → Repair it first (Step 3).
- If migrations appear in both LOCAL and REMOTE → They're already tracked, no action needed.

#### Step 3: Repair Failed Migrations (if any)

If the remote history includes a migration version that shouldn't be there (e.g., a failed migration attempt), revert it:

```bash
# Only repair if the version appears in REMOTE history and shouldn't be there
supabase migration repair <version> --status reverted
```

**Example:** If remote history includes `20240101000000` from a failed push attempt:
```bash
supabase migration repair 20240101000000 --status reverted
```

#### Step 4: Mark Baseline Migrations as Applied

If your database already has the full schema (confirmed by "No schema changes found" in Step 1), mark all 11 baseline migrations as applied:

```bash
supabase migration repair 20240101000000 --status applied  # initial_schema
supabase migration repair 20240102000000 --status applied  # rls
supabase migration repair 20240103000000 --status applied  # kpi_views
supabase migration repair 20240104000000 --status applied  # scoring
supabase migration repair 20240105000000 --status applied  # security_fixes
supabase migration repair 20240106000000 --status applied  # auth_otp_migration
supabase migration repair 20240107000000 --status applied  # profiles_auto_create_trigger
supabase migration repair 20240108000000 --status applied  # proposal_confirmation_fix
supabase migration repair 20240109000000 --status applied  # push_notifications
supabase migration repair 20240110000000 --status applied  # read_receipts
supabase migration repair 20240111000000 --status applied  # automation
```

#### Step 5: Verify and Test

```bash
# Verify all migrations are marked as applied
npm run db:status

# Dry-run to confirm nothing pending
supabase db push --dry-run
# Expected: "No migrations to apply" or "All migrations are up to date" (or similar)

# Verify database state
cd mobile && npm run verify:staging
```

---

### Reconciliation Flow (if `db:diff` shows differences)

If Step 1 (`npm run db:diff`) produced SQL output, your database schema differs from migrations. Follow this reconciliation flow:

#### Step 1: Generate Reconciliation Migration

```bash
supabase db diff --linked -f reconcile_staging
```

This creates a new migration file: `supabase/migrations/YYYYMMDDHHMMSS_reconcile_staging.sql`

#### Step 2: Review Reconciliation File

**⚠️ CRITICAL:** Review the generated file for destructive SQL:

```bash
# Open the reconciliation file
cat supabase/migrations/*_reconcile_staging.sql
```

**Look for:**
- `DROP TABLE` / `DROP TYPE` / `DROP FUNCTION` → **DANGEROUS** - may delete data
- `ALTER TABLE ... DROP COLUMN` → **DANGEROUS** - may delete data
- `CREATE` statements → **SAFE** - only adds new objects
- `ALTER TABLE ... ADD COLUMN` → **SAFE** - only adds columns

**If destructive SQL is present:**
- **DO NOT** apply the reconciliation migration
- Manually reconcile differences or mark baselines as applied and push remaining migrations

**If only safe SQL (CREATE/ADD):**
- Proceed to Step 3

#### Step 3: Mark Baselines Applied

Even if there are differences, if your database has the core schema, mark baseline migrations as applied:

```bash
supabase migration repair 20240101000000 --status applied
supabase migration repair 20240102000000 --status applied
supabase migration repair 20240103000000 --status applied
supabase migration repair 20240104000000 --status applied
supabase migration repair 20240105000000 --status applied
supabase migration repair 20240106000000 --status applied
supabase migration repair 20240107000000 --status applied
supabase migration repair 20240108000000 --status applied
supabase migration repair 20240109000000 --status applied
supabase migration repair 20240110000000 --status applied
supabase migration repair 20240111000000 --status applied
```

#### Step 4: Apply Reconciliation (if safe)

If the reconciliation file contains only safe SQL:

```bash
supabase db push
```

This will:
1. Apply the reconciliation migration (adds missing objects)
2. Mark it as applied in migration history

**If reconciliation file has destructive SQL:**
- Delete the reconciliation migration file
- Manually reconcile differences via SQL Editor
- Mark baselines as applied
- Run `supabase db push` to apply any remaining new migrations

---

### Quick Reference: Adoption Scenarios

**Scenario A: Database matches migrations exactly**
```bash
npm run db:diff  # Shows "No schema changes found"
npm run db:status  # Shows migrations in LOCAL but not in REMOTE
# → Mark all 11 migrations as applied (Step 4 above)
```

**Scenario B: Database has schema but migration appears in remote history**
```bash
npm run db:diff  # Shows "No schema changes found"
npm run db:status  # Shows 20240101000000 in REMOTE history (from failed attempt)
# → Repair if needed: supabase migration repair 20240101000000 --status reverted
# → Mark all 11 as applied (Step 4 above)
```

**Scenario C: Database has differences**
```bash
npm run db:diff  # Shows SQL output
# → Follow Reconciliation Flow above
```

**Scenario D: Fresh database**
```bash
npm run db:diff  # Shows all CREATE statements
npm run db:status  # Shows migrations in LOCAL but not in REMOTE
# → Just run: supabase db push
```

## Rollback and Repair

### Viewing Migration History

```bash
npm run db:status
# Or: supabase migration list
```

### Repairing Failed Migrations

If a migration fails partway through, you may need to repair the migration state:

```bash
supabase migration repair <migration-timestamp> --status applied
```

**⚠️ Warning:** Only use `migration repair` if you understand the implications. It modifies the migration tracking state without running SQL.

### Recovering Missing Remote Migrations

**Error:** `Remote migration versions not found in local migrations directory` (e.g., `20251231165551`)

This error occurs when:
- A migration was applied to the remote database but the file was deleted locally
- A migration was created and pushed, then later removed from the local filesystem
- Git history shows a migration file that no longer exists locally

#### Step 1: Identify the Missing Migration

```bash
# Check migration status
npm run db:status
# Or: supabase migration list

# The error message will show the missing version (e.g., "20251231165551")
```

#### Step 2: Check if File Exists Locally

```bash
# Check local filesystem
ls supabase/migrations/ | grep 20251231165551

# If empty, the file is missing locally
```

#### Step 3: Recover from Git History

Try to recover the original migration file from git:

```bash
# Check if file exists in git history
git ls-tree -r --name-only HEAD supabase/migrations/ | grep 20251231165551

# If found, check out the file from a previous commit
git log --all --full-history --oneline -- supabase/migrations/20251231165551*.sql

# Restore from the commit where it existed
git checkout <commit-hash> -- supabase/migrations/20251231165551*.sql
```

**Alternative:** Check remote branches or stashes:
```bash
# Check all branches
git branch -a

# Check if file exists in main/master
git show origin/main:supabase/migrations/20251231165551*.sql

# If found, restore it
git checkout origin/main -- supabase/migrations/20251231165551*.sql
```

#### Step 4: Create Placeholder Migration (if recovery fails)

If the original SQL cannot be recovered, create a placeholder migration file:

**Template for placeholder migration:**
```sql
-- Migration: Placeholder for <description>
-- Created: <date> (recovered)
-- Purpose: This migration was applied remotely but original file was lost
-- <Brief description of what this migration should do>

-- No-op: The changes were already applied by a previous migration
-- This migration is intentionally empty to satisfy remote migration history tracking
```

**Example:** For a duplicate FK change migration:
```bash
# Create placeholder file
cat > supabase/migrations/20251231165551_change_profiles_fk_to_auth_users_placeholder.sql << 'EOF'
-- Migration: Placeholder for duplicate FK change migration
-- Created: 2025-12-31 (recovered)
-- Purpose: This migration was a duplicate of 20251231151000_change_profiles_fk_to_auth_users.sql
-- The FK change is already applied by migration 20251231151000
-- This file exists only to satisfy remote migration history tracking

-- No-op: The FK constraint change was already applied by 20251231151000
-- This migration is intentionally empty to prevent re-running the FK change
EOF
```

#### Step 5: Verify Placeholder is Safe

**⚠️ Critical:** Before using a placeholder, verify:
1. The migration changes were already applied by another migration
2. The placeholder is truly a no-op (doesn't modify schema)
3. Running it again would be idempotent (safe to re-run)

**Check if changes are already applied:**
```sql
-- Example: For FK constraint, verify it exists
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS references_table
FROM pg_constraint WHERE conname='profiles_user_id_fkey';
-- If this returns a row, the FK already exists (migration was applied)
```

#### Step 6: When to Use `migration repair` Instead

**Use `migration repair --status reverted` if:**
- The remote migration was a failed attempt that should never have been recorded
- The migration was applied incorrectly and you want to remove it from history
- The migration is a duplicate that was never meant to be applied

**Do NOT use `migration repair --status reverted` if:**
- The migration was successfully applied and the changes exist in the database
- You just need to restore the local file to match remote history
- The migration is part of the actual schema (even if it's a duplicate)

**Example of when to revert:**
```bash
# If remote shows a failed migration that shouldn't be there
supabase migration repair 20251231165551 --status reverted

# Then push normally
supabase db push
```

**Example of when to create placeholder:**
```bash
# If remote shows migration was successfully applied
# But local file is missing → Create placeholder, then push
supabase db push --include-all
```

#### Step 7: Push After Recovery

Once the file is restored or placeholder created:

```bash
# Verify file exists
ls supabase/migrations/ | grep 20251231165551

# Push migrations
supabase db push --include-all
```

**Expected result:** The push should succeed because local and remote migration history now match.

### Manual Rollback

Supabase CLI does not provide automatic rollback. To rollback a migration:

1. Create a new migration that reverses the changes
2. Apply it via `supabase db push`

**Example:** If migration `20240106000000_auth_otp_migration.sql` added `full_name` column, create a new migration:
```sql
-- Rollback: Remove full_name column
ALTER TABLE profiles DROP COLUMN IF EXISTS full_name;
```

## Verification

After applying migrations, verify the schema:

```bash
cd mobile
npm run verify:staging
```

This checks:
- All required tables exist
- All required columns exist (including `profiles.full_name` and `profiles.signup_completed`)
- All required RPC functions exist
- Storage buckets exist
- Triggers are set up correctly

## Troubleshooting

### "Project not linked"

**Error:** `Error: project not linked`

**Solution:**
```bash
supabase link --project-ref <your-project-ref>
```

### "Migration already applied"

**Error:** `Error: migration X already applied`

**Solution:** This is normal if the migration was already run. Check status:
```bash
npm run db:status
# Or: supabase migration list
```

### "Permission denied"

**Error:** `Error: permission denied`

**Solution:** Ensure you're logged in and have access to the project:
```bash
supabase login
supabase link --project-ref <project-ref>
```

### "Function already exists"

**Error:** `Error: function X already exists`

**Solution:** This is usually safe to ignore if using `CREATE OR REPLACE FUNCTION`. If it's a blocking error, check if the function signature changed and create a new migration to drop/recreate it.

## Manual Fallback (Emergency Only)

If Supabase CLI is unavailable or migrations fail, you can manually apply SQL via Supabase Dashboard SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of the migration file from `/supabase/migrations/`
3. Paste and run in SQL Editor
4. **Important:** Mark the migration as applied manually (or it will try to run again):
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name)
   VALUES ('20240106000000', 'auth_otp_migration')
   ON CONFLICT DO NOTHING;
   ```

**⚠️ Warning:** Manual application bypasses migration tracking. Use only in emergencies.

## PostgREST Schema Cache

After creating or modifying RPC functions (PostgreSQL functions), PostgREST may cache the schema. If you get errors like `PGRST202: Could not find the function... in the schema cache`, you may need to reload the schema cache:

**On remote database (via SQL Editor or psql):**
```sql
NOTIFY pgrst, 'reload schema';
```

This forces PostgREST to reload its schema cache and recognize newly created or modified functions.

**Common scenarios:**
- After creating a new RPC function
- After modifying an existing RPC function signature
- After granting/revoking EXECUTE permissions on functions

**Note:** Schema cache reloads automatically after migrations, but sometimes manual reload is needed if functions are created/modified outside of migrations or if the cache gets stale.

## Best Practices

1. **Always test in staging first** before applying to production
2. **Review migrations** before pushing (especially for production)
3. **Use idempotent SQL** (`IF NOT EXISTS`, `IF EXISTS`) where possible
4. **One logical change per migration** - don't combine unrelated changes
5. **Add descriptive comments** at the top of each migration
6. **Verify after deployment** using `npm run verify:staging`
7. **Keep `/db/*.sql` files** for reference, but `/supabase/migrations/` is the source of truth going forward
8. **Reload PostgREST schema cache** if RPC functions aren't recognized after creation/modification

## Migration File Naming

Format: `YYYYMMDDHHMMSS_descriptive_name.sql`

Examples:
- `20240115120000_add_user_preferences.sql`
- `20240115120001_update_rls_policies.sql`

The timestamp ensures migrations run in the correct order.

## Related Documentation

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [Mobile App Database Setup](./mobile/docs/SUPABASE_STAGING_SETUP.md)

