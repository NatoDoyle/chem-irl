# Environment Variables Quick Reference

## 🚀 Minimum Required (Start Here)

Add these 3 variables first to get your app running:

```
NEXT_PUBLIC_APP_NAME = Chem IRL
NEXT_PUBLIC_DOMAIN = chemirl.app
NEXT_PUBLIC_APP_URL = https://chemirl.app
```

## 📊 Full Setup (Copy-Paste Template)

### In Vercel: Settings → Environment Variables

```
Key: NEXT_PUBLIC_APP_NAME
Value: Chem IRL
Environments: ✅ Production ✅ Preview ✅ Development

Key: NEXT_PUBLIC_DOMAIN
Value: chemirl.app
Environments: ✅ Production ✅ Preview ✅ Development

Key: NEXT_PUBLIC_APP_URL
Value: https://chemirl.app
Environments: ✅ Production ✅ Preview ✅ Development

Key: NEXT_PUBLIC_SUPABASE_URL
Value: [Get from supabase.com → Settings → API]
Environments: ✅ Production ✅ Preview ✅ Development

Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: [Get from supabase.com → Settings → API → anon public]
Environments: ✅ Production ✅ Preview ✅ Development

Key: SUPABASE_SERVICE_ROLE_KEY
Value: [Get from supabase.com → Settings → API → service_role secret]
Environments: ✅ Production ✅ Preview ✅ Development

Key: STRIPE_PUBLISHABLE_KEY
Value: [Get from stripe.com → Developers → API keys → Publishable]
Environments: ✅ Production ✅ Preview ✅ Development

Key: STRIPE_SECRET_KEY
Value: [Get from stripe.com → Developers → API keys → Secret]
Environments: ✅ Production ✅ Preview ✅ Development

Key: STRIPE_WEBHOOK_SECRET
Value: [Get after setting up webhook in Stripe]
Environments: ✅ Production

Key: NEXT_PUBLIC_POSTHOG_KEY
Value: [Get from posthog.com → Project Settings]
Environments: ✅ Production ✅ Preview ✅ Development

Key: NEXT_PUBLIC_POSTHOG_HOST
Value: https://app.posthog.com
Environments: ✅ Production ✅ Preview ✅ Development

Key: POSTMARK_API_TOKEN
Value: [Get from postmarkapp.com → Server → API Tokens]
Environments: ✅ Production ✅ Preview ✅ Development
```

## 🎯 Priority Order

### Phase 1: Get App Running (Now)
1. ✅ App Configuration (3 variables)
2. Deploy to see the landing page

### Phase 2: Core Functionality (Next)
3. ✅ Supabase (database)
4. ✅ Postmark (email)

### Phase 3: Monetization (When Ready)
5. ✅ Stripe (payments)

### Phase 4: Analytics (Optional)
6. ⏸️ PostHog (analytics)
7. ⏸️ Sentry (error tracking)

### Phase 5: Advanced (Later)
8. ⏸️ Twilio (SMS fallback)

## ⚠️ Important Notes

- **Always check all 3 environments** (Production, Preview, Development) when adding variables
- **Never expose** `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` in client code
- **Redeploy** after adding new variables
- Variables with `NEXT_PUBLIC_` prefix are accessible in browser
- Variables without `NEXT_PUBLIC_` are server-side only (API routes)

## 🔗 Where to Get Keys

| Service | URL | Where to Find Keys |
|---------|-----|-------------------|
| Supabase | https://supabase.com | Settings → API |
| Stripe | https://stripe.com | Developers → API keys |
| PostHog | https://posthog.com | Project Settings → API Keys |
| Postmark | https://postmarkapp.com | Servers → API Tokens |
| Twilio | https://twilio.com | Console → Account |
| Sentry | https://sentry.io | Project Settings → Client Keys |
