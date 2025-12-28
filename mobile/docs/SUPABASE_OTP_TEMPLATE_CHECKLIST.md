# Supabase Email OTP Template Configuration Checklist

**Purpose:** Ensure email OTP authentication is code-only (no browser redirects)

**Time:** ~5 minutes

---

## Prerequisites

- [ ] Access to Supabase Dashboard (staging and/or production project)
- [ ] Admin access to Authentication settings
- [ ] **Email confirmation is ENABLED** (see Step 0 below)

---

## Step 0: Enable Email Confirmation (Do This First!)

**CRITICAL:** We use the `auth.email.template.confirmation` template for OTP emails. Email confirmation must be **ENABLED** for this template to be used.

**Steps:**

1. Go to: **Authentication** → **Providers** → **Email**
2. Find **"Enable email confirmations"** toggle
3. **Turn it ON** (enabled)
4. Click **"Save"**

**Important:** We'll configure the confirmation template to be code-only (using `{{ .Token }}`) instead of containing a confirmation link. This way users receive a 6-digit code to enter in the app, not a link to click.

---

## Step 1: Navigate to Email Templates

1. **Open Supabase Dashboard:**
   - Go to your project (staging or production)
   - Navigate to: **Authentication** → **Email Templates**

2. **Select Template:**
   - Click on **"Confirm signup"** template
   - **Note:** This is the `auth.email.template.confirmation` template that we're using for OTP emails

---

## Step 2: Verify Template Content

### ✅ Required Elements

- [ ] **OTP Code Placeholder:**
  - Template includes `{{ .Token }}` placeholder
  - Code will be displayed as a 6-digit number
  - Example: `Your verification code is: {{ .Token }}`

- [ ] **Clear Instructions:**
  - Template instructs user to **enter the code in the app**
  - Example: "Enter this code in the app to verify your email"
  - **DO NOT** say "click the link" or "open this link"

### ❌ Elements to Remove

- [ ] **No Login Links:**
  - Template does NOT include `{{ .SiteURL }}` variable
  - Template does NOT include `{{ .RedirectTo }}` variable
  - Template does NOT include any clickable buttons or links

- [ ] **No Link Instructions:**
  - Template does NOT say "Click here to sign in"
  - Template does NOT say "Open this link"
  - Template does NOT say "Click the button below"

---

## Step 3: Template Example (Correct)

```
Subject: Your Chem IRL verification code

Your verification code is: {{ .Token }}

Enter this code in the app to verify your email.

This code expires in 1 hour.

If you didn't request this code, you can safely ignore this email.
```

**Key Points:**

- ✅ Uses `{{ .Token }}` for the code
- ✅ Instructs to "enter code in app"
- ✅ No links or buttons
- ✅ No `{{ .SiteURL }}` or `{{ .RedirectTo }}`

---

## Step 4: Template Example (INCORRECT - Do Not Use)

```
Subject: Sign in to Chem IRL

Click the link below to sign in:

{{ .SiteURL }}/auth/callback?token={{ .Token }}

Or enter this code: {{ .Token }}
```

**Why This Is Wrong:**

- ❌ Includes `{{ .SiteURL }}` which creates a clickable link
- ❌ Says "Click the link below" (instructs clicking)
- ❌ Creates confusion (should be code-only)

---

## Step 5: Test Email

1. **Save Template:**
   - Click **"Save"** or **"Update"** button
   - Wait for confirmation message

2. **Send Test OTP:**
   - Use the mobile app to request an email OTP
   - Check your email inbox

3. **Verify Email Content:**
   - [ ] Email contains 6-digit code (not a link)
   - [ ] Email instructs to enter code in app
   - [ ] Email does NOT contain any clickable links
   - [ ] Email does NOT mention "click" or "open link"

---

## Step 6: Apply to Both Environments

**Repeat Steps 1-5 for:**

- [ ] **Staging project** (if using separate staging)
- [ ] **Production project**

**Important:** Both environments must use the same code-only template format.

---

## Troubleshooting

### Email Still Contains Links?

**Cause 1: Template Not Saved**

- Verify you clicked "Save" or "Update"
- Check for confirmation message
- Refresh page and verify changes persisted

**Cause 2: Using Wrong Template**

- Ensure you're editing the **"Magic Link"** template
- This is the template used for OTP emails (despite the name)

**Cause 3: Cached Email**

- Old emails may have been sent with previous template
- Request a **fresh** OTP code after template changes
- Check new email (not old ones in inbox)

### Code Not Appearing?

**Cause: Missing Token Placeholder**

- Verify template includes `{{ .Token }}` (exact syntax, with spaces)
- Check for typos: `{{.Token}}` (no spaces) or `{{ Token }}` (wrong) won't work
- Correct format: `{{ .Token }}` (space after `{{`, space before `}}`)

---

## Success Criteria

- [ ] Email template uses `{{ .Token }}` for code
- [ ] Email template does NOT include `{{ .SiteURL }}` or `{{ .RedirectTo }}`
- [ ] Email template instructs user to enter code (not click link)
- [ ] Test email contains only code (no links)
- [ ] Template saved in both staging and production

---

## Related Documentation

- [OTP-Based Authentication Setup](./README.md#otp-based-authentication-setup) - Full auth setup guide
- [Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md) - Staging project configuration

---

**Last Updated:** 2025-12-27
