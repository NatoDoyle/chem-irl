# Mobile App Documentation

This directory contains all documentation for the Chem IRL mobile app.

## Quick Links

### Setup & Installation

- **[Install on Phones](./INSTALL_ON_PHONES.md)** - Step-by-step guide for installing the app on physical devices (Expo Go and EAS dev builds)
- **[Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md)** - How to set up and switch between staging and production Supabase projects
- **Sentry Setup** - See [Sentry Setup](#sentry-setup) section below for error logging configuration

### Testing

- **[Two-Device Test Plan](./TWO_DEVICE_TEST_PLAN.md)** - Comprehensive testing workflow for validating app features with two devices
- **[Test Run Log Template](./TEST_RUN_LOG_TEMPLATE.md)** - Template for recording test sessions

### Release

- **[Release Checklist](./RELEASE_CHECKLIST.md)** - Pre-build verification steps before building for production

### Archive

- **[Archive](./archive/)** - Historical documentation and implementation summaries (for reference only)

## Documentation Structure

```
docs/
├── README.md (this file)
├── INSTALL_ON_PHONES.md
├── SUPABASE_STAGING_SETUP.md
├── TWO_DEVICE_TEST_PLAN.md
├── TEST_RUN_LOG_TEMPLATE.md
├── RELEASE_CHECKLIST.md
└── archive/
    ├── IMPLEMENTATION_SUMMARY.md
    ├── VALIDATION_REPORT.md
    ├── MOBILE_APP_ANALYSIS.md
    ├── PRODUCTION_HARDENING_SUMMARY.md
    ├── RELEASE_AND_RECONCILE_SUMMARY.md
    ├── DEBUG_AND_TESTING_SUMMARY.md
    └── KNOWN_ISSUE_NEW_ARCH.md
```

## Getting Started

1. **First time setup**: See [Install on Phones](./INSTALL_ON_PHONES.md)
2. **Staging environment**: See [Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md)
3. **Testing**: Run `npm run test:two-device` for workflow, then follow [Two-Device Test Plan](./TWO_DEVICE_TEST_PLAN.md)
4. **Before release**: Complete [Release Checklist](./RELEASE_CHECKLIST.md)

## Magic Link Redirect Setup

Magic link authentication uses deep linking to redirect users back into the mobile app after clicking the email link.

### Configuration

1. **Set environment variable** in `.env` or `.env.local`:

   ```bash
   EXPO_PUBLIC_AUTH_REDIRECT_URL=chemirl://auth/callback
   ```

   If not set, the app will fallback to `Linking.createURL('/auth/callback')` which generates the URL based on the app scheme.

2. **Configure Supabase Redirect URLs**:

   Add the following redirect URLs in your Supabase project settings:

   **Staging/Development:**
   - `chemirl://auth/callback`
   - `exp://localhost:8081/--/auth/callback` (for Expo Go)

   **Production:**
   - `chemirl://auth/callback`

   **Where to add:**
   - Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
   - Add each URL on a new line

3. **Verify app scheme** in `app.json`:

   ```json
   {
     "expo": {
       "scheme": "chemirl"
     }
   }
   ```

   The scheme must match the URL scheme used in `EXPO_PUBLIC_AUTH_REDIRECT_URL`.

### Deep Link Handling

The app automatically handles deep links via `App.tsx`:

- Initial URL on app launch: `Linking.getInitialURL()`
- URL changes while app is running: `Linking.addEventListener('url')`
- Both routes to `handleMagicLink()` which extracts tokens and sets the session

### Testing

1. Send a magic link from the login screen
2. Open the email link on a device with the app installed
3. The app should open and authenticate automatically
4. If using Expo Go, use the `exp://` URL format

### Troubleshooting: Still Redirecting to Website

If clicking the magic link still redirects to the website instead of opening the app:

1. **Redirect URL not allowlisted in Supabase:**
   - Go to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs
   - Ensure `chemirl://auth/callback` is added (one per line)
   - For Expo Go development, also add `exp://localhost:8081/--/auth/callback`
   - Save changes and try again

2. **Environment variable not loaded / Metro not restarted:**
   - Verify `EXPO_PUBLIC_AUTH_REDIRECT_URL` is set in `.env` or `.env.local`
   - If using `switchEnv` script, ensure the variable is in `.env.staging` or `.env.production`
   - **Restart Metro bundler** after changing environment variables:
     ```bash
     # Stop current server (Ctrl+C), then:
     npm start
     ```
   - Expo only loads `EXPO_PUBLIC_*` variables at build/start time, not dynamically

## Sentry Setup

Sentry is configured for error logging and crash reporting. It's optional and safe to ignore during local development.

### Configuration

1. **Set EAS secret** (required for source map uploads during builds):

   ```bash
   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <your_sentry_auth_token>
   ```

   Get your auth token from: https://sentry.io/settings/account/api/auth-tokens/

2. **Update `app.json`** with your Sentry organization and project:

   ```json
   [
     "@sentry/react-native/expo",
     {
       "organization": "<YOUR_SENTRY_ORG>",
       "project": "<YOUR_SENTRY_PROJECT>"
     }
   ]
   ```

   Replace `<YOUR_SENTRY_ORG>` and `<YOUR_SENTRY_PROJECT>` with your actual Sentry organization slug and project name.

3. **Set environment variable** (optional, for runtime error capture):
   ```bash
   # In .env or .env.local
   EXPO_PUBLIC_SENTRY_DSN=your_sentry_dsn
   EXPO_PUBLIC_ENVIRONMENT=production
   ```
   Get your DSN from: https://sentry.io/settings/projects/<project>/keys/

### Notes

- **Local development**: Sentry warnings can be safely ignored. The plugin only runs during EAS builds.
- **Source maps**: Automatically uploaded during `eas build` if `SENTRY_AUTH_TOKEN` is set.
- **Runtime errors**: Only captured if `EXPO_PUBLIC_SENTRY_DSN` is set and `EXPO_PUBLIC_ENVIRONMENT=production`.
- **No secrets committed**: Organization/project names in `app.json` are not sensitive (they're visible in your Sentry project URL).
