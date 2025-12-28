# Supabase Dashboard Configuration Checklist

**Purpose:** Exact step-by-step checklist for configuring Supabase dashboard to ensure email OTP is code-only (no browser redirects)

**Time:** ~10 minutes

---

## Prerequisites

- [ ] Access to Supabase Dashboard (staging and/or production project)
- [ ] Admin access to Authentication settings

---

## Checklist: Disable Email Confirmation (CRITICAL)

**Why:** When email confirmation is enabled, Supabase sends a separate "confirmation email" for new signups in addition to the OTP email. This confirmation email typically contains confusing language like "Click here to sign in" or "Sign in to confirm your account" - which doesn't make sense for users who are still in the signup process and haven't finished creating their account yet.

**The Problem:**

When email confirmation is enabled, Supabase sends the **`auth.email.template.confirmation`** email template:

- **Subject:** "Confirm Your Signup" (default)
- **Content:** Contains a confirmation link (not a code)
- **Purpose:** Asks users to click a link to verify their email address
- **When sent:** When a user signs up and needs to verify their email address

This creates confusion because:

- User enters name and email → Requests OTP code
- Supabase sends TWO emails:
  1. ❌ **Confirmation email** (from `confirmation` template) - contains a link, says "click to confirm" or "sign in"
  2. ✅ **OTP code email** (from `magic_link` template) - contains 6-digit code
- User is told to "enter code in app" but receives a link instead!

**The Solution:** Disable email confirmation so only the OTP code email (`magic_link` template) is sent.

### Step 1: Enable Email Confirmation

1. **Navigate to Auth Settings:**
   - Go to: **Authentication** → **Providers**
   - Find **"Email"** in the provider list
   - Click on **"Email"** to expand settings

2. **Enable Email Confirmation:**
   - Find **"Enable email confirmations"** or **"Confirm email"** toggle
   - **Turn it ON** (enabled/checked)
   - Click **"Save"** if prompted

3. **Verify:**
   - [ ] Email confirmation toggle is **ON** (enabled)
   - [ ] The `confirmation` template will be used for signup emails

**Important:** We'll configure the confirmation template to be code-only (see Step 2 below), so it sends a 6-digit code instead of a confirmation link.

---

## Checklist: Email OTP Template Configuration

### Step 2: Navigate to Email Templates

1. **Open Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project (staging or production)

2. **Navigate to Email Templates:**
   - Click: **Authentication** (left sidebar)
   - Click: **Email Templates** (submenu)
   - You should see a list of templates: "Confirm signup", "Magic Link", "Change Email Address", etc.

3. **Select Confirm Signup Template:**
   - Click on **"Confirm signup"** template
   - **Note:** This is the `auth.email.template.confirmation` template that we're using for OTP emails

### Step 2: Verify Template Content

**Subject Line:**

- [ ] Subject should NOT reference "magic link" or "click to sign in"
- [ ] Example: `Your Chem IRL verification code` or `Verify your email`

**Body Content - Required:**

- [ ] Template includes `{{ .Token }}` placeholder (exact syntax with spaces)
- [ ] Template instructs user to **enter code in app** (not click link)
- [ ] Example: "Enter this code in the app to verify your email"

**Body Content - Must Remove:**

- [ ] Template does NOT include `{{ .SiteURL }}` variable
- [ ] Template does NOT include `{{ .RedirectTo }}` variable
- [ ] Template does NOT include any clickable buttons or HTML links
- [ ] Template does NOT say "Click here to sign in"
- [ ] Template does NOT say "Open this link"
- [ ] Template does NOT say "Click the button below"

### Step 3: Template Example (Correct Format)

```
Subject: Your Chem IRL verification code

Your verification code is: {{ .Token }}

Enter this code in the app to verify your email.

This code expires in 1 hour.

If you didn't request this code, you can safely ignore this email.
```

**Key Points:**

- ✅ Uses `{{ .Token }}` for the 6-digit code
- ✅ Instructs to "enter code in app"
- ✅ No links, buttons, or clickable elements
- ✅ No `{{ .SiteURL }}` or `{{ .RedirectTo }}` variables

### Step 4: Save Template

1. **Review Template:**
   - Read through entire template
   - Verify no links or click instructions exist
   - Verify `{{ .Token }}` is present

2. **Save Changes:**
   - Click **"Save"** or **"Update"** button (usually at bottom of page)
   - Wait for confirmation message (e.g., "Template updated successfully")

3. **Verify Save:**
   - Refresh page
   - Verify changes persisted (template still shows code-only format)

### Step 5: Test Email

1. **Request Test OTP:**
   - Use mobile app to request email OTP
   - Enter test email address
   - Tap "Continue" or "Send Code"

2. **Check Email Inbox:**
   - Open email client
   - Find email from Supabase (may be in spam folder)
   - Open email

3. **Verify Email Content:**
   - [ ] Email contains 6-digit code (displayed as plain text)
   - [ ] Email instructs to enter code in app
   - [ ] Email does NOT contain any clickable links
   - [ ] Email does NOT mention "click" or "open link"
   - [ ] Email does NOT redirect to website when opened

### Step 6: Apply to All Environments

**Repeat Steps 1-5 for:**

- [ ] **Staging project** (if using separate staging)
- [ ] **Production project**

**Important:** Both environments must use the same code-only template format.

---

## Checklist: Phone OTP Configuration (Using Twilio Verify)

### Step 1: Create Twilio Account and Verify Service

1. **Create Twilio Account:**
   - Go to: https://www.twilio.com/try-twilio
   - Sign up for a free account
   - Verify your email and phone number

2. **Create Verify Service:**
   - Go to: Twilio Console → **Verify** (in left sidebar)
   - Click **"Create new"** button
   - Give your service a friendly name (e.g., "Chem IRL Phone Verification")
   - Enable the **SMS** channel
   - Click **"Create"**
   - **Copy the Service SID** (starts with `VA...`) - you'll need this for Supabase configuration

3. **Get Twilio Credentials:**
   - In Twilio Console, go to: **Account** → **Account Info** (or click your account name in top right)
   - Copy your **Account SID** (starts with `AC...`)
   - Copy your **Auth Token** (click "View" to reveal, starts with your auth token)
   - **Note:** Keep these credentials secure - never commit them to git

### Step 2: Configure Supabase to Use Twilio Verify

1. **Navigate to Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard
   - Select your project (staging or production)

2. **Enable Phone Provider:**
   - Navigate to: **Authentication** → **Configuration** → **Providers**
   - Find **"Phone"** in the list
   - Toggle **"Phone"** to **ON** (enabled)

3. **Configure Twilio Verify:**
   - In the Phone provider section, find **"SMS Provider"** dropdown
   - Select **"Twilio Verify"** from the dropdown (not "Twilio" - use "Twilio Verify")
   - Enter your **Twilio Account SID** (from Step 1.3)
   - Enter your **Twilio Auth Token** (from Step 1.3)
   - Enter your **Twilio Verify Service SID** (from Step 1.2, starts with `VA...`)
   - Click **"Save"**

4. **Verify Configuration:**
   - Verify the Phone provider toggle is still **ON**
   - Verify all three credentials are saved (they should be masked/obscured)
   - If you see any errors, double-check your credentials

### Step 3: Test Phone Verification

1. **Test from Mobile App:**
   - Open the mobile app
   - Navigate to phone entry screen (signup or login flow)
   - Enter a test phone number (E.164 format: `+1234567890`)
   - Tap "Continue" or "Send Code"

2. **Verify SMS Received:**
   - Check your phone for SMS message
   - SMS should contain a 6-digit verification code
   - Code format is automatically handled by Twilio Verify

3. **Verify Code Entry:**
   - Enter the 6-digit code in the app
   - Code should verify successfully
   - User should be authenticated or phone should be verified

**Note:** Twilio Verify automatically handles SMS template formatting - you don't need to configure a custom SMS template. The code is sent automatically in a standard format.

---

## Verification Checklist

After completing all steps, verify:

- [ ] Email template uses `{{ .Token }}` (not `{{ .SiteURL }}` or `{{ .RedirectTo }}`)
- [ ] Email template instructs user to enter code (not click link)
- [ ] Test email contains only code (no links)
- [ ] Test email does not redirect to website
- [ ] Template saved in both staging and production (if applicable)
- [ ] Phone provider enabled (if using phone auth)
- [ ] SMS template configured with `{{ .Token }}` (if using phone auth)

---

## Troubleshooting

### Email Still Contains Links?

**Check 1: Template Not Saved**

- Verify you clicked "Save" or "Update"
- Check for confirmation message
- Refresh page and verify changes persisted

**Check 2: Using Wrong Template**

- Ensure you're editing the **"Magic Link"** template
- This is the template used for OTP emails (despite the name)

**Check 3: Cached Email**

- Old emails may have been sent with previous template
- Request a **fresh** OTP code after template changes
- Check new email (not old ones in inbox)

### Code Not Appearing in Email?

**Check: Missing Token Placeholder**

- Verify template includes `{{ .Token }}` (exact syntax, with spaces)
- Check for typos: `{{.Token}}` (no spaces) or `{{ Token }}` (wrong) won't work
- Correct format: `{{ .Token }}` (space after `{{`, space before `}}`)

### Email Redirects to Website?

**This should NOT happen with code-only OTP. If it does:**

- Verify template does NOT include `{{ .SiteURL }}` or `{{ .RedirectTo }}`
- Verify template does NOT include any HTML links or buttons
- Request fresh OTP after fixing template
- Check email client is not auto-converting text to links

---

## Related Documentation

- [Supabase OTP Template Checklist](./SUPABASE_OTP_TEMPLATE_CHECKLIST.md) - Detailed template verification guide
- [OTP-Based Authentication Setup](./README.md#otp-based-authentication-setup) - Full auth setup guide
- [Supabase Staging Setup](./SUPABASE_STAGING_SETUP.md) - Staging project configuration

---

**Last Updated:** 2025-12-27
