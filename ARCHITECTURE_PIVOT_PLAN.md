# Chem IRL: App-First Architecture Pivot Plan

## Step 1: Current State Analysis

### Tech Stack Summary

**Frontend (Web)**
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context (Toast), Server Components
- **Deployment**: Vercel

**Backend**
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Magic Link)
- **API**: Next.js API Routes (REST endpoints)
- **Realtime**: Supabase Realtime (for chat)
- **Storage**: Supabase Storage (for photos)
- **Scheduled Jobs**: Vercel Cron Jobs (via `vercel.json`)

**Third-Party Services**
- **Payments**: Stripe (Checkout + Webhooks)
- **Email**: Postmark (Transactional)
- **Analytics**: PostHog
- **Domain/DNS**: Cloudflare

### Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Next.js Web App (Full Product)                  │  │
│  │  - Auth, Onboarding, Discovery, Matches, Chat    │  │
│  │  - Server Components + Client Components         │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/REST
                          ▼
┌─────────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES                         │
│  /api/auth/magic-link                                   │
│  /api/likes                                             │
│  /api/proposals                                         │
│  /api/confirms                                          │
│  /api/messages                                          │
│  /api/checkout/create                                   │
│  /api/webhooks/stripe                                   │
│  /api/reports                                           │
│  /api/block                                             │
│  /api/account/export                                    │
│  /api/account/delete                                    │
│  /api/scoring/daily                                     │
│  /api/scoring/events                                    │
│  /api/reminders/send                                    │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Supabase Client
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                              │  │
│  │  - users, profiles, likes, matches               │  │
│  │  - proposals, confirms, messages                 │  │
│  │  - scores_daily, purchases, credits_ledger       │  │
│  │  - reports, enforcements                          │  │
│  │  - RLS policies enforced                          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Auth                                    │  │
│  │  - Magic link authentication                     │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Realtime                                │  │
│  │  - Chat messages (subscriptions)                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Storage                                 │  │
│  │  - User photos                                    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase RPC Functions                           │  │
│  │  - get_discovery_feed()                           │  │
│  │  - create_like_and_check_match()                  │  │
│  │  - get_user_matches()                             │  │
│  │  - update_daily_action_speed()                    │  │
│  │  - update_profile_quality()                       │  │
│  │  - update_reliability()                           │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Webhooks/API
                          ▼
┌─────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                           │
│  - Stripe (Payments)                                     │
│  - Postmark (Email)                                      │
│  - PostHog (Analytics)                                   │
└─────────────────────────────────────────────────────────┘
```

### Current Modules/Services

**User Management**
- ✅ Auth: Magic link via Supabase
- ✅ Profiles: Onboarding, completion tracking
- ✅ Preferences: Gender, orientation, age, distance

**Discovery & Matching**
- ✅ Discovery feed: RPC `get_discovery_feed()` with scoring
- ✅ Like/Pass: API endpoint + RPC `create_like_and_check_match()`
- ✅ Match creation: Automatic on mutual like

**Proposals & Confirms**
- ✅ Proposal creation: 2-3 time windows, date types, note
- ✅ Confirm flow: One-tap confirmation
- ✅ "None suits" flow: Alternative proposal creation
- ✅ 72-hour expiry: Automatic status updates

**Messaging**
- ✅ Chat: Realtime via Supabase subscriptions
- ✅ Message sending: API endpoint
- ✅ Chat unlock: Only after confirm

**Scoring Engine**
- ✅ Action Speed: Daily engine + event bonuses
- ✅ Profile Quality: Bayesian-smoothed MAR
- ✅ Reliability: Show/no-show tracking
- ✅ Daily cron job: `/api/scoring/daily`

**Monetization**
- ✅ Stripe Checkout: Subscriptions + credits
- ✅ Webhooks: Purchase processing
- ✅ Credits ledger: Usage tracking

**Safety & Compliance**
- ✅ Reporting: API endpoint + moderation queue
- ✅ Blocking: Unmatch + prevent future matches
- ✅ Account deletion: GDPR compliance
- ✅ Data export: JSON export

**Website Pages**
- ✅ Landing page: Marketing content
- ✅ Auth pages: Login, callback
- ✅ Onboarding: Profile creation
- ✅ Discover: Feed with cards
- ✅ Matches: List + detail pages
- ✅ Chat: Realtime messaging
- ✅ Settings: Account management

### Database Schema (Key Tables)

**Core Tables**
- `users`: Basic user info (email, phone, dob, gender, orientation, city)
- `profiles`: Extended profile (prompts, photos, availability, completion_pct)
- `likes`: Like relationships (liker_id, likee_id)
- `matches`: Mutual likes (user_a, user_b, status)
- `proposals`: Time proposals (windows, date_types, note, expires_at)
- `confirms`: Confirmed time slots (proposal_id, chosen_window)
- `messages`: Chat messages (match_id, sender_id, content)

**Scoring & Metrics**
- `scores_daily`: Daily Action Speed, Profile Quality, Reliability scores
- `surveys`: Post-date feedback

**Monetization**
- `purchases`: Stripe transactions
- `credits_ledger`: Credit usage tracking

**Safety**
- `reports`: User reports
- `enforcements`: Moderation actions

### Current Strengths

1. **Solid Backend Foundation**: Supabase provides auth, DB, realtime, storage
2. **Well-Structured API**: REST endpoints with proper validation (Zod)
3. **Comprehensive Data Model**: All core entities defined
4. **Scoring Engine**: Complex logic already implemented
5. **RLS Security**: Row-level security policies in place
6. **Type Safety**: TypeScript throughout

### Current Limitations for Mobile

1. **Tightly Coupled**: Web app and API routes in same Next.js app
2. **Server Components**: Can't reuse server-side rendering logic in mobile
3. **Cookie-Based Auth**: Supabase SSR uses cookies (not ideal for mobile)
4. **No Mobile App**: Zero React Native or mobile code
5. **Website = Product**: Marketing and product are mixed

---

## Step 2: Architecture Options for App-First Pivot

### Option A: Supabase Direct + React Native + Static Marketing Site

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  React Native App    │  │  Static Marketing Site  │ │
│  │  (Expo/RN)           │  │  (Next.js Static)       │ │
│  │  - All product       │  │  - Landing page        │ │
│  │    features          │  │  - Screenshots         │ │
│  │  - Direct Supabase   │  │  - App Store links     │ │
│  │    client            │  │  - Waitlist            │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Direct Supabase Client
                          │ (JWT tokens)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                              │
│  - PostgreSQL (existing schema)                          │
│  - Auth (JWT tokens for mobile)                          │
│  - Realtime (chat subscriptions)                        │
│  - Storage (photo uploads)                               │
│  - RPC Functions (existing)                              │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Webhooks/API
                          ▼
┌─────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES                           │
│  - Stripe (Payments)                                     │
│  - Postmark (Email)                                      │
│  - PostHog (Analytics)                                   │
└─────────────────────────────────────────────────────────┘
```

**Backend Changes:**
- Keep existing Supabase setup (no changes)
- Add Edge Functions for webhook processing (if needed)
- Keep existing RPC functions
- Keep existing cron jobs (via Supabase pg_cron or Vercel)

**Mobile App:**
- React Native (Expo recommended for faster dev)
- Direct Supabase client (`@supabase/supabase-js`)
- JWT token-based auth (native to Supabase)
- Realtime subscriptions for chat
- Native navigation (React Navigation)

**Website:**
- Convert Next.js app to static export
- Remove all product pages (auth, discover, matches, chat)
- Keep only: landing, how-it-works, screenshots, download links
- Deploy as static site (Vercel or Cloudflare Pages)

**Pros:**
- ✅ Minimal backend changes (keep everything)
- ✅ Fastest path to mobile MVP
- ✅ Reuse all existing RPC functions
- ✅ Reuse all existing database schema
- ✅ Supabase handles auth, realtime, storage natively
- ✅ No API layer to maintain
- ✅ Lower latency (direct DB connection)
- ✅ Solo dev friendly (less code to maintain)

**Cons:**
- ⚠️ Mobile app directly accesses database (RLS protects, but less abstraction)
- ⚠️ Business logic in RPC functions (harder to version/evolve)
- ⚠️ No API versioning (changes affect mobile immediately)
- ⚠️ Edge Functions needed for webhooks (Stripe, Postmark)

**Migration Effort:**
- Backend: **Low** (keep as-is, maybe add Edge Functions)
- Mobile: **Medium** (new codebase, but can reuse logic)
- Website: **Low** (static export, remove product pages)

**Reuse:**
- ✅ 100% of database schema
- ✅ 100% of RPC functions
- ✅ 100% of RLS policies
- ✅ 80% of business logic (copy to mobile)
- ✅ 0% of web UI (new mobile UI)

---

### Option B: REST API Layer + React Native + Static Marketing Site

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  React Native App    │  │  Static Marketing Site  │ │
│  │  (Expo/RN)           │  │  (Next.js Static)       │ │
│  │  - All product       │  │  - Landing page        │ │
│  │    features          │  │  - Screenshots         │ │
│  │  - REST API calls    │  │  - App Store links     │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          │ REST API (JWT tokens)
                          ▼
┌─────────────────────────────────────────────────────────┐
│              NEXT.JS API ROUTES                          │
│  (Refactored for mobile-first)                          │
│  - /api/v1/auth/*                                        │
│  - /api/v1/profiles/*                                    │
│  - /api/v1/discover                                      │
│  - /api/v1/likes                                         │
│  - /api/v1/matches/*                                     │
│  - /api/v1/proposals/*                                   │
│  - /api/v1/messages/*                                    │
│  - /api/v1/checkout/*                                    │
│  - /api/webhooks/*                                       │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Supabase Client
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                              │
│  (Same as Option A)                                      │
└─────────────────────────────────────────────────────────┘
```

**Backend Changes:**
- Refactor Next.js API routes to be mobile-friendly
- Add API versioning (`/api/v1/`)
- Standardize response formats (JSON)
- Add mobile-specific auth (JWT tokens, not cookies)
- Keep existing RPC functions (called by API routes)
- Keep existing cron jobs

**Mobile App:**
- React Native (Expo)
- REST API client (fetch/axios)
- JWT token storage (SecureStore)
- Polling or WebSocket for chat (or Supabase Realtime SDK)

**Website:**
- Same as Option A (static export)

**Pros:**
- ✅ API abstraction layer (easier to version/evolve)
- ✅ Business logic centralized in API
- ✅ Can add rate limiting, caching, analytics at API layer
- ✅ Easier to add webhooks, webhooks processing
- ✅ Can support multiple clients (mobile, web, future admin panel)
- ✅ Better for scaling (can add API gateway later)

**Cons:**
- ⚠️ More code to maintain (API layer + mobile app)
- ⚠️ Extra network hop (mobile → API → Supabase)
- ⚠️ Need to refactor existing API routes
- ⚠️ More complex auth (JWT tokens in API)
- ⚠️ Slower to ship MVP (more refactoring)

**Migration Effort:**
- Backend: **High** (refactor all API routes, add versioning)
- Mobile: **Medium** (new codebase, API client)
- Website: **Low** (static export)

**Reuse:**
- ✅ 100% of database schema
- ✅ 100% of RPC functions
- ✅ 80% of API route logic (refactor)
- ✅ 0% of web UI

---

### Option C: Hybrid - Supabase Direct + Thin API for Webhooks

**Architecture:**
```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  React Native App    │  │  Static Marketing Site  │ │
│  │  - Direct Supabase   │  │  (Next.js Static)       │ │
│  │  - Most features     │  │                          │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        │ Direct Supabase                   │ Thin API
        │ (JWT tokens)                      │ (Webhooks only)
        ▼                                   ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                              │
│  (Same as Option A)                                      │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Webhooks
                          ▼
┌─────────────────────────────────────────────────────────┐
│              NEXT.JS API (Minimal)                       │
│  - /api/webhooks/stripe                                  │
│  - /api/webhooks/postmark (if needed)                    │
│  - /api/cron/* (scheduled jobs)                         │
└─────────────────────────────────────────────────────────┘
```

**Backend Changes:**
- Keep most Next.js API routes (for webhooks/cron only)
- Remove product API routes (not needed)
- Add Supabase Edge Functions for webhook processing (alternative)
- Keep existing RPC functions
- Keep existing cron jobs

**Mobile App:**
- Same as Option A (direct Supabase)

**Website:**
- Same as Option A (static export)

**Pros:**
- ✅ Best of both worlds (direct DB + webhook processing)
- ✅ Minimal API layer (only webhooks/cron)
- ✅ Fast mobile development (direct Supabase)
- ✅ Can process webhooks server-side (Stripe, Postmark)
- ✅ Solo dev friendly

**Cons:**
- ⚠️ Split architecture (mobile direct, webhooks via API)
- ⚠️ Need to decide: Edge Functions vs Next.js API for webhooks

**Migration Effort:**
- Backend: **Low-Medium** (keep webhook routes, remove product routes)
- Mobile: **Medium** (same as Option A)
- Website: **Low** (static export)

**Reuse:**
- ✅ 100% of database schema
- ✅ 100% of RPC functions
- ✅ 20% of API routes (webhooks/cron only)
- ✅ 0% of web UI

---

## Step 3: Recommendation

### **Recommended: Option A (Supabase Direct + React Native + Static Marketing Site)**

**Justification:**

1. **Fastest MVP Path**: You can ship a mobile app in 2-3 weeks by reusing all existing backend infrastructure.

2. **Maximum Reuse**: 100% of your database schema, RLS policies, and RPC functions work as-is. No refactoring needed.

3. **Solo Dev Friendly**: Less code to maintain. Mobile app talks directly to Supabase (RLS handles security). No API layer to version or maintain.

4. **Proven Stack**: Supabase is designed for this. Many mobile apps use Supabase directly. JWT tokens work perfectly for mobile.

5. **Lower Latency**: Direct database connection means faster responses (no API hop).

6. **Easy Scaling Path**: If you need an API layer later (for webhooks, rate limiting, etc.), you can add Supabase Edge Functions or a thin Next.js API layer incrementally.

7. **Cost Effective**: No additional infrastructure. Supabase free tier is generous for MVP.

**What to Change:**
- ✅ Create new React Native app (separate repo or monorepo)
- ✅ Convert Next.js website to static export (marketing only)
- ✅ Keep all Supabase setup (database, RLS, RPC functions)
- ✅ Add Supabase Edge Functions for webhook processing (Stripe, Postmark) OR keep minimal Next.js API routes

**What to Keep:**
- ✅ 100% of database schema
- ✅ 100% of RPC functions
- ✅ 100% of RLS policies
- ✅ All business logic (copy to mobile)
- ✅ Stripe, Postmark, PostHog integrations

**What to Deprecate:**
- ❌ Next.js product pages (auth, discover, matches, chat) → Remove
- ❌ Next.js API routes (except webhooks/cron) → Remove or move to Edge Functions
- ❌ Server Components → Not needed for mobile
- ❌ Cookie-based auth → Use JWT tokens for mobile

---

## Step 4: Target Architecture Design

### Detailed Architecture: Option A

#### Backend (Supabase - No Changes)

**Database Schema** (Keep as-is)
- All existing tables: `users`, `profiles`, `likes`, `matches`, `proposals`, `confirms`, `messages`, `scores_daily`, `purchases`, `credits_ledger`, `reports`, `enforcements`
- All existing RLS policies
- All existing indexes

**RPC Functions** (Keep as-is)
- `get_discovery_feed(p_viewer UUID, p_limit INTEGER)`
- `create_like_and_check_match(p_liker UUID, p_likee UUID)`
- `get_user_matches(p_user_id UUID)`
- `are_users_matched(p_user_a UUID, p_user_b UUID)`
- `get_user_action_speed(p_user_id UUID)`
- `apply_action_speed_bonus(p_user_id UUID, p_bonus INTEGER, p_event_type TEXT)` - Apply event bonus to action speed
- `update_profile_quality(p_user_id UUID)` - Update profile quality (Bayesian MAR)
- `update_reliability(p_user_id UUID, p_event_type TEXT, p_value NUMERIC DEFAULT 0)` - Update reliability score

**Auth** (Supabase Auth - JWT tokens)
- Magic link for email (works on mobile via deep links)
- Phone auth (optional, for later)
- JWT tokens stored in mobile SecureStore

**Realtime** (Supabase Realtime)
- Chat messages: Subscribe to `messages` table filtered by `match_id`
- Match updates: Subscribe to `matches` table filtered by user

**Storage** (Supabase Storage)
- Photo uploads: `profiles` bucket
- Signed URLs for photo access

**Webhooks & Cron** (Choose one)
- **Option 1**: Supabase Edge Functions (recommended)
  - `/functions/stripe-webhook`
  - `/functions/daily-scoring`
  - `/functions/send-reminders`
- **Option 2**: Keep minimal Next.js API routes (deploy to Vercel)
  - `/api/webhooks/stripe`
  - `/api/scoring/daily`
  - `/api/reminders/send`

#### Mobile App (React Native + Expo)

**Stack:**
- **Framework**: React Native (Expo SDK 52+)
- **Language**: TypeScript
- **Navigation**: React Navigation v7
- **State Management**: React Context + Hooks (or Zustand for complex state)
- **Supabase Client**: `@supabase/supabase-js` v2
- **Auth Storage**: Expo SecureStore
- **Image Picker**: `expo-image-picker`
- **Push Notifications**: Expo Notifications (later)
- **Styling**: React Native StyleSheet (or NativeWind for Tailwind-like syntax)

**Screen Structure:**
```
App (Root Navigator)
├── AuthStack (if not authenticated)
│   ├── WelcomeScreen
│   ├── LoginScreen (email input)
│   └── MagicLinkSentScreen
├── MainTabNavigator (if authenticated)
│   ├── DiscoverTab
│   │   └── DiscoverScreen (card stack)
│   ├── MatchesTab
│   │   ├── MatchesListScreen
│   │   └── MatchDetailScreen
│   │       ├── ProposalsView
│   │       ├── ProposeScreen
│   │       └── ChatScreen
│   └── ProfileTab
│       ├── ProfileScreen
│       ├── EditProfileScreen
│       ├── SettingsScreen
│       └── AccountScreen
└── Modals
    ├── MatchModal (when match occurs)
    └── ReportModal
```

**API Pattern:**
```typescript
// Direct Supabase client
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: SecureStore, // Expo SecureStore
      autoRefreshToken: true,
      persistSession: true,
    },
  }
)

// Example: Get discovery feed
const { data, error } = await supabase.rpc('get_discovery_feed', {
  p_viewer: userId,
  p_limit: 24,
})

// Example: Like user
const { data, error } = await supabase.rpc('create_like_and_check_match', {
  p_liker: userId,
  p_likee: targetUserId,
})

// Example: Realtime chat
const channel = supabase
  .channel(`match:${matchId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `match_id=eq.${matchId}`,
  }, (payload) => {
    // Handle new message
  })
  .subscribe()
```

**Data Model** (Same as backend, TypeScript interfaces):
```typescript
interface User {
  user_id: string
  email: string
  phone?: string
  dob: string
  gender: 'male' | 'female' | 'non_binary' | 'other'
  orientation: string
  city_id: string
  timezone: string
  verified_at?: string
  last_active_at: string
}

interface Profile {
  user_id: string
  prompts: Record<string, string>
  availability: Record<string, any>
  photos: string[]
  completion_pct: number
}

interface Match {
  match_id: string
  user_a: string
  user_b: string
  created_at: string
  status: 'open' | 'expired' | 'closed' | 'unmatched'
}

interface Proposal {
  proposal_id: string
  match_id: string
  sender_id: string
  windows: Array<{ start: string; end: string }>
  date_types: string[]
  note?: string
  created_at: string
  expires_at: string
  status: 'active' | 'expired' | 'confirmed' | 'reopened'
}

interface Message {
  message_id: string
  match_id: string
  sender_id: string
  content: string
  bytes: number
  created_at: string
}
```

**Required API Endpoints** (via Supabase RPC or direct queries):

**Auth & Onboarding:**
- Sign in: `supabase.auth.signInWithOtp({ email })`
- Verify session: `supabase.auth.getSession()`
- Sign out: `supabase.auth.signOut()`
- Create profile: `supabase.from('profiles').upsert(...)`
- Upload photo: `supabase.storage.from('profiles').upload(...)`

**Discovery & Matching:**
- Get feed: `supabase.rpc('get_discovery_feed', { p_viewer, p_limit })`
- Like user: `supabase.rpc('create_like_and_check_match', { p_liker, p_likee })`
- Pass user: No-op (track client-side for analytics)

**Matches:**
- Get matches: `supabase.rpc('get_user_matches', { p_user_id })`
- Get match details: `supabase.from('matches').select(...).eq('match_id', ...)`

**Proposals:**
- Create proposal: `supabase.from('proposals').insert(...)`
- Get proposals: `supabase.from('proposals').select(...).eq('match_id', ...)`
- Confirm proposal: `supabase.from('confirms').insert(...)`
- Create alternative proposal: `supabase.from('proposals').insert(...)` (with `response_to`)

**Chat:**
- Get messages: `supabase.from('messages').select(...).eq('match_id', ...).order('created_at')`
- Send message: `supabase.from('messages').insert(...)`
- Realtime subscription: `supabase.channel(...).on('postgres_changes', ...)`

**Settings:**
- Update profile: `supabase.from('profiles').update(...).eq('user_id', ...)`
- Block user: Call Edge Function or API route (needs service role)
- Report user: Call Edge Function or API route
- Export data: Call Edge Function or API route
- Delete account: Call Edge Function or API route

#### Website (Static Marketing Site)

**Structure:**
```
web-marketing/
├── app/
│   ├── page.tsx (Landing/Hero)
│   ├── how-it-works/
│   │   └── page.tsx
│   ├── features/
│   │   └── page.tsx
│   ├── screenshots/
│   │   └── page.tsx
│   ├── download/
│   │   └── page.tsx (App Store/Play Store links or waitlist)
│   ├── terms/
│   │   └── page.tsx
│   └── privacy/
│       └── page.tsx
├── components/
│   ├── Hero.tsx
│   ├── HowItWorks.tsx
│   ├── Features.tsx
│   └── Screenshots.tsx
└── public/
    └── screenshots/ (app screenshots)
```

**Next.js Config:**
```typescript
// next.config.ts
const nextConfig = {
  output: 'export', // Static export
  images: {
    unoptimized: true, // For static export
  },
}
```

**Deployment:**
- Vercel (static site)
- Or Cloudflare Pages (free)

**Pages to Keep:**
- ✅ Landing page (hero, value prop)
- ✅ How it works (4 steps)
- ✅ Features (key differentiators)
- ✅ Screenshots (app previews)
- ✅ Download/Waitlist (App Store links)
- ✅ Terms of Service
- ✅ Privacy Policy

**Pages to Remove:**
- ❌ `/auth/login`
- ❌ `/auth/callback`
- ❌ `/onboarding`
- ❌ `/discover`
- ❌ `/matches`
- ❌ `/settings`

#### Chat / Realtime

**Initial Implementation (v1):**
- Use Supabase Realtime subscriptions
- Subscribe to `messages` table filtered by `match_id`
- Poll on app open/foreground (fetch latest messages)
- Real-time updates via subscription

**Code:**
```typescript
// Subscribe to messages
const channel = supabase
  .channel(`match:${matchId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `match_id=eq.${matchId}`,
  }, (payload) => {
    setMessages(prev => [...prev, payload.new as Message])
  })
  .subscribe()

// Cleanup on unmount
return () => {
  supabase.removeChannel(channel)
}
```

**Later Upgrade (v2+):**
- Add typing indicators (custom Supabase channel)
- Add read receipts (update `read_at` field)
- Add push notifications (Expo Notifications)
- Add message reactions (new table)

#### Special Mechanic (Time-to-Date)

**Current Implementation:**
- Already in database: `proposals`, `confirms`, `scores_daily`
- RPC functions: `update_daily_action_speed()`, `apply_action_speed_bonus()`, `update_profile_quality()`, `update_reliability()`
- Cron job: Daily scoring updates

**Mobile App Integration:**
- Display Action Speed score in profile cards
- Show proposal expiry countdown
- Show "time-to-date" metric (match → confirm → show)
- Display reliability badges

**Future Enhancements:**
- Add `match_metadata` table for custom match flags
- Add `deadlines` table for time-to-date tracking
- Add `reliability_events` table for detailed tracking

---

## Step 5: Migration Plan

### Phase 1: Repo Reorganization (Week 1)

**Current Structure:**
```
Dating App/
├── web/ (Next.js full app)
├── App Plans/ (docs)
└── scripts/
```

**Target Structure:**
```
chem-irl/
├── mobile/ (React Native app)
├── web-marketing/ (Static Next.js site)
├── shared/ (optional: shared types/utilities)
├── App Plans/ (docs)
└── scripts/
```

**Actions:**

1. **Create new mobile app:**
   ```bash
   npx create-expo-app@latest mobile --template blank-typescript
   cd mobile
   npm install @supabase/supabase-js @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack expo-secure-store expo-image-picker
   ```

2. **Create web-marketing directory:**
   ```bash
   cd web
   # Convert to static export
   # Remove product pages
   # Keep only marketing pages
   ```

3. **Mark legacy code:**
   - Create `web/LEGACY.md` documenting what's deprecated
   - Add `@deprecated` comments to product API routes
   - Keep webhooks/cron routes (still needed)

4. **Files to Keep:**
   - ✅ `db/*.sql` (database migrations at root)
   - ✅ `web/src/lib/supabase/*` (can copy to mobile)
   - ✅ `web/src/lib/entitlements.ts` (can copy to mobile)
   - ✅ `web/src/lib/errors.ts` (can copy to mobile)
   - ✅ `mobile/src/config/brand.ts` - Brand constants (mobile app)
   - ✅ `web/src/config/brand.ts` - Brand constants (web site)
   - ✅ `web/src/app/api/webhooks/*` (keep for webhooks)
   - ✅ `web/src/app/api/scoring/*` (keep for cron)
   - ✅ `web/src/app/api/reminders/*` (keep for cron)

5. **Files to Remove/Deprecate:**
   - ❌ `web/src/app/auth/*` (mobile handles auth)
   - ❌ `web/src/app/onboarding/*` (mobile handles onboarding)
   - ❌ `web/src/app/discover/*` (mobile handles discovery)
   - ❌ `web/src/app/matches/*` (mobile handles matches)
   - ❌ `web/src/app/settings/*` (mobile handles settings)
   - ❌ `web/src/app/api/likes/route.ts` (mobile uses RPC)
   - ❌ `web/src/app/api/proposals/route.ts` (mobile uses direct insert)
   - ❌ `web/src/app/api/confirms/route.ts` (mobile uses direct insert)
   - ❌ `web/src/app/api/messages/route.ts` (mobile uses direct insert)
   - ❌ `web/src/app/api/checkout/create/route.ts` (move to Edge Function or keep)
   - ❌ `web/src/components/nav.tsx` (mobile has native nav)
   - ❌ `web/src/components/proposal-card.tsx` (mobile has native UI)
   - ❌ `web/src/components/report-dialog.tsx` (mobile has native UI)

### Phase 2: Backend Changes (Week 1-2)

**No major changes needed!** But:

1. **Verify RLS policies work for mobile:**
   - Test that JWT tokens from mobile work with existing RLS
   - Ensure `get_discovery_feed` RPC respects RLS
   - Test that mobile can insert/update own data

2. **Add Edge Functions (optional, recommended):**
   ```typescript
   // supabase/functions/stripe-webhook/index.ts
   import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
   import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

   serve(async (req) => {
     // Handle Stripe webhook
     // Update purchases, credits_ledger
   })
   ```

3. **Or keep minimal Next.js API routes:**
   - Keep `/api/webhooks/stripe`
   - Keep `/api/scoring/daily`
   - Keep `/api/reminders/send`
   - Deploy to Vercel (free tier)

4. **Database migrations:**
   - No changes needed (schema is already mobile-friendly)
   - Consider adding indexes if needed for mobile queries

### Phase 3: Mobile App Skeleton (Week 2-3)

**Step 1: Setup**
```bash
cd mobile
# Install dependencies (already done)
# Setup Supabase client
# Setup navigation
```

**Step 2: Auth Flow**
- Create `app/(auth)/welcome.tsx`
- Create `app/(auth)/login.tsx`
- Create `app/(auth)/magic-link-sent.tsx`
- Setup deep linking for magic links
- Test auth flow end-to-end

**Step 3: Onboarding**
- Create `app/(onboarding)/profile-setup.tsx`
- Create `app/(onboarding)/photos.tsx`
- Create `app/(onboarding)/preferences.tsx`
- Test profile creation

**Step 4: Basic Navigation**
- Setup `app/(tabs)/_layout.tsx` (bottom tabs)
- Create placeholder screens:
  - `app/(tabs)/discover.tsx`
  - `app/(tabs)/matches.tsx`
  - `app/(tabs)/profile.tsx`

**Step 5: Wire up one flow**
- Implement discovery feed (call RPC)
- Implement like action (call RPC)
- Show match notification
- Test end-to-end: login → discover → like → match

### Phase 4: Implement Matching + Chat (Week 3-4)

**Step 1: Matches List**
- Create `app/(tabs)/matches.tsx`
- Call `get_user_matches` RPC
- Display match cards
- Navigate to match detail

**Step 2: Match Detail**
- Create `app/matches/[id].tsx`
- Show proposals, confirms
- Add propose button
- Add chat button (if confirmed)

**Step 3: Proposals**
- Create `app/matches/[id]/propose.tsx`
- Form for 2-3 time windows
- Date type selection
- Note input
- Submit to `proposals` table

**Step 4: Chat**
- Create `app/matches/[id]/chat.tsx`
- Fetch messages on load
- Setup Supabase Realtime subscription
- Send message form
- Display messages

### Phase 5: Simplify Website (Week 4)

**Step 1: Convert to Static**
```typescript
// next.config.ts
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
}
```

**Step 2: Remove Product Pages**
- Delete `src/app/auth/`
- Delete `src/app/onboarding/`
- Delete `src/app/discover/`
- Delete `src/app/matches/`
- Delete `src/app/settings/`

**Step 3: Create Marketing Pages**
- Keep `src/app/page.tsx` (landing)
- Create `src/app/how-it-works/page.tsx`
- Create `src/app/features/page.tsx`
- Create `src/app/screenshots/page.tsx`
- Create `src/app/download/page.tsx`
- Create `src/app/terms/page.tsx`
- Create `src/app/privacy/page.tsx`

**Step 4: Remove Product Components**
- Delete `src/components/nav.tsx`
- Delete `src/components/proposal-card.tsx`
- Delete `src/components/report-dialog.tsx`
- Keep `src/components/toast.tsx` (if used in marketing)

**Step 5: Remove Product API Routes**
- Delete `src/app/api/likes/`
- Delete `src/app/api/proposals/`
- Delete `src/app/api/confirms/`
- Delete `src/app/api/messages/`
- Delete `src/app/api/checkout/create/` (or move to Edge Function)
- Keep `src/app/api/webhooks/stripe/`
- Keep `src/app/api/scoring/daily/`
- Keep `src/app/api/reminders/send/`

**Step 6: Update Dependencies**
- Remove unused packages (if any)
- Keep essential packages (Supabase client for webhooks, Stripe, Postmark)

**Step 7: Deploy**
- Deploy to Vercel as static site
- Test all marketing pages
- Verify App Store links work

---

## Implementation Checklist

### Week 1: Setup & Reorganization
- [ ] Create React Native app (Expo)
- [ ] Setup Supabase client in mobile
- [ ] Setup navigation structure
- [ ] Convert website to static export
- [ ] Remove product pages from website
- [ ] Create marketing pages
- [ ] Test static site deployment

### Week 2: Mobile Auth & Onboarding
- [ ] Implement auth flow (magic link)
- [ ] Setup deep linking
- [ ] Implement profile creation
- [ ] Implement photo upload
- [ ] Test end-to-end auth → onboarding

### Week 3: Discovery & Matching
- [ ] Implement discovery feed (RPC call)
- [ ] Create card stack UI
- [ ] Implement like/pass actions
- [ ] Show match notifications
- [ ] Test discovery → like → match flow

### Week 4: Matches & Proposals
- [ ] Implement matches list
- [ ] Implement match detail screen
- [ ] Implement proposal creation
- [ ] Implement confirm flow
- [ ] Test proposal → confirm flow

### Week 5: Chat
- [ ] Implement chat screen
- [ ] Setup Realtime subscriptions
- [ ] Implement message sending
- [ ] Test chat functionality

### Week 6: Polish & Testing
- [ ] Add error handling
- [ ] Add loading states
- [ ] Test all flows end-to-end
- [ ] Fix bugs
- [ ] Prepare for App Store submission

---

## Next Steps

1. **Review this plan** and confirm Option A is the right choice
2. **Create mobile app** using Expo CLI
3. **Start Phase 1** (repo reorganization)
4. **Begin mobile development** (auth → onboarding → discovery)

---

## Questions to Consider

1. **Monorepo vs Separate Repos?**
   - Monorepo: Easier to share types, single deployment
   - Separate: Cleaner separation, independent versioning
   - **Recommendation**: Start with separate repos, consider monorepo later

2. **Edge Functions vs Next.js API for Webhooks?**
   - Edge Functions: Native to Supabase, simpler
   - Next.js API: You already have it, easier to debug
   - **Recommendation**: Start with Next.js API (keep existing), migrate to Edge Functions later if needed

3. **Push Notifications?**
   - Defer to v2 (not in MVP)
   - Use Expo Notifications when ready

4. **Admin Panel?**
   - Defer to v2
   - Can use Supabase Dashboard for now
   - Or build simple admin panel later

---

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Navigation](https://reactnavigation.org/)
- [Supabase React Native Guide](https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

