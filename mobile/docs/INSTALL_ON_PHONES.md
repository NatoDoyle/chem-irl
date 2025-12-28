# Install App on Phones

**Last verified:** 2025-01-28

This guide covers installing the mobile app on physical devices for testing.

## Prerequisites

Before installing on phones, ensure staging environment is set up and verified:

```bash
# 1. Switch to staging environment
npm run use:staging

# 2. Restart Expo dev server (if running)
# Press Ctrl+C to stop, then:
npm start

# 3. Verify staging setup
npm run verify:staging
```

**Important:** The verification script requires a `.env.seed` file with service role key:

```env
SUPABASE_URL=https://your-staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

See [`SUPABASE_STAGING_SETUP.md`](./SUPABASE_STAGING_SETUP.md) for detailed setup instructions.

---

## Option A: Expo Go (Quick Testing)

**Best for:** Quick testing, development, two-device testing with staging

### Steps

1. **Install Expo Go on your phone:**
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start Expo dev server:**

   ```bash
   npm start
   ```

3. **Connect your phone:**
   - **Same WiFi (LAN):** Scan QR code from terminal
   - **Different network:** Use tunnel mode:
     ```bash
     npm start -- --tunnel
     ```

4. **Open in Expo Go:**
   - iOS: Use Camera app to scan QR code
   - Android: Use Expo Go app to scan QR code

### Troubleshooting Expo Go

**"Unable to connect" or "Network request failed":**

- **Try tunnel mode:** `npm start -- --tunnel`
- **Check firewall:** Ensure port 8081 is not blocked
- **Same network:** Ensure phone and computer are on same WiFi (for LAN mode)
- **Restart Expo:** Press `r` in terminal or restart `npm start`

**"Metro bundler error":**

- Clear cache: `npm start -- --clear`
- Check `.env.local` exists and has correct values
- Restart Expo dev server

**App loads but shows errors:**

- Verify `.env.local` has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`
- Check Supabase project is active
- Run `npm run verify:staging` to verify setup

**Deep linking not working:**

- Expo Go supports OTP authentication (code entry in-app)
- No deep linking required for OTP flow
- EAS dev build recommended for production-like testing

---

## Option B: EAS Dev Build (Full Features)

**Best for:** Testing deep linking, production-like experience, features not available in Expo Go

### Prerequisites

- EAS CLI installed: `npm install -g eas-cli`
- EAS account: `eas login`
- Apple Developer account (for iOS) or Google Play account (for Android)

### Build Profiles

This repo uses the following EAS build profiles (from `eas.json`):

- **`development`** - Dev build with development client
  - iOS: Device build (no simulator)
  - Android: APK
  - Distribution: Internal

- **`preview`** - Preview build for testing
  - iOS: Device build (no simulator)
  - Android: APK
  - Distribution: Internal

- **`production`** - Production build
  - iOS: Device build (no simulator)
  - Android: APK

### Steps

1. **Build development client:**

   ```bash
   # For iOS
   eas build --profile development --platform ios

   # For Android
   eas build --profile development --platform android
   ```

2. **Install on device:**
   - **iOS:** Download from EAS build page, install via TestFlight or direct install
   - **Android:** Download APK from EAS build page, install on device

3. **Start Expo dev server:**

   ```bash
   npm start
   ```

4. **Connect dev client:**
   - Dev client will automatically connect to Expo dev server
   - Or scan QR code from terminal

### Benefits of Dev Build

- ✅ Full OTP authentication support (email + phone SMS)
- ✅ Native modules work (e.g., Sentry, image picker)
- ✅ Production-like performance
- ✅ Can test on physical devices without Expo Go limitations

### Troubleshooting Dev Build

**Build fails:**

- Check `eas.json` profile configuration
- Verify credentials: `eas credentials`
- Check EAS build logs for specific errors

**App won't connect to dev server:**

- Ensure phone and computer are on same network (or use tunnel)
- Check firewall settings
- Verify Expo dev server is running

**OTP codes not working:**

- Verify Supabase email template uses `{{ .Token }}` (not `{{ .SiteURL }}` or `{{ .RedirectTo }}`)
- Check email template instructs user to enter code (not click link)
- Verify phone provider is enabled in Supabase Dashboard
- Check SMS provider credentials are correct

---

## Gotchas

### Email OTP Template Configuration

**Required:** Email template must be code-only (no links)

**Configuration:**

- **Supabase Dashboard:** Authentication → Email Templates → Magic Link template
- **Template must include:** `{{ .Token }}` for OTP code
- **Template must NOT include:** `{{ .SiteURL }}`, `{{ .RedirectTo }}`, or any clickable links
- **Template should say:** "Enter this code in the app" (not "Click this link")

**Why it matters:**

- OTP emails must contain only the code (no browser redirects)
- Users enter codes directly in the app
- See [Supabase OTP Template Checklist](./SUPABASE_OTP_TEMPLATE_CHECKLIST.md) for detailed instructions

### Environment Variables Only Load on Expo Restart

**Important:** After changing `.env.local` or switching environments:

1. **Stop Expo dev server:** Press `Ctrl+C`
2. **Restart:** `npm start`
3. **Reload app:** Shake device → "Reload" (or press `r` in terminal)

**Why:** Expo inlines `EXPO_PUBLIC_*` variables at build/start time. Changes require restart.

### Never Use Service Role Keys in EXPO_PUBLIC Env Vars

**⚠️ CRITICAL SECURITY WARNING:**

- **NEVER** put `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or any `EXPO_PUBLIC_*` variable
- Service role keys bypass Row Level Security (RLS)
- They must only be used in server-side code or local verification scripts
- Use service role key only in `.env.seed` (gitignored) for `npm run verify:staging`

**Correct:**

```env
# .env.local (safe to commit template)
EXPO_PUBLIC_SUPABASE_URL=https://project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=anon_publishable_key_here
```

**Wrong:**

```env
# NEVER DO THIS
EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=service_role_key_here
```

### Two-Device Testing Requirements

For two-device testing (see [`TWO_DEVICE_TEST_PLAN.md`](./TWO_DEVICE_TEST_PLAN.md)):

- Both devices must be on staging environment
- Both devices need separate test accounts
- Use Gmail plus-addressing: `your.email+userA@gmail.com` and `your.email+userB@gmail.com`
- Ensure both devices can reach Supabase (same network or tunnel mode)

---

## Quick Reference

### Switch to Staging

```bash
npm run use:staging
npm start  # Restart required
```

### Switch to Production

```bash
npm run use:production
npm start  # Restart required
```

### Verify Staging Setup

```bash
npm run verify:staging
```

### Start Expo (LAN mode)

```bash
npm start
```

### Start Expo (Tunnel mode)

```bash
npm start -- --tunnel
```

### Build Dev Client (iOS)

```bash
eas build --profile development --platform ios
```

### Build Dev Client (Android)

```bash
eas build --profile development --platform android
```

---

## Next Steps

After installing on phones:

1. **Run two-device test plan:** See [`TWO_DEVICE_TEST_PLAN.md`](./TWO_DEVICE_TEST_PLAN.md)
2. **Record test results:** Use [`TEST_RUN_LOG_TEMPLATE.md`](./TEST_RUN_LOG_TEMPLATE.md)
3. **Verify staging parity:** Run `npm run verify:staging` before each test session
