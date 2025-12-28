# Staging Setup Final Checklist - Code-Only OTP Auth

**Purpose:** Complete checklist for setting up staging environment with code-only OTP authentication

**Time:** ~15 minutes

---

## Prerequisites

- [ ] Supabase staging project created
- [ ] Access to Supabase Dashboard (staging project)
- [ ] Database access (for running migrations)

---

## Part 1: Database Migrations

### Step 1: Run Auth OTP Migration

**File:** `db/auth_otp_migration.sql`

**What it does:**

- Adds `full_name` column to `profiles` table
- Adds `signup_completed` boolean column to `profiles` table
- Creates index on `signup_completed`
- Updates existing profiles with `completion_pct >= 100` to mark signup as complete

**Command:**

```bash
psql -h your-staging-db-host -U postgres -d your-staging-db-name -f db/auth_otp_migration.sql
```

**Verification:**

- [ ] Migration runs without errors
- [ ] `profiles` table has `full_name` column (TEXT)
- [ ] `profiles` table has `signup_completed` column (BOOLEAN, default false)
- [ ] Index `idx_profiles_signup_completed` exists

### Step 2: Run Profile Auto-Create Trigger Migration

**File:** `db/profiles_auto_create_trigger.sql`

**What it does:**

- Creates `handle_new_user()` function
- Creates trigger `on_auth_user_created` on `auth.users` table
- Automatically creates `users` and `profiles` rows when new auth user is created

**Command:**

```bash
psql -h your-staging-db-host -U postgres -d your-staging-db-name -f db/profiles_auto_create_trigger.sql
```

**Verification:**

- [ ] Migration runs without errors
- [ ] Function `public.handle_new_user()` exists
- [ ] Trigger `on_auth_user_created` exists on `auth.users` table

**Test trigger (optional):**

```sql
-- Create test auth user (will auto-create profile)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'test+trigger@example.com',
  crypt('test', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Verify profile was created
SELECT * FROM profiles WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test+trigger@example.com');

-- Clean up
DELETE FROM auth.users WHERE email = 'test+trigger@example.com';
```

---

## Part 2: Supabase Dashboard Configuration

### Step 3: Configure Email OTP Template

**Location:** Supabase Dashboard → Authentication → Email Templates → **Magic Link** template

**Required Changes:**

1. **Include OTP Code:**
   - [ ] Template includes `{{ .Token }}` placeholder (exact syntax with spaces)
   - [ ] Code will be displayed as 6-digit number

2. **Remove Login Links:**
   - [ ] Template does NOT include `{{ .SiteURL }}` variable
   - [ ] Template does NOT include `{{ .RedirectTo }}` variable
   - [ ] Template does NOT include any clickable buttons or HTML links
   - [ ] Template does NOT say "Click here to sign in"
   - [ ] Template does NOT say "Open this link"

3. **Template Content:**
   - [ ] Template instructs user to **enter code in app** (not click link)
   - [ ] Example: "Enter this code in the app to verify your email"

**Correct Template Example:**

```
Subject: Your Chem IRL verification code

Your verification code is: {{ .Token }}

Enter this code in the app to verify your email.

This code expires in 1 hour.

If you didn't request this code, you can safely ignore this email.
```

**Verification:**

- [ ] Save template
- [ ] Request test OTP from mobile app
- [ ] Verify email contains only code (no links)
- [ ] Verify email instructs to enter code (not click link)

**See:** [Supabase OTP Template Checklist](./SUPABASE_OTP_TEMPLATE_CHECKLIST.md) for detailed step-by-step instructions

### Step 4: Enable Phone Auth Provider (Twilio Verify)

**Location:** Supabase Dashboard → Authentication → Providers

**Prerequisites:**

- [ ] Twilio account created (https://www.twilio.com/try-twilio)
- [ ] Twilio Verify Service created (Service SID starting with `VA...`)
- [ ] Twilio Account SID and Auth Token copied from Twilio Console

**Required Steps:**

1. **Create Twilio Verify Service (if not done):**
   - [ ] Go to Twilio Console → **Verify**
   - [ ] Click **"Create new"**
   - [ ] Give service a friendly name (e.g., "Chem IRL Phone Verification")
   - [ ] Enable **SMS** channel
   - [ ] Click **"Create"**
   - [ ] **Copy Service SID** (starts with `VA...`)

2. **Get Twilio Credentials:**
   - [ ] In Twilio Console, go to **Account** → **Account Info**
   - [ ] Copy **Account SID** (starts with `AC...`)
   - [ ] Copy **Auth Token** (click "View" to reveal)

3. **Enable Phone Provider in Supabase:**
   - [ ] Navigate to Authentication → Providers
   - [ ] Find **"Phone"** in the list
   - [ ] Toggle **"Phone"** to **ON** (enabled)

4. **Configure Twilio Verify in Supabase:**
   - [ ] In Phone provider section, find **"SMS Provider"** dropdown
   - [ ] Select **"Twilio Verify"** from dropdown (not "Twilio" - use "Twilio Verify")
   - [ ] Enter **Twilio Account SID** (from Step 4.2)
   - [ ] Enter **Twilio Auth Token** (from Step 4.2)
   - [ ] Enter **Twilio Verify Service SID** (from Step 4.1, starts with `VA...`)
   - [ ] Click **"Save"**

**Verification:**

- [ ] Phone provider is enabled
- [ ] Twilio Verify is selected as SMS provider
- [ ] All three credentials are saved (Account SID, Auth Token, Service SID)
- [ ] Test phone verification from mobile app (see Step 6 below)

**Note:** Twilio Verify automatically handles SMS formatting - no custom SMS template configuration needed.

---

## Part 3: Verify Setup

### Step 5: Run Verification Script

**Command:**

```bash
cd mobile
npm run verify:staging
```

**Expected Output:**

```
✅ Table: profiles
✅ Table: matches
✅ Table: proposals
✅ Table: confirms
✅ Table: messages
✅ Table: push_tokens
✅ Table: profiles.full_name column
✅ Table: profiles.signup_completed column
✅ RPC: get_discovery_feed
✅ RPC: create_like_and_check_match
✅ RPC: confirm_proposal
✅ RPC: mark_messages_read
✅ Storage: profiles bucket
✅ Constraint: confirms_proposal_id_unique
✅ Trigger: on_auth_user_created (auto-create profiles)

✅ All checks passed!
```

**If any checks fail:**

- Review error messages
- Verify migrations were run successfully
- Check Supabase Dashboard settings
- See troubleshooting section below

### Step 6: Manual Test Flow

**Test Sign Up:**

1. [ ] Open mobile app
2. [ ] Tap "Sign up"
3. [ ] Enter email address
4. [ ] Tap "Continue"
5. [ ] Check email for OTP code (6 digits)
6. [ ] Verify email contains ONLY code (no links)
7. [ ] Enter 6-digit code in app
8. [ ] Email verified → Navigate to phone entry
9. [ ] Enter phone number
10. [ ] Tap "Continue"
11. [ ] Check SMS for OTP code (6 digits)
12. [ ] Enter 6-digit code in app
13. [ ] Phone verified → Navigate to name entry
14. [ ] Enter full name
15. [ ] Tap "Continue"
16. [ ] Signup complete → Navigate to onboarding

**Test Log In:**

1. [ ] Open mobile app
2. [ ] Tap "Log in"
3. [ ] Enter phone number
4. [ ] Tap "Continue"
5. [ ] Check SMS for OTP code (6 digits)
6. [ ] Enter 6-digit code in app
7. [ ] Authenticated → Navigate to main app (or onboarding if incomplete)

---

## Troubleshooting

### Email Contains Links?

**Cause:** Template still includes `{{ .SiteURL }}` or `{{ .RedirectTo }}`

**Fix:**

1. Go to Supabase Dashboard → Authentication → Email Templates → Magic Link
2. Remove all `{{ .SiteURL }}` and `{{ .RedirectTo }}` variables
3. Remove any clickable buttons or links
4. Save template
5. Request fresh OTP code

### Profile Columns Missing?

**Cause:** Migration not run or failed

**Fix:**

1. Check migration file exists: `db/auth_otp_migration.sql`
2. Run migration again: `psql -h ... -f db/auth_otp_migration.sql`
3. Verify columns exist: `SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name IN ('full_name', 'signup_completed');`

### Trigger Not Working?

**Cause:** Trigger migration not run or failed

**Fix:**

1. Check migration file exists: `db/profiles_auto_create_trigger.sql`
2. Run migration again: `psql -h ... -f db/profiles_auto_create_trigger.sql`
3. Verify trigger exists: `SELECT trigger_name FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`

### Phone OTP Not Sending?

**Cause:** Phone provider not enabled or SMS provider not configured

**Fix:**

1. Go to Supabase Dashboard → Authentication → Providers
2. Verify Phone provider is enabled
3. Verify SMS provider credentials are correct
4. Check SMS provider account has credits/balance
5. Verify SMS template includes `{{ .Token }}`

---

## Success Criteria

- [ ] Both migrations run successfully
- [ ] Email template uses `{{ .Token }}` only (no links)
- [ ] Phone provider enabled and configured
- [ ] SMS template includes `{{ .Token }}`
- [ ] Verification script passes all checks
- [ ] Sign up flow works end-to-end (email OTP → phone OTP → name → onboarding)
- [ ] Log in flow works (phone OTP → main app)
- [ ] No browser redirects occur during auth

---

## Related Documentation

- [Supabase OTP Template Checklist](./SUPABASE_OTP_TEMPLATE_CHECKLIST.md) - Detailed email template configuration
- [Supabase Dashboard Checklist](./SUPABASE_DASHBOARD_CHECKLIST.md) - Step-by-step dashboard configuration
- [Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md) - Complete staging environment setup
- [OTP-Based Authentication Setup](./README.md#otp-based-authentication-setup) - Full auth setup guide

---

**Last Updated:** 2025-12-27
