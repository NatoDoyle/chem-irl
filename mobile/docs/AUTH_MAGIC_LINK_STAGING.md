# Auth Magic Link: Staging Checklist

**Purpose:** Verify magic link authentication deep-links into the mobile app instead of redirecting to the website.

**Time:** ~5 minutes

---

## Prerequisites

- [ ] Staging Supabase project created and configured
- [ ] Mobile app configured for staging (`npm run use:staging` completed)
- [ ] Two test devices with app installed (Expo Go or EAS dev build)
- [ ] Two test accounts ready

---

## Step 1: Configure Supabase Redirect URLs

1. **Open Supabase Dashboard:**
   - Navigate to your **staging** project
   - Go to: **Authentication** → **URL Configuration** → **Redirect URLs**

2. **Add redirect URLs** (one per line):

   ```
   chemirl://auth/callback
   exp://localhost:8081/--/auth/callback
   ```

   - `chemirl://auth/callback` - For production builds and EAS dev builds
   - `exp://localhost:8081/--/auth/callback` - For Expo Go development

3. **Save changes**

---

## Step 2: Verify Local Environment

1. **Switch to staging environment:**

   ```bash
   cd mobile
   npm run use:staging
   ```

2. **Verify environment variable is set:**

   ```bash
   # Check .env.local (created by switchEnv script)
   cat .env.local | grep EXPO_PUBLIC_AUTH_REDIRECT_URL
   ```

   Should show: `EXPO_PUBLIC_AUTH_REDIRECT_URL=chemirl://auth/callback`

3. **If missing, add it manually:**
   ```bash
   echo "EXPO_PUBLIC_AUTH_REDIRECT_URL=chemirl://auth/callback" >> .env.local
   ```

---

## Step 3: Restart Metro with Cache Clear

**⚠️ IMPORTANT:** Expo only loads `EXPO_PUBLIC_*` variables at startup. You must restart Metro after changing environment variables.

```bash
# Stop current Metro server (Ctrl+C if running)

# Start with cache clear to ensure fresh environment
npm start -- --clear
```

**Verify:** Check Metro output for:

```
env: load .env.local
env: export EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_KEY EXPO_PUBLIC_AUTH_REDIRECT_URL
```

---

## Step 4: Test Magic Link Flow

### Device A (Test Account A)

1. **Open app** on Device A
2. **Navigate to Login screen**
3. **Enter email** (e.g., `test+userA@example.com`)
4. **Tap "Send Magic Link"**
5. **Check email** for magic link

### Device A: Verify Deep Link

1. **Tap magic link in email**
2. **Expected:** App opens automatically (not browser/website)
3. **Expected:** User is authenticated and sees main app or onboarding
4. **If redirects to website:** See Troubleshooting below

---

## Troubleshooting

### Still Redirecting to Website?

**Cause 1: Redirect URL not allowlisted**

- **Check:** Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
- **Verify:** `chemirl://auth/callback` is listed (exact match, no trailing slash)
- **Fix:** Add URL, save, wait 1-2 minutes for propagation, request **fresh** magic link

**Cause 2: Environment variable not loaded**

- **Check:** `.env.local` contains `EXPO_PUBLIC_AUTH_REDIRECT_URL=chemirl://auth/callback`
- **Check:** Metro output shows `env: export ... EXPO_PUBLIC_AUTH_REDIRECT_URL`
- **Fix:** Restart Metro with `npm start -- --clear`

**Cause 3: Using old magic link**

- **Issue:** Old magic links may have been generated with different redirect URL
- **Fix:** Request a **fresh** magic link after making changes

**Cause 4: App scheme mismatch**

- **Check:** `app.json` has `"scheme": "chemirl"`
- **Check:** `EXPO_PUBLIC_AUTH_REDIRECT_URL` uses same scheme (`chemirl://`)
- **Fix:** Ensure scheme matches in both places

---

## Success Criteria

- [ ] Magic link opens app (not browser)
- [ ] User is authenticated automatically
- [ ] No manual token copy/paste required
- [ ] Works on both Expo Go and EAS dev builds

---

## Next Steps

After verification passes:

- [ ] Document any issues in test run log
- [ ] Proceed with two-device testing workflow
- [ ] See [Two-Device Test Plan](./TWO_DEVICE_TEST_PLAN.md) for complete testing

---

**Related Docs:**

- [Magic Link Redirect Setup](./README.md#magic-link-redirect-setup) - Full configuration guide
- [Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md) - Staging project setup
- [Install on Phones](./INSTALL_ON_PHONES.md) - App installation guide
