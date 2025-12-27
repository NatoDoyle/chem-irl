# Staging Push Validation Checklist

**Purpose:** End-to-end validation of push notifications with shared-secret webhook authentication.

## Prerequisites

- [ ] Database migrations applied (`db/push_notifications.sql`, etc.)
- [ ] Supabase CLI installed and linked to project
- [ ] Two test devices with app installed (Expo Go or dev build)
- [ ] Two test accounts ready

## Step 1: Generate and Set Secrets

**Generate webhook secret:**

```bash
openssl rand -hex 32
```

**Set all required secrets:**

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
supabase secrets set PUSH_WEBHOOK_SECRET=your_generated_secret
```

**Verify:** `supabase secrets list`

## Step 2: Deploy Edge Function

```bash
cd /path/to/chem-irl
supabase functions deploy push
```

**Verify:** `supabase functions list`

## Step 3: Configure Webhooks

**For each table** (`matches`, `messages`, `proposals`, `confirms`):

1. Supabase Dashboard → Database → Webhooks → Create webhook
2. **Name**: `notify_[table]_created`
3. **Table**: `[table_name]`, **Events**: `INSERT`
4. **URL**: `https://[your-project-ref].supabase.co/functions/v1/push`
5. **Headers**:
   - `x-webhook-secret: [same value as PUSH_WEBHOOK_SECRET]`
   - `Content-Type: application/json`

**⚠️ IMPORTANT**: `x-webhook-secret` header must exactly match `PUSH_WEBHOOK_SECRET`.

## Step 4: Two-Device Force-Quit Tests

### Test 1: Match Push

**Device A:** Sign in, complete onboarding, like Device B  
**Device B:** Force-quit app, wait for "New Match!" notification, tap  
**Verify:** App opens to MatchDetail screen ✅/❌

### Test 2: Message Push

**Device A:** Open chat, send message  
**Device B:** Force-quit app, wait for "New Message" notification, tap  
**Verify:** App opens to Chat screen ✅/❌

### Test 3: Proposal Push

**Device A:** Open match, create proposal (2-3 time windows)  
**Device B:** Force-quit app, wait for "New Date Proposal" notification, tap  
**Verify:** App opens to MatchDetail screen ✅/❌

## Troubleshooting

### No Push Token Registered

**Check:** Notification permissions, `registerDeviceToken()` called, token in `push_tokens` table  
**Fix:** Re-sign in to trigger token registration

### Permission Denied (401)

**Check:** `PUSH_WEBHOOK_SECRET` set, webhook header matches exactly (no extra spaces)  
**Fix:** Regenerate secret and update both edge function and webhook config

### Expo Go Limitations

**Note:** Expo Go may have limited push support. Use EAS dev build or production build for full testing.

### Webhook Not Firing

**Check:** Webhook enabled, table name matches (`matches`, `messages`, `proposals`, `confirms`), event is `INSERT`, URL correct  
**Fix:** Check Supabase Dashboard → Database → Webhooks → Recent deliveries

### Function Logs

**View:** `supabase functions logs push --follow`

**Check for:** 401 errors (secret mismatch), 500 errors (missing env vars), deduplication messages (normal), Expo Push API errors

## Success Criteria

- [ ] All three push tests pass (match, message, proposal)
- [ ] Tap-routing opens correct screens
- [ ] No duplicate notifications (deduplication working)
- [ ] Function logs show successful processing

## Next Steps

After validation passes:

- [ ] Update `test_runs/beta_smoke/[date]_[hash].md` with results
- [ ] Mark exit criteria as PASS/DEGRADED/FAIL
- [ ] Document any issues found
