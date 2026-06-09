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
    ├── CURRENT_ASSESSMENT.md
    ├── MOBILE_APP_ASSESSMENT.md
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
3. **Testing**: Run `bun run test:two-device` for workflow, then follow [Two-Device Test Plan](./TWO_DEVICE_TEST_PLAN.md)
4. **Before release**: Complete [Release Checklist](./RELEASE_CHECKLIST.md)

## Email OTP Authentication Setup

The app uses email OTP only for authentication. Users enter verification codes directly in the app (no browser redirects or magic links).

### Supabase Configuration

1. **Enable Email Confirmation (Required):**
   - Go to Supabase Dashboard → Authentication → Providers → Email
   - Turn ON "Enable email confirmations" toggle
   - We use the confirmation template for OTP emails (configured to be code-only)

2. **Configure Email OTP Template:**
   - Go to Supabase Dashboard → Authentication → Email Templates
   - Edit the **"Confirm signup"** template (this is the `confirmation` template used for OTP emails)
   - **IMPORTANT:** The template must include `{{ .Token }}` to display the 6-digit OTP code
   - **CRITICAL:** Remove any default confirmation links - do NOT include `{{ .SiteURL }}` / `{{ .RedirectTo }}` / `{{ .ConfirmationURL }}` variables
   - **CRITICAL:** The email should contain ONLY the OTP code, not a clickable link
   - Example template:

     ```
     Your verification code is: {{ .Token }}

     Enter this code in the app to verify your email.

     This code expires in 1 hour.
     ```

   - The code should be displayed as plain text, not as a clickable link
   - Users enter the code directly in the app - no browser redirects
   - **See [Supabase OTP Template Checklist](./SUPABASE_OTP_TEMPLATE_CHECKLIST.md) for detailed step-by-step instructions**

### Database Migrations

Run both migrations in order:

```bash
# 1. Add full_name and signup_completed columns
psql -h your-db-host -U postgres -d your-db-name -f db/auth_otp_migration.sql

# 2. Create trigger to auto-create profiles rows for new auth users
psql -h your-db-host -U postgres -d your-db-name -f db/profiles_auto_create_trigger.sql
```

**Migration 1** adds:

- `full_name` column to `profiles` table
- `signup_completed` boolean flag to `profiles` table

**Migration 2** creates:

- Database trigger that automatically creates `users` and `profiles` rows when a new auth user is created
- Ensures every authenticated user has a corresponding profile row

### Authentication Flow

**Sign Up:**

1. User enters full name and email → receives 6-digit code via email
2. User enters code → email verified → signup completed (full_name and signup_completed stored)
3. User proceeds to onboarding (profile completion flow)

**Log In:**

1. User enters email → receives 6-digit code via email
2. User enters code → authenticated
3. App routes based on signup_completed and profile completion status

### Testing

1. Test email OTP signup: Enter name and email, check inbox for code, enter code
2. Test email OTP login: Enter email, check inbox for code, enter code
3. Verify codes are 6 digits and work correctly
4. Verify signup_completed is set to true after successful signup

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
