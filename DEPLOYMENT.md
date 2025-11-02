# Chem IRL Deployment Guide

## Quick Deploy to Vercel (Recommended)

### 1. Prepare Repository
```bash
# Initialize git (if not done)
git init
git add .
git commit -m "Initial commit: Chem IRL MVP"

# Push to GitHub
git remote add origin https://github.com/yourusername/chem-irl.git
git push -u origin main
```

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "New Project"
4. Import your `chem-irl` repository
5. Framework Preset: Next.js
6. Root Directory: `web` (if repo is in parent folder)
7. Click "Deploy"

### 3. Environment Variables
In Vercel Dashboard → Project Settings → Environment Variables:

```bash
# App Configuration
NEXT_PUBLIC_APP_NAME=Chem IRL
NEXT_PUBLIC_DOMAIN=chemirl.app
NEXT_PUBLIC_APP_URL=https://chemirl.app

# Supabase (Get from supabase.com)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe (Get from stripe.com)
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# PostHog (Get from posthog.com)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Email/SMS
POSTMARK_API_TOKEN=your_postmark_token
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### 4. Connect Custom Domain
1. In Vercel Dashboard → Project Settings → Domains
2. Add `chemirl.app`
3. Add `www.chemirl.app`
4. Follow DNS instructions provided by Vercel

### 5. DNS Configuration
Update your domain registrar's DNS settings:

```
Type: A
Name: @
Value: 76.76.19.61

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## Database Setup (Supabase)

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Choose region: Europe (Ireland) for GDPR compliance
4. Note down your project URL and anon key

### 2. Run Database Migrations
In Supabase SQL Editor, run these files in order:
1. `db/schema.sql` - Creates all tables
2. `db/rls.sql` - Sets up Row Level Security
3. `db/kpi_views.sql` - Creates KPI views

### 3. Configure Auth
1. Go to Authentication → Settings
2. Site URL: `https://chemirl.app`
3. Redirect URLs: `https://chemirl.app/auth/callback`
4. Enable email confirmations

## Stripe Setup

### 1. Create Stripe Account
1. Go to [stripe.com](https://stripe.com)
2. Create account and complete verification
3. Get your publishable and secret keys

### 2. Create Products
Create these products in Stripe Dashboard:

**Momentum+ Subscription:**
- Type: Recurring
- Price: €14.99/month
- Billing: Monthly

**Credits Packs:**
- €4.99 → 50 credits
- €9.99 → 120 credits  
- €19.99 → 260 credits

### 3. Webhook Setup
1. Go to Webhooks in Stripe Dashboard
2. Add endpoint: `https://chemirl.app/api/webhooks/stripe`
3. Select events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.updated`

## Monitoring Setup

### 1. PostHog (Analytics)
1. Go to [posthog.com](https://posthog.com)
2. Create project
3. Get project API key
4. Add to environment variables

### 2. Sentry (Error Tracking) - Optional
1. Go to [sentry.io](https://sentry.io)
2. Create Next.js project
3. Get DSN
4. Add to environment variables

## Production Checklist

### Pre-Launch
- [ ] Domain connected and SSL working
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Stripe webhooks configured
- [ ] Email templates tested
- [ ] Analytics tracking working
- [ ] Error monitoring active

### Post-Launch
- [ ] Monitor error rates
- [ ] Check analytics data
- [ ] Test payment flows
- [ ] Verify email delivery
- [ ] Monitor database performance
- [ ] Check security headers

## Cost Estimation (Monthly)

### Vercel (Free Tier)
- Hosting: $0 (up to 100GB bandwidth)
- Custom domain: $0
- SSL: Included

### Supabase (Free Tier)
- Database: $0 (up to 500MB)
- Auth: $0 (up to 50k MAU)
- Storage: $0 (up to 1GB)

### Stripe
- Payment processing: 1.4% + €0.25 per transaction
- No monthly fees

### PostHog (Free Tier)
- Analytics: $0 (up to 1M events/month)

### Total: ~$0-5/month for MVP

## Scaling Considerations

### When to Upgrade
- **Vercel Pro** ($20/month): When you exceed free limits
- **Supabase Pro** ($25/month): When you need more database resources
- **PostHog Paid** ($20/month): When you exceed free event limits

### Performance Monitoring
- Set up Vercel Analytics
- Monitor Core Web Vitals
- Track conversion funnels
- Monitor error rates

## Security Checklist

- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] RLS policies tested
- [ ] API rate limiting
- [ ] Input validation
- [ ] CORS configured
- [ ] CSP headers set




