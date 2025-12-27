# Legacy Code Documentation

This document tracks code that has been deprecated as part of the app-first pivot.

## Overview

As of the app-first pivot (Phase 1-2), the website has been converted to a **static marketing site only**. All product functionality has been moved to the mobile app.

## What Was Removed

### Pages (Removed)
- `/src/app/auth/login/page.tsx` - Login page (now in mobile app)
- `/src/app/auth/callback/page.tsx` - Auth callback (now in mobile app)
- `/src/app/onboarding/page.tsx` - Profile onboarding (now in mobile app)
- `/src/app/discover/page.tsx` - Discovery feed (now in mobile app)
- `/src/app/discover/feed-client.tsx` - Discovery feed client (now in mobile app)
- `/src/app/matches/page.tsx` - Matches list (now in mobile app)
- `/src/app/matches/[matchId]/page.tsx` - Match detail (now in mobile app)
- `/src/app/matches/[matchId]/propose/page.tsx` - Proposal creation (now in mobile app)
- `/src/app/matches/[matchId]/chat/page.tsx` - Chat page (now in mobile app)
- `/src/app/settings/page.tsx` - Settings page (now in mobile app)

### API Routes (All Removed)
All API routes have been removed since the website is now static:
- `/src/app/api/auth/magic-link/route.ts` - Magic link generation
- `/src/app/api/likes/route.ts` - Like/pass actions
- `/src/app/api/proposals/route.ts` - Proposal creation
- `/src/app/api/confirms/route.ts` - Confirm actions
- `/src/app/api/messages/route.ts` - Message sending
- `/src/app/api/checkout/create/route.ts` - Stripe checkout
- `/src/app/api/webhooks/stripe/route.ts` - Stripe webhooks
- `/src/app/api/scoring/daily/route.ts` - Daily scoring cron
- `/src/app/api/scoring/events/route.ts` - Event-based scoring
- `/src/app/api/reminders/send/route.ts` - Email reminders
- `/src/app/api/block/route.ts` - Block user
- `/src/app/api/reports/route.ts` - Report creation
- `/src/app/api/account/delete/route.ts` - Account deletion
- `/src/app/api/account/export/route.ts` - Data export
- `/src/app/api/health/route.ts` - Health check

**Note**: If webhooks/cron jobs are needed, they should be implemented as:
- Supabase Edge Functions, or
- Separate serverless functions (not part of static site)

### Components (Removed)
- `/src/components/nav.tsx` - Navigation component
- `/src/components/proposal-card.tsx` - Proposal card
- `/src/components/report-dialog.tsx` - Report dialog
- `/src/components/toast-container.tsx` - Toast container
- `/src/components/toast.tsx` - Toast component

### Contexts (Removed)
- `/src/contexts/toast-context.tsx` - Toast context

### Middleware (Removed)
- `/src/middleware.ts` - Supabase session refresh (not needed for static site)

## What Was Kept

### Database
- ✅ All database schema (`/db/schema.sql`)
- ✅ All RLS policies (`/db/rls.sql`)
- ✅ All KPI views (`/db/kpi_views.sql`)
- ✅ All scoring functions (`/db/scoring.sql`)
- ✅ All RPC functions (used directly by mobile app)

### Libraries (Kept for Reference)
- ✅ `/src/lib/supabase/admin.ts` - Admin client (for future webhooks/Edge Functions)
- ✅ `/src/lib/entitlements.ts` - Credit/subscription logic (reference for mobile)
- ✅ `/src/lib/errors.ts` - Error utilities (reference for mobile)
- ✅ `/src/lib/email/postmark.ts` - Email utilities (for future webhooks)
- ✅ `/src/lib/stripe/client.ts` - Stripe client (for future webhooks)
- ✅ `/src/config/brand.ts` - Brand constants (copied to mobile)

### Marketing Site
- ✅ `/src/app/page.tsx` - Landing page (updated for marketing)
- ✅ `/src/app/download/page.tsx` - Download/waitlist page (new)
- ✅ `/src/app/how-it-works/page.tsx` - How it works page (new)

## Migration Notes

### Mobile App
The mobile app (`/mobile`) now handles all product functionality:
- Auth via Supabase (magic links with deep linking)
- Discovery feed via RPC `get_discovery_feed()`
- Like/Match via RPC `create_like_and_check_match()`
- Proposals via direct insert to `proposals` table
- Chat via Supabase Realtime subscriptions
- All other features via direct Supabase client

### Website
The website is now a static marketing site:
- Static export enabled (`output: 'export'` in `next.config.ts`)
- No server-side rendering
- No API routes (all removed)
- No middleware (removed)
- Marketing pages only (landing, download, how-it-works)

### Webhooks & Cron Jobs
Webhooks and cron jobs are **not part of the static site**. If needed, implement as:
1. **Supabase Edge Functions** (recommended)
2. **Separate serverless functions** (Vercel, AWS Lambda, etc.)

Current approach: Defer until needed. Can be added later as Edge Functions.

## Future Considerations

1. **Edge Functions**: Consider moving webhooks to Supabase Edge Functions for better integration
2. **Admin Panel**: May need a simple admin panel for moderation (can be separate Next.js app or Edge Function-based)
3. **Shared Types**: Consider creating a shared types package if mobile and web need to share TypeScript types
4. **Monorepo**: Consider moving to monorepo structure if code sharing becomes important

## Questions?

If you need to reference the old code:
- Check git history before the pivot commit
- Old product pages/components are in git history
- Database schema and RPC functions remain unchanged

