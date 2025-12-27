# Supabase Staging Project Setup

## Overview

This guide explains when and how to set up a separate Supabase staging project for testing the mobile app.

## Environment Variables

The mobile app requires the following **public** environment variables (safe to expose in client code):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_publishable_anon_key_here
```

**⚠️ CRITICAL SECURITY WARNING:**

- **NEVER** include the service role key (`SUPABASE_SERVICE_ROLE_KEY`) in Expo public environment variables
- Service role keys bypass Row Level Security (RLS) and must only be used in server-side code
- Only use the **anon/public** publishable key in mobile apps
- The app uses `EXPO_PUBLIC_SUPABASE_KEY` which should be the anon/public key from Supabase Dashboard → Settings → API

## When to Use a Staging Project vs Single Project

### ✅ **Use Separate Staging Project** (Strongly Recommended)

**Use staging when:**

- Testing features that create or modify data (matching, proposals, chat, photo uploads)
- Running two-device tests that create matches/messages
- Testing onboarding flows with multiple accounts
- Testing photo deletion (destructive operation)
- Testing error scenarios that might pollute data
- Any testing that involves creating auth users

**Why staging is recommended:**

1. **Destructive Operations:** The app can delete photos from storage (`storage.from('profiles').remove()`)
2. **Test Data Pollution:** Matching, likes, proposals, and messages create real database records
3. **Auth User Management:** Two-device testing requires creating auth users for Account A and B
4. **Discovery Feed Impact:** Test accounts can affect `get_discovery_feed` RPC results
5. **Data Isolation:** Prevents accidentally matching with production users or affecting production analytics

### ⚠️ **Single Project OK** (Limited Use Cases)

**Single project may be acceptable for:**

- Read-only smoke tests
- UI/UX testing with static test data already in database
- Quick verification of RPCs/tables without creating new data

**Risks of using single project for testing:**

- Test matches/messages/proposals pollute production data
- Test accounts may appear in discovery feed for real users
- Photo deletion could accidentally remove production photos (mitigated by RLS, but risky)
- Difficulty separating test vs production analytics/metrics

## Database Dependencies

The mobile app uses the following database resources:

### Tables

1. **`profiles`**
   - **Operations:** SELECT, UPSERT
   - **Usage:** Profile data (headline, bio, photos), onboarding completion
   - **Files:**
     - `src/screens/profile/ProfileScreen.tsx` (lines 47, 91, 156, 219, 282)
     - `src/screens/onboarding/ProfileSetupScreen.tsx` (line 65)
     - `src/screens/onboarding/PhotosScreen.tsx` (lines 34, 106, 115)
     - `src/screens/discover/DiscoverScreen.tsx` (line 50)
     - `src/screens/matches/MatchesScreen.tsx` (line 84)
     - `src/screens/matches/MatchDetailScreen.tsx` (line 64)
     - `src/screens/debug/DebugScreen.tsx` (line 81, 139)
     - `App.tsx` (lines 42, 72) - profile completion check

2. **`matches`**
   - **Operations:** SELECT
   - **Usage:** Match records between users
   - **Files:**
     - `src/screens/matches/MatchesScreen.tsx` (line 63)
     - `src/screens/matches/MatchDetailScreen.tsx` (line 48)

3. **`proposals`**
   - **Operations:** SELECT, INSERT
   - **Usage:** Date/time proposals between matched users
   - **Files:**
     - `src/screens/matches/ProposeScreen.tsx` (line 306)
     - `src/screens/matches/MatchDetailScreen.tsx` (line 78)
     - `src/components/ProposalCard.tsx` (line 49)

4. **`confirms`**
   - **Operations:** SELECT, INSERT
   - **Usage:** Proposal confirmations
   - **Files:**
     - `src/screens/matches/MatchDetailScreen.tsx` (line 91)
     - `src/components/ProposalCard.tsx` (line 34)

5. **`messages`**
   - **Operations:** SELECT, INSERT, Real-time subscriptions
   - **Usage:** Chat messages between matched users
   - **Files:**
     - `src/screens/matches/ChatScreen.tsx` (lines 36, 102)

### RPC Functions

1. **`get_discovery_feed(p_viewer uuid, p_limit integer)`**
   - **Usage:** Discovery feed with user filtering
   - **Files:**
     - `src/screens/discover/DiscoverScreen.tsx` (line 32)

2. **`create_like_and_check_match(p_liker uuid, p_likee uuid)`**
   - **Usage:** Create like and check for mutual match
   - **Files:**
     - `src/screens/discover/DiscoverScreen.tsx` (line 86)

### Storage Buckets

1. **`profiles`**
   - **Operations:** UPLOAD, DELETE, LIST, GET_PUBLIC_URL
   - **Usage:** Profile photos
   - **Files:**
     - `src/lib/storage.ts` (line 90) - delete
     - `src/lib/reconcilePhotos.ts` (line 57) - list
     - `src/screens/profile/ProfileScreen.tsx` (line 218, 234) - upload, getPublicUrl
     - `src/screens/onboarding/PhotosScreen.tsx` (line 86, 102) - upload, getPublicUrl

### Auth

- **Supabase Auth** - User authentication via magic links
- **Files:**
  - `src/lib/auth.ts` - auth functions
  - `App.tsx` - session management

## Staging Parity Checklist

When setting up staging, ensure the following matches production:

### Database Schema

- [ ] **Tables:**
  - [ ] `profiles` - with columns: `user_id`, `prompts`, `photos`, `completion_pct`
  - [ ] `matches` - with columns: `match_id`, `user_a`, `user_b`, `status`, `created_at`
  - [ ] `proposals` - with columns for proposal data (match_id, sender_id, windows, date_types, note, expires_at, status)
  - [ ] `confirms` - with columns for confirmations
  - [ ] `messages` - with columns for chat messages (match_id, sender_id, content, created_at)

- [ ] **Row Level Security (RLS):**
  - [ ] RLS enabled on all tables
  - [ ] Policies allow users to read their own data
  - [ ] Policies allow users to read matched users' profiles
  - [ ] Policies prevent users from modifying other users' data
  - [ ] Policies allow photo uploads/deletes only for own user_id

- [ ] **RPC Functions:**
  - [ ] `get_discovery_feed(p_viewer uuid, p_limit integer)` - returns filtered feed
  - [ ] `create_like_and_check_match(p_liker uuid, p_likee uuid)` - creates like and checks for match

- [ ] **Triggers/Functions (if any):**
  - [ ] Match creation triggers (if matches are auto-created)
  - [ ] Any database functions referenced in RPCs

### Storage

- [ ] **Buckets:**
  - [ ] `profiles` bucket exists
  - [ ] Bucket is public (or has appropriate policies)
  - [ ] Storage policies allow:
    - [ ] Users can upload to `{user_id}/*` path
    - [ ] Users can delete from `{user_id}/*` path
    - [ ] Users can list `{user_id}/*` path
    - [ ] Public read access for photos

### Auth Configuration

- [ ] **Email Auth:**
  - [ ] Email provider configured
  - [ ] Email templates configured (magic link)
  - [ ] Redirect URL configured: `chemirl:///auth/callback`

- [ ] **Deep Linking:**
  - [ ] App scheme `chemirl://` configured in Supabase
  - [ ] Redirect URLs match mobile app configuration

## Setup Procedure

### 1. Create Staging Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Name it: `chem-irl-staging` (or similar)
4. Choose organization and region (match production if possible)
5. Set database password (save securely)
6. Wait for project to initialize

### 2. Configure Environment Variables

Create or update `.env.local` in `mobile/` directory:

```env
# Staging Supabase
EXPO_PUBLIC_SUPABASE_URL=https://your-staging-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_staging_anon_key_here
```

**Get keys from:**

- Supabase Dashboard → Your Project → Settings → API
- **Project URL** → `EXPO_PUBLIC_SUPABASE_URL`
- **anon public** key → `EXPO_PUBLIC_SUPABASE_KEY`

### 3. Run Database Migrations

Copy production schema to staging:

- [ ] Export schema from production (if using migrations)
- [ ] Run migrations on staging project
- [ ] Or manually create tables matching production structure

### 4. Set Up Storage

- [ ] Create `profiles` bucket
- [ ] Configure bucket as public (or set appropriate policies)
- [ ] Set up storage policies for upload/delete/list

### 5. Configure Auth

- [ ] Set up email provider (or use Supabase default)
- [ ] Configure redirect URL: `chemirl:///auth/callback`
- [ ] Configure email templates (magic link)

### 6. Deploy RPC Functions

- [ ] Create `get_discovery_feed` function
- [ ] Create `create_like_and_check_match` function
- [ ] Ensure function signatures match production

### 7. Verify Setup

**Option A: Use Verification Script (Recommended)**

1. Create `.env.seed` file with service role key:

   ```env
   SUPABASE_URL=https://your-staging-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. Run verification:

   ```bash
   npm run verify:staging
   ```

   This will check:
   - All required tables exist
   - All required RPC functions exist
   - Storage bucket exists
   - Print clear PASS/FAIL results

**⚠️ SECURITY:** `.env.seed` contains the service role key which bypasses RLS. Keep it gitignored!

**Option B: Manual Verification Queries**

Run verification queries (see below) in Supabase SQL Editor to confirm staging matches production.

## Verification Queries

Run these SQL queries in Supabase SQL Editor to verify staging setup:

### Check Tables Exist

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'matches', 'proposals', 'confirms', 'messages')
ORDER BY table_name;
```

Expected: All 5 tables should exist.

### Check RLS is Enabled

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'matches', 'proposals', 'confirms', 'messages');
```

Expected: `rowsecurity` should be `true` for all tables.

### Check RPC Functions Exist

```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('get_discovery_feed', 'create_like_and_check_match')
ORDER BY routine_name;
```

Expected: Both functions should exist.

### Check Storage Bucket Exists

```sql
SELECT name, public
FROM storage.buckets
WHERE name = 'profiles';
```

Expected: `profiles` bucket exists, `public` should be `true` or policies configured.

### Check Profile Structure

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

Expected: Should include `user_id`, `prompts` (jsonb), `photos` (jsonb/text[]), `completion_pct` (numeric/integer).

### Test Discovery Feed RPC

```sql
-- Replace with a test user_id if available
SELECT * FROM get_discovery_feed(
  p_viewer := '00000000-0000-0000-0000-000000000000'::uuid,
  p_limit := 10
);
```

Expected: Query should execute without errors (may return empty if no data).

### Check Auth Configuration

In Supabase Dashboard:

- [ ] Settings → Auth → URL Configuration
- [ ] Verify "Site URL" and "Redirect URLs" include your app scheme
- [ ] Settings → Auth → Providers → Email
- [ ] Verify email provider is enabled

## Switching Between Staging and Production

### Using npm Scripts (Recommended)

The easiest way to switch environments is using the provided npm scripts:

**Switch to Staging:**

```bash
npm run use:staging
```

**Switch to Production:**

```bash
npm run use:production
```

These scripts will:

1. Copy `.env.staging` or `.env.production` to `.env.local`
2. Display a reminder to restart Expo dev server

**Important:** After switching, restart Expo dev server:

```bash
# Stop server (Ctrl+C if running)
npm start
```

### Setting Up Environment Files

1. **Create `.env.staging`** (based on `.env.staging.example`):

   ```bash
   cp .env.staging.example .env.staging
   # Edit .env.staging with your staging credentials
   ```

2. **Create `.env.production`** (based on `.env.production.example`):

   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your production credentials
   ```

3. **Verify files are gitignored:**
   - `.env.staging` and `.env.production` should be in `.gitignore`
   - Only `.env.staging.example` and `.env.production.example` are committed

### Manual Switch Method

If you prefer to switch manually:

**For Staging:**

```env
# In .env.local
EXPO_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=staging_anon_key
```

**For Production:**

```env
# In .env.local
EXPO_PUBLIC_SUPABASE_URL=https://production-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=production_anon_key
```

**Important:** Restart Expo dev server after changing `.env.local`:

```bash
# Stop server (Ctrl+C)
npm start
```

## Troubleshooting

### "Table does not exist" errors

- Verify tables were created in staging
- Check RLS policies allow access
- Ensure you're connected to staging project (check URL in error)

### "Function does not exist" errors

- Verify RPC functions were created
- Check function signatures match (parameter names/types)
- Ensure function is in `public` schema

### "Storage bucket not found" errors

- Verify `profiles` bucket exists
- Check bucket name is exactly `profiles`
- Verify storage policies allow access

### Auth redirect not working

- Verify redirect URL in Supabase: `chemirl:///auth/callback`
- Check app scheme in `app.json` matches
- Ensure deep linking is configured correctly

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage](https://supabase.com/docs/guides/storage)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)
