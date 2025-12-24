# App-First Pivot: Quick Start Guide

## TL;DR

**Recommended Architecture: Option A**
- **Mobile**: React Native (Expo) → Direct Supabase connection
- **Website**: Static Next.js site (marketing only)
- **Backend**: Keep existing Supabase setup (no changes)

**Why?**
- Fastest MVP path (2-3 weeks)
- Maximum code reuse (100% of database, RPC functions)
- Solo dev friendly (less to maintain)
- Proven stack (Supabase works great for mobile)

## Current State Summary

**What You Have:**
- ✅ Next.js 16 web app (full product)
- ✅ Supabase backend (Postgres + Auth + RLS + Realtime)
- ✅ Complete database schema
- ✅ RPC functions for discovery, matching, scoring
- ✅ Stripe, Postmark, PostHog integrations

**What You Need:**
- 🆕 React Native mobile app
- 🆕 Static marketing website
- 🆕 Mobile-first UI/UX

## Architecture Decision

### Option A: Supabase Direct (RECOMMENDED) ✅

```
Mobile App (RN) → Supabase (Direct)
Website (Static) → Marketing only
Webhooks → Next.js API or Edge Functions
```

**Pros:**
- Fastest to ship
- Reuse 100% of backend
- Lower latency
- Less code to maintain

**Cons:**
- Mobile directly accesses DB (RLS protects)
- No API versioning (can add later)

### Option B: REST API Layer

```
Mobile App (RN) → REST API → Supabase
Website (Static) → Marketing only
```

**Pros:**
- API abstraction
- Easier to version
- Better for multiple clients

**Cons:**
- More code to maintain
- Extra network hop
- Slower to ship MVP

## Migration Phases

### Phase 1: Setup (Week 1)
1. Create React Native app: `npx create-expo-app@latest mobile`
2. Convert website to static: `output: 'export'` in `next.config.ts`
3. Remove product pages from website
4. Keep webhooks/cron API routes

### Phase 2: Mobile Auth (Week 2)
1. Setup Supabase client in mobile
2. Implement magic link auth
3. Setup deep linking
4. Test auth flow

### Phase 3: Core Features (Week 3-4)
1. Discovery feed (call `get_discovery_feed` RPC)
2. Like/Match (call `create_like_and_check_match` RPC)
3. Matches list (call `get_user_matches` RPC)
4. Proposals (direct insert to `proposals` table)
5. Chat (Supabase Realtime subscription)

### Phase 4: Polish (Week 5-6)
1. Error handling
2. Loading states
3. Testing
4. App Store prep

## Key Code Patterns

### Mobile: Supabase Client Setup
```typescript
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: SecureStore,
      autoRefreshToken: true,
    },
  }
)
```

### Mobile: Call RPC Function
```typescript
const { data, error } = await supabase.rpc('get_discovery_feed', {
  p_viewer: userId,
  p_limit: 24,
})
```

### Mobile: Realtime Chat
```typescript
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

### Website: Static Export Config
```typescript
// next.config.ts
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
}
```

## What to Keep vs Remove

### Keep ✅
- All database schema (`web/db/*.sql`)
- All RPC functions (work as-is)
- Webhook API routes (`/api/webhooks/stripe`)
- Cron API routes (`/api/scoring/daily`, `/api/reminders/send`)
- Brand config (`src/config/brand.ts`)

### Remove ❌
- Product pages (`/auth`, `/onboarding`, `/discover`, `/matches`, `/settings`)
- Product API routes (`/api/likes`, `/api/proposals`, `/api/confirms`, `/api/messages`)
- Product components (`nav.tsx`, `proposal-card.tsx`, etc.)

## Next Steps

1. **Read** `ARCHITECTURE_PIVOT_PLAN.md` for full details
2. **Confirm** Option A is the right choice
3. **Create** mobile app: `npx create-expo-app@latest mobile`
4. **Start** Phase 1 (repo reorganization)

## Questions?

See `ARCHITECTURE_PIVOT_PLAN.md` for:
- Detailed architecture diagrams
- Complete migration plan
- Code examples
- Implementation checklist

