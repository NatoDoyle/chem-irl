# Vercel Environment Variables Setup Guide

## How to Add Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** (top menu)
3. Click **Environment Variables** (left sidebar)
4. Add each variable below, then click **Save**
5. After adding all variables, **redeploy** your project

---

## Required Variables (Must Have)

### App Configuration
These are required for the app to work properly:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `NEXT_PUBLIC_APP_NAME` | `Chem IRL` | Your app name |
| `NEXT_PUBLIC_DOMAIN` | `chemirl.app` | Your domain |
| `NEXT_PUBLIC_APP_URL` | `https://chemirl.app` | Full app URL |

**Add these now** - they're needed immediately!

---

## Database (Supabase) - Required

You'll need to create a Supabase project first at https://supabase.com

| Variable Name | Where to Find | Description |
|--------------|---------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → Project API keys → `anon` `public` | Public anon key (safe for client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Project API keys → `service_role` `secret` | **KEEP SECRET** - Server-side only |

**⚠️ Important**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS - never expose it in client-side code!

### How to Get Supabase Keys:
1. Go to https://supabase.com and create a project
2. Wait for project to finish setting up (~2 minutes)
3. Go to Settings → API
4. Copy the values from the table above

---

## Payments (Stripe) - Required for Monetization

You'll need to create a Stripe account first at https://stripe.com

| Variable Name | Where to Find | Description |
|--------------|---------------|-------------|
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys → Publishable key | Public key (starts with `pk_`) |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key | **KEEP SECRET** - Server-side only (starts with `sk_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Developers → Webhooks → Add endpoint → Copy signing secret | Used to verify webhook requests |

### How to Get Stripe Keys:
1. Go to https://stripe.com and create an account
2. Complete business verification (can take a few days)
3. Go to Developers → API keys
4. Copy the publishable and secret keys
5. For webhooks: Go to Developers → Webhooks → Add endpoint
   - URL: `https://chemirl.app/api/webhooks/stripe` (after deployment)
   - Events to listen: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`

**Note**: Use test mode keys during development, live keys for production.

---

## Analytics (PostHog) - Optional but Recommended

| Variable Name | Where to Find | Description |
|--------------|---------------|-------------|
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog Dashboard → Project Settings → Project API Key | Your PostHog project key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://app.posthog.com` | PostHog host (or self-hosted URL) |

### How to Get PostHog Keys:
1. Go to https://posthog.com and sign up
2. Create a new project
3. Go to Project Settings → API Keys
4. Copy the Project API Key

**Free tier**: 1M events/month - perfect for MVP!

---

## Email (Postmark) - Required for Notifications

| Variable Name | Where to Find | Description |
|--------------|---------------|-------------|
| `POSTMARK_API_TOKEN` | Postmark Dashboard → API Tokens → Server API Token | Server API token |

### How to Get Postmark Token:
1. Go to https://postmarkapp.com and sign up
2. Create a new server
3. Go to API Tokens
4. Copy the Server API Token

**Free tier**: 100 emails/month, then $15/month for 10k emails

**Alternative**: Use AWS SES (cheaper) - we can set that up later.

---

## SMS (Twilio) - Optional (Fallback Only)

| Variable Name | Where to Find | Description |
|--------------|---------------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account → Account SID | Your Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account → Auth Token | **KEEP SECRET** - Your Twilio auth token |

### How to Get Twilio Keys:
1. Go to https://twilio.com and sign up
2. Verify your phone number
3. Go to Console → Account
4. Copy Account SID and Auth Token

**Note**: SMS is only used as a fallback when email fails. Can skip for MVP.

---

## Error Tracking (Sentry) - Optional

| Variable Name | Where to Find | Description |
|--------------|---------------|-------------|
| `SENTRY_DSN` | Sentry Dashboard → Project Settings → Client Keys (DSN) | Your Sentry DSN |

### How to Get Sentry DSN:
1. Go to https://sentry.io and sign up
2. Create a new Next.js project
3. Go to Project Settings → Client Keys (DSN)
4. Copy the DSN

**Free tier**: 5k events/month - good for MVP

---

## Quick Setup Checklist

### For Initial Deployment (Minimal):
✅ `NEXT_PUBLIC_APP_NAME` = `Chem IRL`
✅ `NEXT_PUBLIC_DOMAIN` = `chemirl.app`
✅ `NEXT_PUBLIC_APP_URL` = `https://chemirl.app`

### For Full Functionality (Recommended):
✅ All App Configuration variables
✅ Supabase variables (database)
✅ Stripe variables (payments)
✅ PostHog variables (analytics)
✅ Postmark token (email)

### Nice to Have (Can add later):
⏸️ Twilio variables (SMS fallback)
⏸️ Sentry DSN (error tracking)

---

## Step-by-Step Guide

### Step 1: Add App Config Variables
```
1. Go to Vercel → Settings → Environment Variables
2. Click "Add New"
3. Key: NEXT_PUBLIC_APP_NAME
4. Value: Chem IRL
5. Environment: Production, Preview, Development (check all)
6. Click "Save"
7. Repeat for NEXT_PUBLIC_DOMAIN and NEXT_PUBLIC_APP_URL
```

### Step 2: Set Up Supabase
```
1. Create Supabase project at supabase.com
2. Wait for setup to complete
3. Copy API keys from Settings → API
4. Add to Vercel as shown above
```

### Step 3: Set Up Stripe
```
1. Create Stripe account at stripe.com
2. Complete verification
3. Get API keys from Developers → API keys
4. Add to Vercel
5. Set up webhook later (after first deployment)
```

### Step 4: Set Up PostHog (Optional)
```
1. Create PostHog account at posthog.com
2. Create project
3. Get API key from Project Settings
4. Add to Vercel
```

### Step 5: Redeploy
```
After adding all variables:
1. Go to Vercel → Deployments
2. Click the three dots on latest deployment
3. Click "Redeploy"
```

---

## Environment-Specific Variables

Vercel allows you to set different values for different environments:

- **Production**: Live site at chemirl.app
- **Preview**: Branch deployments (e.g., staging)
- **Development**: Local development (can use `.env.local`)

**Recommendation**: 
- Set Production variables for live site
- Set Preview variables for testing
- Use `.env.local` for development (never commit this!)

---

## Security Best Practices

1. ✅ **Never commit** `.env.local` to GitHub
2. ✅ **Always use** `NEXT_PUBLIC_` prefix for client-side variables
3. ✅ **Never expose** secret keys in client-side code
4. ✅ **Rotate keys** if exposed
5. ✅ **Use different keys** for test and production

---

## Troubleshooting

### Variables not working?
- Make sure you redeployed after adding variables
- Check variable names match exactly (case-sensitive)
- Verify you're using `NEXT_PUBLIC_` prefix for client-side vars

### Build failing?
- Check all required variables are set
- Verify no typos in variable names
- Check Vercel build logs for specific errors

### Can't see variables in app?
- Client-side variables need `NEXT_PUBLIC_` prefix
- Server-side variables only available in API routes
- Restart dev server after adding local variables

---

## Quick Copy-Paste for Vercel

Once you have your keys, here's the format for each variable:

```
NEXT_PUBLIC_APP_NAME
Chem IRL

NEXT_PUBLIC_DOMAIN
chemirl.app

NEXT_PUBLIC_APP_URL
https://chemirl.app

NEXT_PUBLIC_SUPABASE_URL
https://your-project.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY
your-anon-key-here

SUPABASE_SERVICE_ROLE_KEY
your-service-role-key-here

STRIPE_PUBLISHABLE_KEY
pk_live_...

STRIPE_SECRET_KEY
sk_live_...

STRIPE_WEBHOOK_SECRET
whsec_...

NEXT_PUBLIC_POSTHOG_KEY
phc_...

NEXT_PUBLIC_POSTHOG_HOST
https://app.posthog.com

POSTMARK_API_TOKEN
your-postmark-token

TWILIO_ACCOUNT_SID
AC...

TWILIO_AUTH_TOKEN
your-twilio-auth-token

SENTRY_DSN
https://...@sentry.io/...
```

---

## Need Help?

If you're stuck:
1. Check Vercel deployment logs
2. Verify all keys are correct
3. Make sure services are set up (Supabase, Stripe, etc.)
4. Try redeploying after adding variables
