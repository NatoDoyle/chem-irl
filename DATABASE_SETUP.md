# Supabase Database Setup - Running Migrations

## Overview

This repository uses **Supabase CLI migrations** for database setup. All migrations are stored in `/supabase/migrations/` and applied via `supabase db push`.

**Recommended Method:** Use Supabase CLI (see [DB_MIGRATIONS.md](./DB_MIGRATIONS.md) for full guide)  
**Fallback Method:** Manual SQL Editor (see "Manual Fallback" section below)

---

## Recommended: Supabase CLI Method

### Prerequisites

1. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   # Or: brew install supabase/tap/supabase
   ```

2. **Login:**
   ```bash
   supabase login
   ```

3. **Link to your project:**
   ```bash
   supabase link --project-ref <your-project-ref>
   ```
   Find your project ref in Supabase Dashboard → Project Settings → General

### Apply All Migrations

```bash
supabase db push
```

This applies all migrations in `/supabase/migrations/` in the correct order.

### Verify Setup

```bash
cd mobile
npm run verify:staging
```

---

## Manual Fallback (Emergency Only)

If Supabase CLI is unavailable, you can manually apply SQL via Supabase Dashboard SQL Editor:

### Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Log in to your account
3. Click on your **chem-irl** project
4. In the left sidebar, click **SQL Editor**

### Step 2: Run Migrations in Order

Run these SQL files in order (copy-paste entire contents):

1. **Initial Schema** (`supabase/migrations/20240101000000_initial_schema.sql`)
   - Creates all database tables (users, profiles, matches, proposals, etc.)
   - Creates custom types (user_gender, match_status, etc.)
   - Creates indexes for performance

2. **Row Level Security** (`supabase/migrations/20240102000000_rls.sql`)
   - Enables Row Level Security on all tables
   - Creates security policies so users can only see their own data
   - Protects your database from unauthorized access

3. **KPI Views** (`supabase/migrations/20240103000000_kpi_views.sql`)
   - Creates views for tracking KPIs (proposal-confirm rate, TTD, etc.)
   - Sets up functions for daily KPI calculations
   - Creates the north star metric view (confirmed dates/WAU)

4. **Scoring Functions** (`supabase/migrations/20240104000000_scoring.sql`)
   - Implements Action Speed, Profile Quality, and Reliability scoring

5. **Security Fixes** (`supabase/migrations/20240105000000_security_fixes.sql`)
   - Adds authorization checks to SECURITY DEFINER functions

6. **Auth OTP Migration** (`supabase/migrations/20240106000000_auth_otp_migration.sql`)
   - Adds `full_name` and `signup_completed` columns to profiles

7. **Profiles Auto-Create Trigger** (`supabase/migrations/20240107000000_profiles_auto_create_trigger.sql`)
   - Creates trigger to auto-create profiles for new auth users

8. **Proposal Confirmation Fix** (`supabase/migrations/20240108000000_proposal_confirmation_fix.sql`)
   - Adds unique constraint and transactional RPC for proposal confirmation

9. **Push Notifications** (`supabase/migrations/20240109000000_push_notifications.sql`)
   - Creates push_tokens table

10. **Read Receipts** (`supabase/migrations/20240110000000_read_receipts.sql`)
    - Adds read_at column to messages table

11. **Automation** (`supabase/migrations/20240111000000_automation.sql`)
    - Sets up proposal expiry and daily scoring automation

**⚠️ Important:** After manually applying migrations, mark them as applied using Supabase CLI to prevent re-running:
```bash
# Mark each migration as applied after manually running it
supabase migration repair 20240101000000 --status applied
supabase migration repair 20240102000000 --status applied
supabase migration repair 20240103000000 --status applied
# ... continue for each migration you manually applied
```

This updates the migration tracking state without re-running the SQL.

---

## Verification (Make Sure It Worked)

### Check Tables Were Created

1. In Supabase, go to **Table Editor** (left sidebar)
2. You should see these tables:
   - ✅ users
   - ✅ profiles
   - ✅ likes
   - ✅ matches
   - ✅ proposals
   - ✅ confirms
   - ✅ messages
   - ✅ surveys
   - ✅ scores_daily
   - ✅ purchases
   - ✅ credits_ledger
   - ✅ reports
   - ✅ enforcements

### Check RLS is Enabled

1. Go to **Table Editor**
2. Click on any table (e.g., `users`)
3. Click **"Policies"** tab
4. You should see RLS policies listed

### Test a Query

In SQL Editor, run this test query:
```sql
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
```

You should see a count of 13 tables (or more if Supabase added system tables).

---

## Common Issues & Fixes

### Error: "relation already exists"
**Cause**: Table already exists from a previous run
**Fix**: 
- Option 1: Delete the table and re-run (careful - this deletes data!)
- Option 2: Modify the SQL to use `CREATE TABLE IF NOT EXISTS`
- Option 3: Ignore errors for existing tables (most are safe)

### Error: "permission denied"
**Cause**: Using wrong role or insufficient permissions
**Fix**: 
- Make sure you're running as the project owner
- Check you're in the correct Supabase project
- Try running in smaller chunks

### Error: "syntax error"
**Cause**: SQL syntax issue or copy-paste error
**Fix**:
- Check you copied the entire file
- Make sure no extra characters were added
- Try running the query section by section

### Tables not showing up
**Cause**: Refresh issue or view filter
**Fix**:
- Refresh the Table Editor page
- Check you're looking at "public" schema (not other schemas)
- Verify the SQL ran successfully (check for error messages)

---

## Alternative: Run One File at a Time

If you encounter issues, you can run the SQL in smaller chunks:

### For schema.sql:
Run sections separately:
1. First: Extension and type creation
2. Second: Table creation (one table at a time if needed)
3. Third: Index creation

### For rls.sql:
Run policies table by table:
- Users policies
- Profiles policies
- Matches policies
- etc.

---

## Quick Reference

**Recommended Method:**
- Use Supabase CLI: `supabase db push` (see [DB_MIGRATIONS.md](./DB_MIGRATIONS.md))

**Manual Fallback:**
- Run migrations from `/supabase/migrations/` in order via SQL Editor

**How to Verify:**
```bash
cd mobile
npm run verify:staging
```

---

## After Running Migrations

Once all migrations are complete:

1. ✅ Verify setup:
   ```bash
   cd mobile
   npm run verify:staging
   ```

2. ✅ Get your Supabase keys:
   - Go to Settings → API
   - Copy: Project URL, anon key, service_role key

3. ✅ Test the connection:
   - Your app should now be able to connect to the database
   - Try creating a test user (once auth is set up)

---

## Need Help?

**For CLI method:**
- See [DB_MIGRATIONS.md](./DB_MIGRATIONS.md) for troubleshooting
- **⚠️ Prerequisite:** Ensure you're linked (`supabase link --project-ref <ref>`) before checking status
- Check `npm run db:status` / `supabase migration list` to see migration status (requires link)
- Use `npm run db:diff` / `supabase db diff --linked` to see schema differences (prints to stdout)
- Verify you're linked to the correct project: `supabase projects list`

**For manual method:**
- Check the error message in SQL Editor
- Verify you copied the entire file
- Make sure you ran them in the correct order
- Check Supabase project status (should be "Active")

Most errors are harmless (like "already exists") and won't affect functionality.
