# Supabase Database Setup - Running SQL Migrations

## Overview

You need to run 3 SQL files in Supabase to set up your database:
1. `db/schema.sql` - Creates all tables
2. `db/rls.sql` - Sets up Row Level Security
3. `db/kpi_views.sql` - Creates KPI views and functions

**Important**: Run them in this exact order!

---

## Step-by-Step Guide

### Step 1: Access Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Log in to your account
3. Click on your **chem-irl** project (or whatever you named it)
4. In the left sidebar, click **SQL Editor**
5. You should see an empty SQL editor window

### Step 2: Run schema.sql (Creates Tables)

1. Click **"New query"** button (top right)
2. Open the file `web/db/schema.sql` on your computer
3. Copy the **entire contents** of `schema.sql`
4. Paste it into the Supabase SQL Editor
5. Click **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
6. Wait for it to complete (should take 5-10 seconds)
7. You should see: "Success. No rows returned" or similar success message

**What this does:**
- Creates all database tables (users, profiles, matches, proposals, etc.)
- Creates custom types (user_gender, match_status, etc.)
- Creates indexes for performance
- Sets up the complete database structure

### Step 3: Run rls.sql (Row Level Security)

1. Click **"New query"** button again
2. Open the file `web/db/rls.sql` on your computer
3. Copy the **entire contents** of `rls.sql`
4. Paste into a new SQL Editor tab
5. Click **"Run"**
6. Wait for completion

**What this does:**
- Enables Row Level Security on all tables
- Creates security policies so users can only see their own data
- Protects your database from unauthorized access
- Ensures users can only see matches and proposals they're involved in

### Step 4: Run kpi_views.sql (KPI Views)

1. Click **"New query"** button again
2. Open the file `web/db/kpi_views.sql` on your computer
3. Copy the **entire contents** of `kpi_views.sql`
4. Paste into a new SQL Editor tab
5. Click **"Run"**
6. Wait for completion

**What this does:**
- Creates views for tracking KPIs (proposal-confirm rate, TTD, etc.)
- Sets up functions for daily KPI calculations
- Creates the north star metric view (confirmed dates/WAU)
- Prepares analytics infrastructure

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

**Files to Run (in order):**
1. `web/db/schema.sql` → Creates database structure
2. `web/db/rls.sql` → Adds security
3. `web/db/kpi_views.sql` → Adds analytics

**Where to Run:**
- Supabase Dashboard → SQL Editor

**How to Verify:**
- Table Editor → See all tables listed
- SQL Editor → Run: `SELECT * FROM users LIMIT 1;` (should work)

---

## After Running Migrations

Once all migrations are complete:

1. ✅ Get your Supabase keys:
   - Go to Settings → API
   - Copy: Project URL, anon key, service_role key

2. ✅ Add to Vercel:
   - Go to Vercel → Your Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

3. ✅ Test the connection:
   - Your app should now be able to connect to the database
   - Try creating a test user (once auth is set up)

---

## Need Help?

If migrations fail:
1. Check the error message in SQL Editor
2. Verify you copied the entire file
3. Make sure you ran them in the correct order
4. Check Supabase project status (should be "Active")

Most errors are harmless (like "already exists") and won't affect functionality.
