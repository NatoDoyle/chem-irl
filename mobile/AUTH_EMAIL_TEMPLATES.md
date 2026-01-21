# Email Authentication Templates

## Overview

The mobile app uses **OTP (One-Time Password) authentication** via email. Both signup and login flows use a 6-digit numeric code sent via email. This requires specific Supabase email template configuration.

## Supabase Dashboard Configuration

### Required Changes

Both email templates must be updated to use OTP codes instead of magic links:

1. **"Confirm signup" template** (Authentication → Email Templates → Confirm signup)
2. **"Magic Link" template** (Authentication → Email Templates → Magic Link)

### Template Requirements

For **both templates**, make the following changes:

1. **Include the OTP code:**

   ```
   {{ .Token }}
   ```

   This displays the 6-digit numeric code.

2. **Remove magic link URLs:**
   - **DO NOT** include `{{ .ConfirmationURL }}` anywhere in the template
   - **DO NOT** include any clickable links or buttons

3. **Template content:**
   - Copy can differ between signup and login templates (e.g., "Welcome! Use this code to verify your account" vs "Use this code to sign in")
   - Both must clearly display the 6-digit code
   - Both should instruct the user to enter the code in the app

### Example Template Structure

```
Subject: Your verification code

Your verification code is: {{ .Token }}

Enter this 6-digit code in the app to verify your email.

This code will expire in 10 minutes.
```

Or for signup:

```
Subject: Verify your account

Welcome! Use this code to verify your account: {{ .Token }}

Enter this 6-digit code in the app to complete signup.

This code will expire in 10 minutes.
```

## Technical Details

### How Supabase Distinguishes OTP vs Magic Link

Supabase determines whether to send OTP or magic link based on template variables:

- **OTP mode:** Uses `{{ .Token }}` in template → Supabase sends numeric code
- **Magic link mode:** Uses `{{ .ConfirmationURL }}` in template → Supabase sends clickable link

**Important:** Even though the template is called "Magic Link", if you only use `{{ .Token }}` and omit `{{ .ConfirmationURL }}`, Supabase will send an OTP code.

### Mobile App Implementation

The mobile app uses:

- **`supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true/false }})`**
  - `shouldCreateUser: true` for signup (uses "Confirm signup" template)
  - `shouldCreateUser: false` for login (uses "Magic Link" template)

- **`supabase.auth.verifyOtp({ email, token, type: 'email' })`**
  - Always uses `type: 'email'` (not `'signup'` or `'magiclink'`)
  - Token is normalized to 6-digit numeric code (`token.replace(/\D/g, '').slice(0, 6)`)

### Code Invalidation

**Important:** When a user requests a new code (resend), Supabase **invalidates the previous code**. Only the most recent code will work.

- User requests code → Receives code `123456`
- User requests resend → Receives new code `789012`
- Old code `123456` is now **invalid**
- Only new code `789012` will work

This is why the app shows a message when resending: "Use the most recent code; older codes won't work."

### Throttling

Supabase has default rate limiting for OTP requests:

- **Recommendation:** Throttle resend requests to ~60 seconds between attempts
- This matches Supabase's default throttling guidance and prevents abuse

## Verification Checklist

After updating templates in Supabase Dashboard:

- [ ] Both "Confirm signup" and "Magic Link" templates use `{{ .Token }}`
- [ ] Both templates **do NOT** include `{{ .ConfirmationURL }}`
- [ ] Both templates clearly display the 6-digit code
- [ ] Test signup flow: receive code, enter in app, verify works
- [ ] Test login flow: receive code, enter in app, verify works
- [ ] Test resend: old code rejected, new code accepted

## Troubleshooting

**Problem:** Users receive links instead of codes

- **Solution:** Remove `{{ .ConfirmationURL }}` from templates

**Problem:** Users report "invalid token" after resend

- **Expected behavior:** Old codes are invalidated when new code is sent
- **Solution:** Ensure app shows message about using most recent code

**Problem:** Template shows code but user can't verify

- **Check:** Template should use `{{ .Token }}` (with capital T)
- **Check:** App should normalize token (remove non-digits, limit to 6 digits)
- **Check:** App should use `type: 'email'` in `verifyOtp()` call
