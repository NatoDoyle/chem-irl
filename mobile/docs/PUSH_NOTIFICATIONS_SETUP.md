# Push Notifications Setup Guide

This guide covers setting up push notifications for the Chem IRL mobile app using Expo Notifications and Supabase Edge Functions.

## Overview

Push notifications are sent when:

- A new match is created (both users notified)
- A new message is sent (recipient notified)
- A new proposal is created (recipient notified)
- A proposal is confirmed (sender notified)

## Prerequisites

1. Expo account with project configured
2. Supabase project with database migrations applied
3. Supabase Edge Functions enabled
4. Expo Push Notification service (included with Expo)

## Step 1: Database Setup

The `push_tokens` table should already exist from the migration. Verify it exists:

```sql
-- Check if push_tokens table exists
SELECT * FROM push_tokens LIMIT 1;
```

If it doesn't exist, run the migration:

```sql
-- Run in Supabase SQL Editor (in order):
-- 1. db/schema.sql (if not already applied)
-- 2. db/rls.sql (if not already applied)
-- 3. db/push_notifications.sql
```

**Note**: The `push_tokens` table requires the `users` table to exist (foreign key constraint).

## Step 2: Deploy Edge Function

The edge function handles webhook events and sends push notifications via Expo Push API.

### 2.1 Install Supabase CLI

```bash
npm install -g supabase
```

### 2.2 Login to Supabase

```bash
supabase login
```

### 2.3 Link to Project

```bash
cd /path/to/chem-irl
supabase link --project-ref your-project-ref
```

### 2.4 Set Environment Variables

The edge function needs these secrets (set via Supabase CLI or Dashboard):

**Required secrets:**

- `SUPABASE_URL`: Your Supabase project URL (e.g., `https://abc123.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY`: Your service role key (from Supabase Dashboard → Settings → API)
- `PUSH_WEBHOOK_SECRET`: A shared secret for webhook authentication (generate a strong random string)

**Set secrets via CLI:**

```bash
# Generate a secure random secret (recommended)
openssl rand -hex 32

# Set secrets
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set PUSH_WEBHOOK_SECRET=your_generated_secret
```

**Or via Dashboard:**

1. Go to Supabase Dashboard → Edge Functions → Secrets
2. Add each secret: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUSH_WEBHOOK_SECRET`

**⚠️ WARNING**:

- Service role key bypasses RLS. Keep it secret!
- Webhook secret must match the header value in webhook configuration

### 2.5 Deploy Function

```bash
supabase functions deploy push
```

Verify deployment:

```bash
supabase functions list
```

## Step 3: Configure Database Webhooks

Webhooks trigger the edge function when events occur in the database.

### 3.1 Enable Webhooks in Supabase

1. Go to Supabase Dashboard → Database → Webhooks
2. Click "Create a new webhook"

### 3.2 Create Webhook for Matches

**Name**: `notify_match_created`

**Table**: `matches`

**Events**: `INSERT`

**HTTP Request**:

- **Method**: `POST`
- **URL**: `https://your-project-ref.supabase.co/functions/v1/push`
- **Headers**:
  - `x-webhook-secret: YOUR_PUSH_WEBHOOK_SECRET` (must match the secret set in edge function)
  - `Content-Type: application/json`

**Payload**: Leave default (sends full record)

**⚠️ IMPORTANT**: The `x-webhook-secret` header value must exactly match the `PUSH_WEBHOOK_SECRET` environment variable set in the edge function.

### 3.3 Create Webhook for Messages

**Name**: `notify_message_sent`

**Table**: `messages`

**Events**: `INSERT`

**HTTP Request**: Same as above (use `x-webhook-secret` header)

### 3.4 Create Webhook for Proposals

**Name**: `notify_proposal_created`

**Table**: `proposals`

**Events**: `INSERT`

**HTTP Request**: Same as above (use `x-webhook-secret` header)

### 3.5 Create Webhook for Confirms

**Name**: `notify_proposal_confirmed`

**Table**: `confirms`

**Events**: `INSERT`

**HTTP Request**: Same as above (use `x-webhook-secret` header)

## Step 4: Mobile App Configuration

The mobile app already includes notification registration code. Verify it's working:

### 4.1 Check Environment Variables

Ensure `mobile/.env` has:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your-anon-key
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id  # Optional, for Expo Push
```

### 4.2 Test Token Registration

1. Run the app: `cd mobile && npm start`
2. Sign in with a test account
3. Check Supabase Dashboard → Database → `push_tokens` table
4. Verify a token was inserted for your user

### 4.3 Test Notifications

**Two-Device Test**:

1. **Device A**: Sign in as `userA@example.com`
2. **Device B**: Sign in as `userB@example.com`
3. **Device A**: Like User B (creates match)
4. **Device B**: Should receive "New Match!" notification
5. **Device B**: Tap notification → Should navigate to MatchDetail

**Message Test**:

1. **Device A**: Send message to Device B
2. **Device B** (app closed/backgrounded): Should receive "New Message" notification
3. **Device B**: Tap notification → Should navigate to Chat screen

## Step 5: Testing

**For detailed staging validation, see [STAGING_PUSH_VALIDATION.md](./STAGING_PUSH_VALIDATION.md).**

### 5.1 Manual Testing Checklist

- [ ] Token registered on sign in
- [ ] Token unregistered on sign out
- [ ] Match notification received (both users)
- [ ] Message notification received (recipient only)
- [ ] Proposal notification received (recipient only)
- [ ] Confirm notification received (sender only)
- [ ] Notification tap navigates to correct screen
- [ ] App handles notification when closed
- [ ] App handles notification when backgrounded
- [ ] App handles notification when foregrounded

### 5.2 Test with App Closed

1. Close app completely
2. Trigger event (send message, create match, etc.)
3. Verify notification appears
4. Tap notification
5. Verify app opens to correct screen

### 5.3 Test with App Backgrounded

1. Background app (home button/swipe)
2. Trigger event
3. Verify notification appears
4. Tap notification
5. Verify app navigates to correct screen

### 5.4 Test Invalid Tokens

The edge function automatically disables tokens that are invalid (e.g., app uninstalled). Check logs:

```bash
supabase functions logs push
```

## Step 6: Troubleshooting

### Notifications Not Received

1. **Check token registration**:

   ```sql
   SELECT * FROM push_tokens WHERE user_id = 'your-user-id' AND enabled = true;
   ```

2. **Check webhook logs**:
   - Supabase Dashboard → Database → Webhooks → View logs

3. **Check edge function logs**:

   ```bash
   supabase functions logs push
   ```

4. **Check Expo Push service**:
   - Verify project ID is correct
   - Check Expo account has push notifications enabled

### Navigation Not Working

1. Verify `navigationRef` is set in `App.tsx`
2. Check notification data includes `matchId`
3. Verify navigation structure matches `MainNavigator` setup

### Token Not Registered

1. Check notification permissions are granted
2. Verify `registerDeviceToken()` is called after sign in
3. Check `mobile/src/lib/notifications.ts` for errors
4. Verify Supabase RLS policies allow token insertion

## Step 7: Production Checklist

Before deploying to production:

- [ ] Edge function deployed to production Supabase project
- [ ] Webhooks configured in production database
- [ ] Environment variables set in production
- [ ] Test notifications on production build (not Expo Go)
- [ ] Verify token cleanup on sign out
- [ ] Monitor edge function logs for errors
- [ ] Set up alerts for edge function failures

## Architecture

```
Database Event (INSERT)
    ↓
Webhook (Supabase)
    ↓
Edge Function (push)
    ↓
Expo Push API
    ↓
Device Notification
    ↓
User Taps
    ↓
App Opens → Navigation
```

## Security Notes

1. **Service Role Key**: Only used in edge function, never exposed to client
2. **RLS Policies**: Push tokens table has RLS - users can only manage their own tokens
3. **Token Validation**: Edge function validates tokens before sending
4. **Debouncing**: Notifications are debounced (5s window) to prevent spam

## Monitoring

Monitor these metrics:

- Push token registration rate
- Notification delivery rate
- Invalid token cleanup rate
- Edge function error rate

Check Supabase Dashboard → Edge Functions → Metrics for performance data.

## Support

For issues:

1. Check edge function logs: `supabase functions logs push`
2. Check webhook logs in Supabase Dashboard
3. Verify token exists in database
4. Test with Expo Push tool: https://expo.dev/notifications
