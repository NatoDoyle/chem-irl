# Chem IRL - Web MVP

A web-first dating app that optimizes time-to-date through structured proposals, 72-hour expiries, and receiver-paid reopens.

## Overview

Chem IRL is designed to get people meeting face-to-face faster by eliminating endless texting. The core mechanic requires users to propose exactly 2-3 specific times within 7 days, with proposals expiring after 72 hours unless the receiver pays to reopen them.

## Core Features

- **Structured Proposals**: Exactly 2-3 times within 7 days + first-date type + one-line note
- **72-Hour Expiry**: Proposals expire automatically to prevent ghosting
- **Receiver-Paid Reopen**: Fair system where receivers pay credits to reopen expired proposals
- **Speed Scoring**: Action Speed (primary), Profile Quality (secondary), Reliability (tertiary)
- **Internal "Busy"**: Free users limited to 1 active outbound proposal at a time
- **Chat Unlocks**: Only after a time is confirmed, not before

## Tech Stack

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (Postgres + Auth + RLS + Edge Functions + Storage)
- **Payments**: Stripe (subscriptions + credits)
- **Analytics**: PostHog
- **Email**: Postmark
- **SMS**: Twilio/MessageBird (fallback)
- **Monitoring**: Sentry (optional)

## Project Structure

```
web/
├── src/
│   ├── app/                 # Next.js App Router pages
│   ├── config/             # Brand constants and configuration
│   ├── lib/                # Utility functions and client setup
│   └── components/         # Reusable UI components
├── db/
│   ├── schema.sql          # Database schema
│   ├── rls.sql            # Row Level Security policies
│   └── kpi_views.sql      # KPI views and metrics
├── env.example            # Environment variables template
└── README.md
```

## Setup Instructions

### 1. Environment Setup

Copy the environment template and fill in your keys:

```bash
cp env.example .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `NEXT_PUBLIC_POSTHOG_KEY` - Your PostHog project key

### 2. Database Setup

1. Create a new Supabase project
2. Run the SQL files in order:
   ```sql
   -- Run these in Supabase SQL Editor
   \i db/schema.sql
   \i db/rls.sql
   \i db/kpi_views.sql
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

## Key Metrics (North Star)

- **Confirmed dates / WAU ≥ 0.15**
- **Proposal-Confirm ≤24h: 55%**
- **Confirm-Show: 80%**
- **Median Time-to-Date ≤ 7 days**
- **Payer share ≥ 6% MAU by Week 8**

## Database Schema

### Core Tables

- `users` - User accounts and basic info
- `profiles` - Extended profile data (prompts, photos, availability)
- `likes` - Like relationships
- `matches` - Mutual likes that create matches
- `proposals` - Time proposals with 72h expiry
- `confirms` - Confirmed time slots
- `messages` - Chat messages (unlocked after confirm)
- `surveys` - Post-date feedback
- `scores_daily` - Daily Action Speed, Profile Quality, Reliability scores
- `purchases` - Stripe transactions
- `credits_ledger` - Credit usage tracking
- `reports` - Safety reports
- `enforcements` - Moderation actions

### Row Level Security

All tables have RLS enabled with policies that ensure:
- Users can only see their own data
- Users can only see data from their matches
- Moderators have elevated access for safety
- System functions can manage scores and credits

## Scoring System

### Action Speed Score (Primary)
- Daily engine: -8/day + likes (+2 each, cap +16/day)
- Event bonuses: Fast proposal/confirm responses get +12, slow get penalties
- Turn-based scoring: Harsh penalties for slow responses
- Floor: 50 (can't go below except via inbound neglect)

### Profile Quality Score (Secondary)
- Based on Match Acceptance Rate (Bayesian-smoothed)
- Prior: 40% acceptance rate
- Stabilizes after ~30 exposures
- Profile completion bonuses

### Reliability Score (Tertiary)
- Show/no-show behavior
- Honest cancellations vs no-shows
- Bilateral "would meet again" ratings
- Safety report penalties

## Monetization

### Credits (Virtual Items)
- Reopen expired proposals: 10 credits base + ladder
- Fast Pass (next proposal priority): 15 credits
- Extra Chat Slot (24h): 20 credits
- Stack Pass (>1 date/day): 20 credits

### Momentum+ Subscription (~€14.99/mo)
- Unlimited outbound proposals
- Unlimited concurrent chats
- Smart reminders
- Queue lift
- Stack Pass allowance
- Reopen allowance

## Safety & Moderation

- Photo verification + selfie pose check
- Manual moderation queue with 24h SLA
- Report categories: Spam/Scam, Fake/Impersonation, Harassment/Hate, etc.
- Enforcement ladder: Warning → Content Removal → Temporary Ban → Permanent Ban
- Transparent moderation with visible SLA timers

## Development Roadmap

### Week 1-2: Core Infrastructure
- [x] Next.js setup with TypeScript and Tailwind
- [x] Database schema and RLS policies
- [x] Brand configuration and landing page
- [ ] Supabase client setup
- [ ] Authentication flow

### Week 3-4: Core Features
- [ ] Profile creation and photo upload
- [ ] Discovery feed with basic ranking
- [ ] Like/match system
- [ ] Proposal creation and confirmation flow

### Week 5-6: Advanced Features
- [ ] 72-hour expiry system
- [ ] Reopen with credits
- [ ] Chat system (post-confirm)
- [ ] Scoring engine implementation

### Week 7-8: Polish & Launch
- [ ] Stripe integration
- [ ] Email/SMS reminders
- [ ] Safety and reporting
- [ ] Closed beta launch

## Contributing

This is a solo founder project. The codebase is designed to be maintainable by one person with clear separation of concerns and comprehensive documentation.

## License

Private - All rights reserved.