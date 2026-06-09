# Server-Side Automation Guide

> ℹ️ **Reference / explanation, not a manual setup step.** The pg_cron jobs described here are codified in `supabase/migrations/` and applied via `supabase db push`. Use this doc to understand the automation; don't hand-run the SQL on a project that already has the migrations applied.

This document explains the automated database jobs for proposal expiry and daily scoring.

## Overview

Two automated processes run in the background:

1. **Proposal Expiry** - Updates `proposals.status` to `'expired'` for proposals past their `expires_at` time
2. **Daily Scoring** - Runs `update_daily_action_speed()` to calculate daily Action Speed scores for all users

Both are implemented using **pg_cron**, a PostgreSQL extension that runs scheduled SQL jobs directly in the database.

---

## Installation

### Step 1: Enable pg_cron Extension

Supabase enables `pg_cron` by default on managed instances, but verify it's enabled:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 2: Run Automation Setup

Run the `db/automation.sql` file in Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Create a new query
3. Copy the entire contents of `db/automation.sql`
4. Paste and run

This will:
- Create the `expire_proposals()` function
- Create the `run_daily_scoring()` wrapper function
- Schedule two cron jobs:
  - Proposal expiry: Every hour
  - Daily scoring: Daily at midnight UTC

---

## How It Works

### Proposal Expiry

**Function**: `expire_proposals()`

**Schedule**: Every hour at minute 0 (e.g., 1:00, 2:00, 3:00...)

**What it does**:
- Finds all proposals where `expires_at < NOW()` AND `status = 'active'`
- Updates their `status` to `'expired'`
- Returns count of expired proposals

**Idempotent**: Safe to run multiple times. Only updates proposals that need updating.

**SQL**:
```sql
UPDATE proposals
SET status = 'expired'
WHERE expires_at < NOW() AND status = 'active';
```

### Daily Scoring

**Function**: `run_daily_scoring()`

**Schedule**: Daily at 00:00 UTC (midnight)

**What it does**:
- Calls `update_daily_action_speed()` function
- Updates `scores_daily` table for all users
- Calculates Action Speed based on:
  - Previous day's score (-8 base, floor at 50)
  - Likes sent yesterday (+2 per like, capped at +16)

**Idempotent**: The underlying `update_daily_action_speed()` function uses `ON CONFLICT` to handle multiple runs.

---

## Manual Testing

### Test Proposal Expiry

**Option 1: Run the function directly**
```sql
SELECT * FROM expire_proposals();
```

This will return:
```
expired_count | message
--------------+-------------------
3             | Expired 3 proposal(s)
```

**Option 2: Create a test proposal and expire it**

1. Create a proposal with past expiry:
```sql
INSERT INTO proposals (match_id, sender_id, windows, date_types, expires_at, status)
VALUES (
  '<match_id>',
  '<user_id>',
  '[{"start": "2024-01-01T10:00:00Z", "end": "2024-01-01T11:00:00Z"}]'::jsonb,
  '["coffee"]'::jsonb,
  NOW() - INTERVAL '1 hour',  -- Expired 1 hour ago
  'active'
);
```

2. Run the expiry function:
```sql
SELECT * FROM expire_proposals();
```

3. Verify it's expired:
```sql
SELECT proposal_id, expires_at, status
FROM proposals
WHERE proposal_id = '<proposal_id>';
-- Should show status = 'expired'
```

### Test Daily Scoring

**Option 1: Run the function directly**
```sql
SELECT * FROM run_daily_scoring();
```

This will return:
```
success | message
--------+--------------------------------
true    | Daily scoring completed for 15 users
```

**Option 2: Verify scores were created/updated**

Before running:
```sql
SELECT COUNT(*) FROM scores_daily WHERE day = CURRENT_DATE;
-- Might be 0 if not run today yet
```

After running:
```sql
SELECT * FROM run_daily_scoring();
SELECT COUNT(*) FROM scores_daily WHERE day = CURRENT_DATE;
-- Should show > 0 if there are users
```

---

## Verification Queries

### Check Scheduled Jobs

View all cron jobs:
```sql
SELECT 
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobid;
```

### Check Job Execution History

View recent job runs:
```sql
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Verify Proposal Expiry is Working

**Check for expired proposals that should be marked expired:**
```sql
SELECT 
  proposal_id,
  expires_at,
  status,
  created_at,
  NOW() - expires_at as time_since_expiry
FROM proposals
WHERE expires_at < NOW() 
  AND status = 'active'
ORDER BY expires_at DESC;
```
This should return 0 rows (all expired proposals should have status = 'expired').

**Count proposals expired today:**
```sql
SELECT COUNT(*) as expired_today
FROM proposals
WHERE status = 'expired'
  AND DATE(updated_at) = CURRENT_DATE;
```

### Verify Daily Scoring is Working

**Check if scoring ran today:**
```sql
SELECT 
  COUNT(DISTINCT user_id) as users_with_scores_today,
  AVG(action_speed) as avg_action_speed,
  MIN(action_speed) as min_action_speed,
  MAX(action_speed) as max_action_speed
FROM scores_daily
WHERE day = CURRENT_DATE;
```

**Check latest scoring date:**
```sql
SELECT 
  MAX(day) as latest_score_date,
  COUNT(DISTINCT user_id) as total_users_with_scores
FROM scores_daily;
```

**Compare yesterday vs today scores:**
```sql
SELECT 
  sd1.user_id,
  sd1.day as yesterday,
  sd1.action_speed as yesterday_score,
  sd2.day as today,
  sd2.action_speed as today_score,
  sd2.action_speed - sd1.action_speed as change
FROM scores_daily sd1
JOIN scores_daily sd2 ON sd1.user_id = sd2.user_id
WHERE sd1.day = CURRENT_DATE - INTERVAL '1 day'
  AND sd2.day = CURRENT_DATE
ORDER BY change DESC
LIMIT 10;
```

---

## Troubleshooting

### Jobs Not Running

**Check if pg_cron is enabled:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

**Check job status:**
```sql
SELECT * FROM cron.job WHERE jobname IN ('expire_proposals_hourly', 'daily_scoring_midnight');
```

**Check for errors in job history:**
```sql
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;
```

### Proposal Expiry Not Working

**Manual test:**
```sql
-- See what should be expired
SELECT COUNT(*) FROM proposals 
WHERE expires_at < NOW() AND status = 'active';

-- Run manually
SELECT * FROM expire_proposals();

-- Check again (should be 0)
SELECT COUNT(*) FROM proposals 
WHERE expires_at < NOW() AND status = 'active';
```

**Check if job is scheduled:**
```sql
SELECT * FROM cron.job WHERE jobname = 'expire_proposals_hourly';
```

### Daily Scoring Not Working

**Manual test:**
```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'update_daily_action_speed';

-- Run manually
SELECT * FROM run_daily_scoring();

-- Verify scores updated
SELECT COUNT(*) FROM scores_daily WHERE day = CURRENT_DATE;
```

**Check job schedule:**
```sql
SELECT * FROM cron.job WHERE jobname = 'daily_scoring_midnight';
```

### Remove/Unschedule Jobs

To remove a scheduled job:
```sql
SELECT cron.unschedule('expire_proposals_hourly');
SELECT cron.unschedule('daily_scoring_midnight');
```

To reschedule (if needed):
```sql
-- Reschedule proposal expiry to run every 30 minutes instead of hourly
SELECT cron.unschedule('expire_proposals_hourly');
SELECT cron.schedule(
  'expire_proposals_hourly',
  '*/30 * * * *',  -- Every 30 minutes
  $$SELECT expire_proposals();$$
);
```

---

## Production Deployment

### Initial Setup

1. **Run in Supabase SQL Editor:**
   ```sql
   -- Copy entire contents of db/automation.sql and run
   ```

2. **Verify jobs are scheduled:**
   ```sql
   SELECT * FROM cron.job;
   ```

3. **Wait and verify execution:**
   - For proposal expiry: Wait up to 1 hour, then check `cron.job_run_details`
   - For daily scoring: Wait until next midnight UTC, then check `scores_daily`

### Monitoring

Set up alerts (if available in Supabase):
- Monitor `cron.job_run_details` for failed jobs
- Check that `scores_daily` has entries for `CURRENT_DATE` daily
- Monitor for proposals stuck in 'active' status past expiry

### Backup

The automation functions are in `db/automation.sql`. If you need to recreate:
1. Keep a backup of the file
2. Can re-run the entire file (functions are `CREATE OR REPLACE`, jobs use `cron.schedule` which handles duplicates)

---

## Related Files

- `db/automation.sql` - SQL functions and cron job setup
- `db/scoring.sql` - Contains `update_daily_action_speed()` function
- `db/schema.sql` - Contains `proposals` table definition

