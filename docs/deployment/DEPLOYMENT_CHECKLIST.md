# Chem IRL Deployment Checklist

Use this checklist when deploying to production.

## Pre-Deployment

### 0) Release hygiene (required)
- [ ] Tag the release commit before deploying:
  - [ ] `git tag -a prod-YYYYMMDD -m "prod deploy"`
  - [ ] `git push --tags`
- [ ] Confirm staging and production Supabase projects exist and are clearly labeled
- [ ] Confirm you have a rollback path for database function changes (see Rollback Plan)

### 1) Code Quality (required)
#### Web (Next.js)
- [ ] `bun run lint` passes with no errors
- [ ] `bun run build` succeeds
- [ ] All TypeScript errors resolved
- [ ] No console errors in browser
- [ ] All TODO comments addressed or explicitly documented

#### Mobile (Expo / React Native)
- [ ] App builds/runs locally
- [ ] TypeScript check passes (`bun run type-check`, or `bunx tsc --noEmit` if no repo script)
- [ ] No redbox/runtime errors on critical flows (auth → onboarding → discover → like/match → proposal → chat)

### 2) Database (BLOCKING: staging → production)
#### 2.1 Staging dry-run (required)
- [ ] Apply SQL in staging (in this order):
  - [ ] Apply SQL exactly in the order listed here (this checklist is the source of truth).
  - [ ] `db/schema.sql`
  - [ ] `db/rls.sql`
  - [ ] `db/kpi_views.sql`
  - [ ] `db/scoring.sql`
  - [ ] `db/security_fixes.sql`  ✅ BLOCKING
  - [ ] `db/automation.sql`      ✅ BLOCKING
- [ ] Realtime enabled for `messages` table
- [ ] Indexes verified for performance

#### 2.2 Security verification (required)
- [ ] Confirm SECURITY DEFINER function hardening is applied (per `SECURITY_AUDIT.md`)
- [ ] Confirm RLS policies behave as expected for:
  - [ ] profiles
  - [ ] likes/matches
  - [ ] proposals/confirms
  - [ ] messages
- [ ] Confirm no cross-user reads/writes are possible via RPC paths intended to be scoped

#### 2.3 Automation verification (required)
- [ ] Confirm the scheduling mechanism used by `db/automation.sql` is enabled and jobs are visible in the appropriate place:
  - [ ] If using `pg_cron`:
    - [ ] `SELECT * FROM pg_extension WHERE extname = 'pg_cron';`
    - [ ] `SELECT * FROM cron.job;` (confirm the expected jobs exist)
  - [ ] If using Scheduled Edge Functions:
    - [ ] Confirm the schedules exist in the Supabase Dashboard (Edge Functions → Schedules)
- [ ] Confirm proposal expiry is enforced server-side (not only UI):
  - [ ] Create a test proposal, set `expires_at` into the past, verify it becomes expired after the automation run
- [ ] Confirm daily scoring runs server-side:
  - [ ] Run the manual test queries from `AUTOMATION.md`

#### 2.4 Production apply (required)
- [ ] Take a production DB backup/snapshot (or confirm your backup process)
- [ ] Apply SQL in production (same order as staging):
  - [ ] `db/schema.sql`
  - [ ] `db/rls.sql`
  - [ ] `db/kpi_views.sql`
  - [ ] `db/scoring.sql`
  - [ ] `db/security_fixes.sql`  ✅ BLOCKING
  - [ ] `db/automation.sql`      ✅ BLOCKING
- [ ] Re-run security + automation verification checks in production

### 3) Environment Variables (Vercel) (verify only what you actually use)
- [ ] `NEXT_PUBLIC_APP_URL` = `https://chemirl.app`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` = Production Supabase URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Production anon key

Optional / only if implemented and referenced in code:
- [ ] `SUPABASE_SERVICE_ROLE_KEY` = Production service role key (only if server-side routes/webhooks exist)
- [ ] `POSTMARK_API_TOKEN` = Production Postmark token (only if app sends emails via Postmark)
- [ ] `POSTMARK_FROM_EMAIL` = Verified sender email
- [ ] Stripe vars (only if payments + webhook handlers are implemented and deployed):
  - [ ] `STRIPE_SECRET_KEY`
  - [ ] `STRIPE_PUBLISHABLE_KEY`
  - [ ] `STRIPE_WEBHOOK_SECRET`
  - [ ] `STRIPE_MOMENTUM_PLUS_PRICE_ID`
  - [ ] `STRIPE_CREDITS_50_PRICE_ID`
  - [ ] `STRIPE_CREDITS_120_PRICE_ID`
  - [ ] `STRIPE_CREDITS_260_PRICE_ID`
- [ ] PostHog vars (optional):
  - [ ] `NEXT_PUBLIC_POSTHOG_KEY`
  - [ ] `NEXT_PUBLIC_POSTHOG_HOST` = `https://app.posthog.com`
- [ ] `CRON_SECRET` (only if an external cron endpoint exists and is used)

### 4) Domain & SSL
- [ ] Domain `chemirl.app` connected in Vercel
- [ ] DNS records configured in Cloudflare
- [ ] SSL certificate active (automatic with Vercel)
- [ ] HTTPS redirect working
- [ ] `www` subdomain redirects to root

### 5) Supabase Production
- [ ] Production project created
- [ ] Region: EU (choose the closest EU region your Supabase plan supports for GDPR)
- [ ] Auth settings configured:
  - [ ] Site URL: `https://chemirl.app`
  - [ ] Redirect URLs include:
    - [ ] `https://chemirl.app/auth/callback` (web)
    - [ ] `chemirl://auth/callback` (mobile deep link, if used by the app)
- [ ] Email templates configured (auth emails at minimum)
- [ ] Storage buckets created and policies verified (if photos/storage are used)

### 6) Stripe Production (DEFERRED unless implemented)
- [ ] Production account activated
- [ ] Products created:
  - [ ] Momentum+ subscription (€14.99/mo)
  - [ ] 50 Credits pack (€4.99)
  - [ ] 120 Credits pack (€9.99)
  - [ ] 260 Credits pack (€19.99)

### Stripe Webhooks (DEFERRED unless handlers exist)
- [ ] If webhooks are implemented, verify handlers are deployed and secrets set
- [ ] Required events (when implemented):
  - [ ] `checkout.session.completed`
  - [ ] `invoice.payment_succeeded`
  - [ ] `customer.subscription.updated`

### 7) Postmark (optional)
- [ ] Production server created
- [ ] Sender signature verified
- [ ] Domain verified (if using custom domain)
- [ ] API token copied to Vercel

## Deployment Steps

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Production deployment"
   git push origin main
   ```

2. **Vercel Deployment**

   * [ ] Automatic deployment triggered
   * [ ] Build succeeds
   * [ ] Preview deployment tested
   * [ ] Production deployment promoted

3. **Verify Web Deployment**

   * [ ] Site loads at `https://chemirl.app`
   * [ ] Health check: `https://chemirl.app/api/health` (only if this endpoint exists)
   * [ ] Login flow works (web, if supported)

4. **Mobile Release (if applicable)**

   * [ ] Mobile app builds pass (EAS Build or local builds)
   * [ ] iOS TestFlight/App Store release (if applicable)
   * [ ] Android Play Store release (if applicable)
   * [ ] Deep linking tested (magic link authentication)
   * [ ] Environment variables configured for mobile app builds
   * Note: Mobile releases are typically handled separately from web deployments

## Post-Deployment Verification

### Core Flows (must pass)

* [ ] Sign up with new email
* [ ] Complete onboarding
* [ ] View discovery feed
* [ ] Like someone
* [ ] Create proposal
* [ ] Confirm proposal
* [ ] Send chat message
* [ ] Report user
* [ ] Block user

### Automation (must pass)

* [ ] Proposal expiry verified in production (server-side)
* [ ] Daily scoring verified in production (server-side)
* [ ] Scheduled jobs are present and active

### Email (only check what's implemented)

* [ ] Auth magic link emails delivered
* [ ] If app emails are implemented:

  * [ ] Proposal reminder emails sent
  * [ ] Confirm reminder emails sent
  * [ ] Emails render correctly

### Payments (DEFERRED unless implemented)

If payments are implemented:
* [ ] Stripe Checkout opens
* [ ] Test payment succeeds
* [ ] If webhook handlers are implemented: verify webhook receives events
* [ ] Credits added to account
* [ ] Subscription recorded

### Performance

* [ ] Page load times < 3s
* [ ] API response times < 500ms (only for endpoints that exist)
* [ ] No database query timeouts
* [ ] Realtime connections stable

### Security (must pass)

* [ ] HTTPS enforced
* [ ] Security headers present
* [ ] RLS policies working
* [ ] No sensitive data in logs
* [ ] SECURITY DEFINER fixes applied (production)

### Monitoring (recommended)

* [ ] Vercel Analytics active
* [ ] PostHog tracking events (if enabled)
* [ ] Error monitoring (Sentry) active (if enabled)
* [ ] Database logs accessible
* [ ] Postmark delivery logs checked (if enabled)

## Rollback Plan

If issues occur:

1. **Immediate Rollback (code)**

   * [ ] Revert to previous Git commit/tag
   * [ ] Redeploy in Vercel
   * [ ] Verify site restored

2. **Immediate Containment (automation)**

   * [ ] Disable scheduled jobs installed by `db/automation.sql` first (fast containment)
   * [ ] Re-verify proposals/scoring behavior stabilizes

3. **Database Rollback**

   * [ ] Restore from backup if needed
   * [ ] Revert function changes (use your saved "pre" definitions or rollback SQL)
   * [ ] Document changes

4. **Communication**

   * [ ] Notify users if downtime
   * [ ] Update status page
   * [ ] Post-mortem after resolution

## Launch Day

* [ ] All pre-deployment checks complete
* [ ] Team notified of launch
* [ ] Monitoring dashboards open
* [ ] Support channels ready
* [ ] Backup plan ready
* [ ] Launch announcement prepared

## Post-Launch (First 24h)

* [ ] Monitor error rates
* [ ] Check user signups
* [ ] Verify email delivery
* [ ] Review user feedback
* [ ] Check database performance
* [ ] Monitor costs (stay under €200/mo)

## Success Metrics (Week 1)

Track these in PostHog/database (only what's enabled):

* [ ] Signups per day
* [ ] Onboarding completion rate
* [ ] Discovery feed views
* [ ] Likes sent
* [ ] Matches created
* [ ] Proposals sent
* [ ] Confirms received
* [ ] Chat messages sent
* [ ] Error rate < 1%
* [ ] Page load time < 3s
