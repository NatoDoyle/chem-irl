# Chem IRL Deployment Checklist

Use this checklist when deploying to production.

## Pre-Deployment

### Code Quality
- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` succeeds
- [ ] All TypeScript errors resolved
- [ ] No console errors in browser
- [ ] All TODO comments addressed or documented

### Database
- [ ] All migrations tested in staging
- [ ] `db/schema.sql` run in production Supabase
- [ ] `db/rls.sql` run in production Supabase
- [ ] `db/kpi_views.sql` run in production Supabase
- [ ] `db/scoring.sql` run in production Supabase
- [ ] Realtime enabled for `messages` table
- [ ] Indexes verified for performance

### Environment Variables (Vercel)
- [ ] `NEXT_PUBLIC_APP_URL` = `https://chemirl.app`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = Production Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Production anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = Production service role key
- [ ] `POSTMARK_API_TOKEN` = Production Postmark token
- [ ] `POSTMARK_FROM_EMAIL` = Verified sender email
- [ ] `STRIPE_SECRET_KEY` = Production Stripe secret key
- [ ] `STRIPE_PUBLISHABLE_KEY` = Production Stripe publishable key
- [ ] `STRIPE_WEBHOOK_SECRET` = Production webhook secret
- [ ] `STRIPE_MOMENTUM_PLUS_PRICE_ID` = Production price ID
- [ ] `STRIPE_CREDITS_50_PRICE_ID` = Production price ID
- [ ] `STRIPE_CREDITS_120_PRICE_ID` = Production price ID
- [ ] `STRIPE_CREDITS_260_PRICE_ID` = Production price ID
- [ ] `CRON_SECRET` = Random secure string
- [ ] `NEXT_PUBLIC_POSTHOG_KEY` = Production PostHog key (optional)
- [ ] `NEXT_PUBLIC_POSTHOG_HOST` = `https://app.posthog.com`

### Domain & SSL
- [ ] Domain `chemirl.app` connected in Vercel
- [ ] DNS records configured in Cloudflare
- [ ] SSL certificate active (automatic with Vercel)
- [ ] HTTPS redirect working
- [ ] `www` subdomain redirects to root

### Supabase Production
- [ ] Production project created
- [ ] Region: Europe (Ireland) for GDPR
- [ ] Auth settings configured:
  - [ ] Site URL: `https://chemirl.app`
  - [ ] Redirect URLs: `https://chemirl.app/auth/callback`
- [ ] Email templates configured
- [ ] Storage buckets created (if needed)

### Stripe Production
- [ ] Production account activated
- [ ] Products created:
  - [ ] Momentum+ subscription (€14.99/mo)
  - [ ] 50 Credits pack (€4.99)
  - [ ] 120 Credits pack (€9.99)
  - [ ] 260 Credits pack (€19.99)
### Stripe Webhooks (Deferred)
- ⚠️ Webhook handlers are NOT implemented (deferred until needed)
- When needed, implement as:
  - Supabase Edge Function, OR
  - External serverless function (Vercel, AWS Lambda, etc.)
- Required events:
  - `checkout.session.completed` - Process payments
  - `invoice.payment_succeeded` - Handle subscription renewals
  - `customer.subscription.updated` - Update subscription status

### Postmark
- [ ] Production server created
- [ ] Sender signature verified
- [ ] Domain verified (if using custom domain)
- [ ] API token copied to Vercel

### Cron Jobs (Deferred)
- ⚠️ Cron jobs are NOT implemented (deferred until needed)
- When needed, implement as:
  - Supabase Edge Functions scheduled via pg_cron, OR
  - External serverless functions (Vercel Cron, AWS Lambda, etc.)
- Required jobs:
  - Daily scoring: Call `update_daily_action_speed()` function
  - Proposal expiry: Update expired proposals status
  - Email reminders: Send proposal/confirm reminders

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Production deployment"
   git push origin main
   ```

2. **Vercel Deployment**
   - [ ] Automatic deployment triggered
   - [ ] Build succeeds
   - [ ] Preview deployment tested
   - [ ] Production deployment promoted

3. **Verify Deployment**
   - [ ] Site loads at `https://chemirl.app`
   - [ ] Health check: `https://chemirl.app/api/health`
   - [ ] Login flow works
   - [ ] Magic link emails received

## Post-Deployment Verification

### Core Flows
- [ ] Sign up with new email
- [ ] Complete onboarding
- [ ] View discovery feed
- [ ] Like someone
- [ ] Create proposal
- [ ] Confirm proposal
- [ ] Send chat message
- [ ] Report user
- [ ] Block user

### Email
- [ ] Magic link emails delivered
- [ ] Proposal reminder emails sent
- [ ] Confirm reminder emails sent
- [ ] Emails render correctly

### Payments
- [ ] Stripe Checkout opens
- [ ] Test payment succeeds
- [ ] Webhook receives events
- [ ] Credits added to account
- [ ] Subscription recorded

### Performance
- [ ] Page load times < 3s
- [ ] API response times < 500ms
- [ ] No database query timeouts
- [ ] Realtime connections stable

### Security
- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] RLS policies working
- [ ] No sensitive data in logs
- [ ] API rate limiting active

### Monitoring
- [ ] Vercel Analytics active
- [ ] PostHog tracking events
- [ ] Error monitoring (Sentry) active
- [ ] Database logs accessible
- [ ] Postmark delivery logs checked

## Rollback Plan

If issues occur:

1. **Immediate Rollback**
   - [ ] Revert to previous Git commit
   - [ ] Redeploy in Vercel
   - [ ] Verify site restored

2. **Database Rollback**
   - [ ] Restore from backup if needed
   - [ ] Revert migrations if necessary
   - [ ] Document changes

3. **Communication**
   - [ ] Notify users if downtime
   - [ ] Update status page
   - [ ] Post-mortem after resolution

## Launch Day

- [ ] All pre-deployment checks complete
- [ ] Team notified of launch
- [ ] Monitoring dashboards open
- [ ] Support channels ready
- [ ] Backup plan ready
- [ ] Launch announcement prepared

## Post-Launch (First 24h)

- [ ] Monitor error rates
- [ ] Check user signups
- [ ] Verify email delivery
- [ ] Test payment flows
- [ ] Review user feedback
- [ ] Check database performance
- [ ] Monitor costs (stay under €200/mo)

## Success Metrics (Week 1)

Track these in PostHog/database:
- [ ] Signups per day
- [ ] Onboarding completion rate
- [ ] Discovery feed views
- [ ] Likes sent
- [ ] Matches created
- [ ] Proposals sent
- [ ] Confirms received
- [ ] Chat messages sent
- [ ] Error rate < 1%
- [ ] Page load time < 3s



