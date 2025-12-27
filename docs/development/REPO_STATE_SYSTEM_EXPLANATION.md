# Repo State & System Explanation

**Generated**: Based on codebase analysis  
**Project**: Chem IRL - Dating App  
**Status**: MVP Complete (Mobile App), Static Marketing Site (Web)

## Corrections Made

### Version Verifications
- ✅ **Expo SDK 54**: VERIFIED - `mobile/package.json:17` shows `"expo": "~54.0.27"`
- ✅ **React Navigation v7**: VERIFIED - `mobile/package.json:13-15` shows `"@react-navigation/native": "^7.1.24"`
- ✅ **Next.js 16**: VERIFIED - `web/package.json:12` shows `"next": "^16.0.7"`
- ✅ **Tailwind CSS 4**: VERIFIED - `web/package.json:23` shows `"tailwindcss": "^4"`
- ✅ **React 19**: VERIFIED - `mobile/package.json:22` shows `"react": "19.1.0"`, `web/package.json:13` shows `"react": "^19.2.1"`

### Code Verification Corrections
- ✅ **Profile completion_pct logic**: VERIFIED - `mobile/App.tsx:39` checks `profile.completion_pct >= 100`; `mobile/src/screens/onboarding/PhotosScreen.tsx:83` sets `completion_pct: updatedPhotos.length >= 1 ? 100 : 50`
- ✅ **Proposal expiry check**: VERIFIED - `mobile/src/components/ProposalCard.tsx:17` shows `const isExpired = new Date(proposal.expires_at) < new Date();`
- ✅ **RPC function signatures**: VERIFIED - `db/scoring.sql:147` shows `update_profile_quality(p_user_id UUID)` (only one param, not three); `db/scoring.sql:201-204` shows `update_reliability(p_user_id UUID, p_event_type TEXT, p_value NUMERIC DEFAULT 0)` (p_value not p_metadata JSONB)
- ✅ **No useContext usage**: VERIFIED - grep found no matches for `useContext` in `mobile/src/`
- ✅ **Root src/ directory**: VERIFIED - `src/app/page.tsx` exists at root but is NOT used (web uses `web/src/app/page.tsx`)

### Documentation Corrections
- ✅ **ARCHITECTURE_PIVOT_PLAN.md RPC signatures**: INCORRECT - Lines 497-499 show wrong signatures (see corrections above)
- ✅ **Root package.json usage**: VERIFIED - Root `package.json` exists with same content as `web/package.json`, suggesting it's unused/duplicate

---

## What this repo is

**Chem IRL** is a dating app that optimizes time-to-date by requiring structured proposals (2-3 specific times within 7 days) and enforcing 72-hour expiry windows. The app uses a scoring system (Action Speed, Profile Quality, Reliability) to rank users and incentivize quick action.

**Current Architecture**: App-first (pivoted from web-first)
- **Primary Product**: React Native mobile app (iOS/Android)
- **Website**: Static Next.js marketing site (landing page, download links, how-it-works)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **No API Layer**: Mobile app connects directly to Supabase using JWT tokens

**Key Files**:
- Mobile app entry: `mobile/index.ts` → `mobile/App.tsx` ✅ VERIFIED: `mobile/index.ts:1-8`, `mobile/App.tsx:19-124`
- Web site entry: `web/src/app/page.tsx` (static export) ✅ VERIFIED: `web/src/app/page.tsx:1-114`
- Database schema: `db/schema.sql` ✅ VERIFIED: exists with tables as described
- RLS policies: `db/rls.sql` ✅ VERIFIED: exists, enables RLS on all tables
- Scoring functions: `db/scoring.sql` ✅ VERIFIED: exists with functions as described

---

## High-level architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTS                              │
│  ┌──────────────────────┐  ┌──────────────────────────┐ │
│  │  React Native App    │  │  Static Marketing Site   │ │
│  │  (mobile/)           │  │  (web/, Next.js static)  │ │
│  │  - Expo SDK 54       │  │  - Landing page          │ │ ✅ VERIFIED: `mobile/package.json:17` shows `"expo": "~54.0.27"`
│  │  - Direct Supabase   │  │  - Download links        │ │
│  │  - JWT auth          │  │  - No product code       │ │
│  └──────────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          │ Direct Supabase Client
                          │ (JWT tokens, RLS enforced)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    SUPABASE                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                              │  │
│  │  - users, profiles, likes, matches               │  │
│  │  - proposals, confirms, messages                 │  │
│  │  - scores_daily, purchases, credits_ledger     │  │
│  │  - reports, enforcements                          │  │
│  │  - RLS policies (db/rls.sql)                     │  │
│  │  - RPC functions (db/rls.sql, db/scoring.sql)    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Auth                                    │  │
│  │  - Magic link authentication                     │  │
│  │  - JWT token management                          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Realtime                                │  │
│  │  - Chat messages (subscriptions)                 │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Supabase Storage                                 │  │
│  │  - User photos (profiles bucket)                   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ (Deferred - Not Implemented)
                          ▼
┌─────────────────────────────────────────────────────────┐
│              EXTERNAL SERVICES (Planned)                 │
│  - Stripe (Payments) - Webhooks NOT implemented        │
│  - Postmark (Email) - Webhooks NOT implemented         │
│  - PostHog (Analytics) - NOT integrated                │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Direct Supabase Connection**: Mobile app uses `@supabase/supabase-js` directly (no API layer)
   - Lower latency (no API hop)
   - RLS handles security
   - JWT tokens stored in Expo SecureStore ✅ VERIFIED: `mobile/src/lib/supabase/client.ts:20-27` uses `ExpoSecureStoreAdapter`

2. **RPC Functions for Business Logic**: Complex operations in PostgreSQL functions
   - `get_discovery_feed(p_viewer UUID, p_limit INTEGER)` - Discovery feed with scoring
   - `create_like_and_check_match(p_liker UUID, p_likee UUID)` - Like and match detection
   - `get_user_matches(user_uuid UUID)` - Get user's matches
   - `update_daily_action_speed()` - Daily scoring engine
   - `update_profile_quality(p_user_id UUID)` - Profile quality scoring ✅ VERIFIED: `db/scoring.sql:147` (signature: only p_user_id, not 3 params)
   - `update_reliability(p_user_id UUID, p_event_type TEXT, p_value NUMERIC)` - Reliability scoring ✅ VERIFIED: `db/scoring.sql:201-204` (signature: p_value NUMERIC, not p_metadata JSONB)
   - See: `db/rls.sql` (lines 206-371), `db/scoring.sql`

3. **Static Website**: Next.js with `output: 'export'` (no server-side code) ✅ VERIFIED: `web/next.config.ts:5` shows `output: 'export'`
   - Marketing pages only ✅ VERIFIED: `web/src/app/` contains only `page.tsx`, `download/`, `how-it-works/`
   - All product functionality removed during pivot ✅ VERIFIED: `LEGACY.md` documents removed pages
   - See: `web/next.config.ts`, `LEGACY.md`

4. **No Webhooks/Cron Jobs**: Deferred until needed
   - Proposal expiry not automated (manual check in client)
   - Daily scoring not scheduled (would need Supabase Edge Functions or external cron)
   - Stripe webhooks not implemented
   - See: `ARCHITECTURE_PIVOT_PLAN.md` (lines 514-522), `DEPLOYMENT_CHECKLIST.md` (lines 75-78)

---

## Entry points and run commands

### Mobile App (Primary Product)

**Entry Point**: `mobile/index.ts`
```typescript
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

**Main Component**: `mobile/App.tsx` ✅ VERIFIED: `mobile/App.tsx:19-124`
- Initializes navigation based on auth state ✅ VERIFIED: `mobile/App.tsx:111-122`
- Checks session and profile completion ✅ VERIFIED: `mobile/App.tsx:26-52` checks session and `completion_pct >= 100`
- Routes to: `AuthNavigator`, `OnboardingNavigator`, or `MainNavigator` ✅ VERIFIED: `mobile/App.tsx:114-120`
- Handles deep linking for magic link auth ✅ VERIFIED: `mobile/App.tsx:80-95`

**Run Commands**:
```bash
cd mobile
npm install
# Create .env file with:
# EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
# EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
# EXPO_PUBLIC_APP_URL=https://chemirl.app

npm start              # Start Expo dev server
npm run ios            # Run on iOS (requires macOS)
npm run android        # Run on Android
npm run web            # Run on web (for testing)

# Production build
eas build --platform ios
eas build --platform android
```

**Navigation Flow**:
```
App.tsx (root)
├── AuthNavigator (if !session)
│   ├── WelcomeScreen
│   ├── LoginScreen
│   └── MagicLinkSentScreen
├── OnboardingNavigator (if session && !profileComplete)
│   ├── ProfileSetupScreen
│   └── PhotosScreen
└── MainNavigator (if session && profileComplete)
    ├── Discover (tab)
    ├── MatchesStack (tab)
    │   ├── MatchesList
    │   ├── MatchDetail
    │   ├── Propose
    │   └── Chat
    └── Profile (tab)
```

### Website (Marketing Site)

**Entry Point**: `web/src/app/page.tsx`
- Static Next.js page (no server-side rendering)
- Landing page with value proposition and CTA buttons

**Run Commands**:
```bash
cd web
npm install
npm run dev          # Development server (localhost:3000)
npm run build        # Build static site (output to out/)
npm start            # Serve built site (not typically used)

# Deploy (Vercel)
vercel               # Or connect GitHub repo to Vercel
```

**Pages**:
- `/` - Landing page (`web/src/app/page.tsx`)
- `/download` - Download/waitlist page (`web/src/app/download/page.tsx`)
- `/how-it-works` - How it works explanation (`web/src/app/how-it-works/page.tsx`)

**No API Routes**: All removed during pivot (see `LEGACY.md`)

---

## End-to-end data flow (primary pipeline)

### User Registration & Onboarding Flow

1. **Magic Link Auth** (`mobile/src/screens/auth/LoginScreen.tsx`)
   - User enters email
   - Calls `supabase.auth.signInWithOtp({ email })` (via `mobile/src/lib/auth.ts`)
   - Supabase sends magic link email
   - User clicks link → Deep link opens app
   - `App.tsx` handles deep link → `handleMagicLink()` sets session
   - Session stored in Expo SecureStore

2. **Profile Creation** (`mobile/src/screens/onboarding/ProfileSetupScreen.tsx`) ✅ VERIFIED: file exists
   - User enters headline (min 5 chars) and bio (min 20 chars) ✅ VERIFIED: `mobile/src/screens/onboarding/ProfileSetupScreen.tsx:31-38`
   - Data saved to `profiles` table (JSONB `prompts` field) ✅ VERIFIED: `mobile/src/screens/onboarding/ProfileSetupScreen.tsx:51-60`
   - `completion_pct` calculated and updated ✅ VERIFIED: `mobile/src/screens/onboarding/ProfileSetupScreen.tsx:59` sets `completion_pct: 50`

3. **Photo Upload** (`mobile/src/screens/onboarding/PhotosScreen.tsx`) ✅ VERIFIED: file exists
   - User selects photos via `expo-image-picker` ✅ VERIFIED: `mobile/src/screens/onboarding/PhotosScreen.tsx:20-29`
   - Photos uploaded to Supabase Storage bucket `profiles` ✅ VERIFIED: `mobile/src/screens/onboarding/PhotosScreen.tsx:49-54`
   - URLs stored in `profiles.photos` (JSONB array) ✅ VERIFIED: `mobile/src/screens/onboarding/PhotosScreen.tsx:82`
   - `completion_pct` updated to 100% when complete ✅ VERIFIED: `mobile/src/screens/onboarding/PhotosScreen.tsx:83` sets `completion_pct: updatedPhotos.length >= 1 ? 100 : 50`

4. **App Access**: Once `completion_pct >= 100`, user sees `MainNavigator` ✅ VERIFIED: `mobile/App.tsx:39` checks `profile.completion_pct >= 100`

### Discovery & Matching Flow

1. **Load Discovery Feed** (`mobile/src/screens/discover/DiscoverScreen.tsx`)
   ```typescript
   // Calls RPC function
   const { data } = await supabase.rpc('get_discovery_feed', {
     p_viewer: user.id,
     p_limit: 20,
   });
   ```
   - RPC function (`db/rls.sql` lines 257-299): ✅ VERIFIED
     - Selects profiles with `completion_pct >= 80` ✅ VERIFIED: `db/rls.sql:281`
     - Excludes users already liked or matched ✅ VERIFIED: `db/rls.sql:283-292`
     - Joins `scores_daily` for Action Speed, Profile Quality, Reliability ✅ VERIFIED: `db/rls.sql:279`
     - Orders by scores (descending) and `updated_at` ✅ VERIFIED: `db/rls.sql:293-297`
     - Returns: `user_id`, `headline`, `bio`, `availability_summary`, `action_speed`, `profile_quality`, `reliability` ✅ VERIFIED: `db/rls.sql:258-266`

2. **Display Cards** (`mobile/src/components/DiscoveryCardStack.tsx`)
   - Stack of swipeable cards
   - Shows photos, headline, bio, scores
   - Swipe right = like, swipe left = pass

3. **Like Action** (`mobile/src/screens/discover/DiscoverScreen.tsx` → `handleLike()`)
   ```typescript
   const { data } = await supabase.rpc('create_like_and_check_match', {
     p_liker: user.id,
     p_likee: userId,
   });
   ```
   - RPC function (`db/rls.sql` lines 302-371): ✅ VERIFIED
     - Inserts into `likes` table ✅ VERIFIED: `db/rls.sql:314-315`
     - Checks for mutual like ✅ VERIFIED: `db/rls.sql:336-339`
     - If mutual, creates match in `matches` table ✅ VERIFIED: `db/rls.sql:342-350`
     - Returns: `{ like_id, matched: boolean, match_id: UUID | null }` ✅ VERIFIED: `db/rls.sql:352-356`
   - If matched, shows `MatchModal` component
   - Removes user from feed

### Proposal & Confirmation Flow

1. **View Match** (`mobile/src/screens/matches/MatchDetailScreen.tsx`)
   - Fetches match details: `supabase.from('matches').select(...).eq('match_id', ...)`
   - Fetches proposals: `supabase.from('proposals').select(...).eq('match_id', ...)`
   - Fetches confirms: `supabase.from('confirms').select(...).eq('match_id', ...)`

2. **Create Proposal** (`mobile/src/screens/matches/ProposeScreen.tsx`)
   - User selects 2-3 time windows (within 7 days)
   - Validates: windows must be within 7 days of each other
   - User selects date types (array of strings)
   - User adds optional note
   - Creates proposal:
     ```typescript
     await supabase.from('proposals').insert({
       match_id,
       sender_id: user.id,
       windows: [...], // Array of {start: string, end: string}
       date_types: [...], // Array of strings
       note: string,
       expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
       status: 'active',
     });
     ```

3. **Confirm Proposal** (`mobile/src/components/ProposalCard.tsx` → `handleConfirm()`)
   - User selects one time window
   - Creates confirm:
     ```typescript
     await supabase.from('confirms').insert({
       proposal_id,
       match_id,
       confirmer_id: user.id,
       chosen_window: { start, end },
     });
     ```
   - Updates proposal status: `status = 'confirmed'`
   - Chat unlocks (check in `MatchDetailScreen`: if confirm exists, show chat button)

4. **Proposal Expiry** (NOT AUTOMATED - Current Limitation)
   - Client-side check: `new Date(proposal.expires_at) < new Date()` shows expired UI ✅ VERIFIED: `mobile/src/components/ProposalCard.tsx:17`
   - Status not automatically updated in database ✅ VERIFIED: No database trigger or cron job found
   - Would require cron job or database trigger (not implemented) ✅ VERIFIED: No such code exists

### Chat Flow

1. **Load Messages** (`mobile/src/screens/matches/ChatScreen.tsx`)
   ```typescript
   const { data } = await supabase
     .from('messages')
     .select('*')
     .eq('match_id', matchId)
     .order('created_at', { ascending: true });
   ```

2. **Subscribe to Realtime Updates**
   ```typescript
   const channel = supabase
     .channel(`match:${matchId}`)
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'messages',
       filter: `match_id=eq.${matchId}`,
     }, (payload) => {
       setMessages(prev => [...prev, payload.new as Message]);
     })
     .subscribe();
   ```

3. **Send Message**
   ```typescript
   await supabase.from('messages').insert({
     match_id,
     sender_id: user.id,
     content: messageText,
     bytes: new TextEncoder().encode(messageText).length,
   });
   ```
   - Realtime subscription triggers update for other user

### Scoring System

**Action Speed** (0-100, floor 50):
- Daily decay: -8/day (floor at 50)
- Bonus: +2 per like given (capped at +16/day)
- Event bonuses: Proposal response timing, first proposal timing
- Functions: `update_daily_action_speed()`, `apply_action_speed_bonus()` (see `db/scoring.sql`)

**Profile Quality** (0-100):
- Bayesian-smoothed Match Acceptance Rate (MAR)
- Formula: `(alpha0 + matches) / (alpha0 + beta0 + exposures)`
- Updated on match events
- Function: `update_profile_quality(p_user_id UUID)` (see `db/scoring.sql` lines 147-198)

**Reliability** (20-100, default 70):
- Event-based adjustments:
  - `went`: +5
  - `both_would_meet`: +5
  - `no_show`: -30
  - `honest_cancel_24h`: -1
  - `honest_cancel_under_24h`: -5
  - `cancel_no_reschedule`: -8
  - `late_15min`: -2
  - `safety_report`: -10
- Function: `update_reliability(p_user_id UUID, p_event_type TEXT, p_value NUMERIC)` (see `db/scoring.sql` lines 201-263)

**Daily Scoring**: Function `update_daily_action_speed()` exists but is NOT scheduled (would need cron job)

---

## Configuration and environment

### Mobile App Environment Variables

**File**: `mobile/.env` (not in repo, see `mobile/ENV_SETUP.md`)

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

**Loaded**: Via `process.env.EXPO_PUBLIC_*` in `mobile/src/lib/supabase/client.ts`

### Website Environment Variables

**File**: `web/.env.local` (optional, for build-time constants)

```env
NEXT_PUBLIC_APP_NAME=Chem IRL
NEXT_PUBLIC_DOMAIN=chemirl.app
NEXT_PUBLIC_APP_URL=https://chemirl.app
```

**Root Example**: `env.example` (contains all possible vars, many unused)

### Brand Configuration

**Mobile**: `mobile/src/config/brand.ts`
- `BRAND_COLORS` (primary, secondary, etc.)
- `BRAND` (name, tagline, description)

**Web**: `web/src/config/brand.ts` (same structure)

**Root**: `src/config/brand.ts` (exists but not used - leftover from old structure)

### Database Configuration

**Schema**: `db/schema.sql` (run in Supabase SQL Editor)
- Tables: `users`, `profiles`, `likes`, `matches`, `proposals`, `confirms`, `messages`, `scores_daily`, `surveys`, `purchases`, `credits_ledger`, `reports`, `enforcements`
- Types: ENUMs for gender, orientation, match_status, proposal_status, etc.

**RLS Policies**: `db/rls.sql` (run after schema)
- Row-level security on all tables
- Users can only see/modify their own data
- RPC functions use `SECURITY DEFINER` to bypass RLS for business logic

**Scoring Functions**: `db/scoring.sql`
- Action Speed, Profile Quality, Reliability functions

**KPI Views**: `db/kpi_views.sql` (analytics views)

**Setup Guide**: `DATABASE_SETUP.md`, `SUPABASE_SETUP.md`

### Runtime State Persistence

**Mobile App**:
- Auth tokens: Expo SecureStore (`mobile/src/lib/supabase/client.ts` uses custom adapter)
- No local database/cache (all data from Supabase)
- React state in components (not persisted)

**Website**:
- No state (static site)
- No cookies/localStorage (no auth/product code)

**Database**:
- All persistent state in Supabase PostgreSQL
- RLS ensures users only access their data
- Timestamps: `created_at`, `updated_at`, `last_active_at` (auto-updated)

---

## Caching, files, and artifacts

### Data Sources

**Supabase PostgreSQL**:
- Primary data store
- Direct queries via Supabase client
- RPC functions for complex queries

**Supabase Storage**:
- Photo storage: `profiles` bucket
- Photos referenced by URL in `profiles.photos` (JSONB array)
- Signed URLs for access (not explicitly implemented, may use public URLs)

**External APIs** (NOT IMPLEMENTED):
- Stripe (webhooks deferred)
- Postmark (webhooks deferred)
- PostHog (analytics not integrated)

### Caching Strategy

**Mobile App**: NO CACHING
- All data fetched fresh from Supabase
- Realtime subscriptions keep data current
- No offline support (would require local database like SQLite)

**Website**: NO CACHING
- Static export (HTML/CSS/JS pre-rendered)
- No API calls, no dynamic data

### Output Artifacts

**Mobile App Builds**:
- iOS: `.ipa` file (via EAS Build)
- Android: `.apk` or `.aab` file (via EAS Build)
- Development builds: Installed via TestFlight (iOS) or direct install (Android)

**Website Build**:
- `web/out/` directory (static files)
- Deployed to Vercel (or any static hosting)
- No server-side artifacts

**Database Migrations**:
- SQL files in `db/` at root (canonical source)
- Must be run manually in Supabase SQL Editor
- No migration runner/versioning system

### File Inputs

**Mobile App**:
- User photos: Selected via `expo-image-picker`
- Uploaded to Supabase Storage
- No local file storage

**Website**:
- Static assets: `web/public/` (SVG icons)
- No file uploads (static site)

---

## GUI overview (if applicable)

### Mobile App UI Stack

**Framework**: React Native (Expo SDK 54) ✅ VERIFIED: `mobile/package.json:17` shows `"expo": "~54.0.27"`
**Navigation**: React Navigation v7 (Bottom Tabs + Stack Navigator) ✅ VERIFIED: `mobile/package.json:13-15` shows `"@react-navigation/native": "^7.1.24"`
**Styling**: React Native StyleSheet (no UI library like NativeBase/Paper) ✅ VERIFIED: No UI library dependencies found
**State Management**: React hooks (useState, useEffect, useContext not used) ✅ VERIFIED: grep found no `useContext` usage in `mobile/src/`

**Screens**:

1. **Auth Flow** (`mobile/src/screens/auth/`)
   - `WelcomeScreen.tsx` - Landing/welcome message
   - `LoginScreen.tsx` - Email input, calls `sendMagicLink()`
   - `MagicLinkSentScreen.tsx` - Confirmation message

2. **Onboarding** (`mobile/src/screens/onboarding/`)
   - `ProfileSetupScreen.tsx` - Headline and bio inputs, validation
   - `PhotosScreen.tsx` - Photo picker, upload to Supabase Storage, max 6 photos

3. **Discovery** (`mobile/src/screens/discover/`)
   - `DiscoverScreen.tsx` - Main screen, calls RPC for feed, handles like action
   - Components: `DiscoveryCardStack.tsx`, `DiscoveryCard.tsx` - Swipeable cards

4. **Matches** (`mobile/src/screens/matches/`)
   - `MatchesScreen.tsx` - List of matches (pull-to-refresh)
   - `MatchDetailScreen.tsx` - Shows proposals, confirms, chat button
   - `ProposeScreen.tsx` - Form for creating proposal (2-3 time windows)
   - `ChatScreen.tsx` - Message list, input, realtime subscription
   - Components: `ProposalCard.tsx`, `MatchModal.tsx`

5. **Profile** (`mobile/src/screens/profile/`)
   - `ProfileScreen.tsx` - User's own profile display

**Components** (`mobile/src/components/`):
- `DiscoveryCard.tsx` - Individual profile card in stack
- `DiscoveryCardStack.tsx` - Swipeable stack container
- `MatchModal.tsx` - Modal shown when match occurs
- `ProposalCard.tsx` - Displays proposal, handles confirm action

**Interaction Model**:
- Swipe gestures for discovery cards (like/pass)
- Tap to navigate (matches list → match detail → chat/propose)
- Form inputs for proposals (time selection is placeholder - see limitations)
- Realtime updates for chat (Supabase subscriptions)

### Website UI

**Framework**: Next.js 16 (Static Export) ✅ VERIFIED: `web/package.json:12` shows `"next": "^16.0.7"`, `web/next.config.ts:5` shows `output: 'export'`
**Styling**: Tailwind CSS 4 ✅ VERIFIED: `web/package.json:23` shows `"tailwindcss": "^4"`
**No JavaScript Framework**: Server Components (but static, so pre-rendered HTML)

**Pages**:
- `/` - Landing page (hero, how-it-works, features)
- `/download` - Download links / waitlist
- `/how-it-works` - Step-by-step explanation

**No Product UI**: All removed during pivot (see `LEGACY.md`)

---

## Tests and tooling

### Tests

**Mobile App**: NO TESTS
- No test files found
- No test framework configured
- TypeScript compilation checked manually: `npx tsc --noEmit`

**Website**: NO TESTS
- No test files found
- Build verification: `npm run build`

### Linting

**Mobile App**: NO LINTER CONFIGURED
- No ESLint config in `mobile/`
- No Prettier config

**Website**: ESLint (Next.js default)
- Config: `web/eslint.config.mjs` (Next.js default)
- Run: `npm run lint` (defined in `web/package.json`)

**Root**: ESLint config exists (`eslint.config.mjs`) but unused

### Type Checking

**Mobile App**: TypeScript
- Config: `mobile/tsconfig.json`
- Check manually: `npx tsc --noEmit`
- All files use TypeScript (.tsx, .ts)

**Website**: TypeScript
- Config: `web/tsconfig.json`
- Check via build: `npm run build`
- All files use TypeScript (.tsx, .ts)

### Build Tools

**Mobile App**:
- Expo CLI: Development server, bundling
- EAS Build: Production builds (iOS/Android)
- Metro: Bundler (React Native standard)

**Website**:
- Next.js: Build tool (static export)
- PostCSS: CSS processing (Tailwind)

### Development Tools

**Mobile App**:
- Expo Go: Testing (but has known issue with new architecture - see `mobile/KNOWN_ISSUE_NEW_ARCH.md`)
- Development Builds: Recommended for testing (EAS Build)
- React Native Debugger: Not configured

**Website**:
- Next.js Dev Server: `npm run dev`
- Browser DevTools: Standard web development

---

## Current state / known issues

### What Appears Complete and Stable

✅ **Mobile App Core Features** (Per `PHASE2_COMPLETE.md`, `POLISH_COMPLETE.md`):
- Auth flow (magic link with deep linking)
- Profile creation and photo upload
- Discovery feed (RPC function, card stack UI)
- Like/Match system (RPC function, match modal)
- Proposals (create, display, confirm)
- Chat (realtime subscriptions, message sending)
- Navigation structure (auth → onboarding → main tabs)

✅ **Database Schema**:
- All tables defined (`db/schema.sql`)
- RLS policies implemented (`db/rls.sql`)
- RPC functions for discovery, matching, scoring (`db/rls.sql`, `db/scoring.sql`)
- Indexes for performance

✅ **Website**:
- Static export working
- Marketing pages (landing, download, how-it-works)
- No product code (clean separation)

✅ **Code Quality**:
- TypeScript throughout
- Type definitions (`mobile/src/lib/types.ts`)
- Error handling in key flows
- Validation (profile fields, proposal time windows)

### What Appears Incomplete, Fragile, or Inconsistent

⚠️ **Proposal Expiry Not Automated**: ✅ VERIFIED
- Proposals have `expires_at` field and `status` field ✅ VERIFIED: `db/schema.sql:73-74`
- Client checks expiry: `new Date(proposal.expires_at) < new Date()` ✅ VERIFIED: `mobile/src/components/ProposalCard.tsx:17`
- Database status NOT automatically updated to 'expired' ✅ VERIFIED: No database trigger or cron job found
- Would require:
  - Database trigger, OR
  - Cron job calling SQL to update expired proposals
- Currently: Expired proposals show expired UI but status remains 'active' in DB

⚠️ **Daily Scoring Not Scheduled**: ✅ VERIFIED
- Function `update_daily_action_speed()` exists ✅ VERIFIED: `db/scoring.sql:5-60`
- NOT called automatically (no cron job) ✅ VERIFIED: No scheduled job or cron configuration found
- Would require:
  - Supabase Edge Function scheduled via pg_cron, OR
  - External cron job (Vercel Cron, etc.)
- Currently: Action Speed scores don't decay daily unless manually triggered

⚠️ **No Webhook Handlers**:
- Stripe webhooks: Mentioned in docs (`DEPLOYMENT_CHECKLIST.md` line 64) but NOT implemented
- Postmark webhooks: Not implemented
- Would need: Supabase Edge Functions or separate serverless functions
- Currently: Payments/email webhooks cannot be processed

⚠️ **No Payment Integration in Mobile**:
- Stripe mentioned in architecture docs
- No Stripe SDK in mobile app dependencies
- No checkout flow in mobile app code
- Credits system exists in schema (`purchases`, `credits_ledger`) but no UI

⚠️ **Time Selection Placeholder**:
- `ProposeScreen.tsx` has time selection UI but uses placeholder/generated times
- Docs mention: "Replace placeholder with proper picker component" (`POLISH_COMPLETE.md` line 53)
- Currently: Time windows are generated programmatically, not user-selected

⚠️ **No Profile Editing**:
- Profile created once during onboarding
- No edit screen in `mobile/src/screens/profile/ProfileScreen.tsx`
- User cannot update headline, bio, or photos after creation

⚠️ **No Settings Screen**:
- Profile screen exists but no settings
- Cannot change preferences, delete account, export data from mobile app
- Account deletion/data export mentioned in architecture but not implemented in mobile

⚠️ **Expo Go Compatibility Issue**:
- Known bug with React Navigation v7 + new architecture in Expo Go
- Documented: `mobile/KNOWN_ISSUE_NEW_ARCH.md`
- Workaround: Use development build instead of Expo Go
- Status: Code is correct, Expo Go has the bug

⚠️ **No Error Reporting/Analytics**:
- PostHog mentioned in env.example but not integrated
- Sentry mentioned in env.example but not integrated
- No error tracking/logging service configured

✅ **Database Files Consolidated**:
- `db/` directory at root (canonical source)
- `web/db/` removed (was duplicate)
- All SQL files in `db/`: `schema.sql`, `rls.sql`, `scoring.sql`, `kpi_views.sql`

✅ **Root `src/` Directory Removed**: ✅ COMPLETED
- Root `src/` directory was unused (web uses `web/src/`, mobile uses `mobile/src/`)
- Removed root `src/app/` and `src/config/` directories
- No longer causes confusion - clean separation maintained

### Obvious Bugs, TODOs, Dead Code

**TODOs Found**:
- `POLISH_COMPLETE.md` lines 52-59: Lists optional enhancements (date picker, photo gallery, push notifications, offline support, image optimization, analytics, error reporting)

**Dead Code**:
- Root `src/` directory (unused, leftover from old structure)
- Root `package.json`, `next.config.ts`, `tsconfig.json` (unused, should use `web/` versions)
- `public/` directory at root (unused, website uses `web/public/`)

**Inconsistencies**:
- Database files consolidated in `db/` at root
- Brand config duplicated (`src/config/brand.ts`, `mobile/src/config/brand.ts`, `web/src/config/brand.ts`)
- Env example at root includes many unused variables

### Mismatch Between Docs and Code

❌ **DEPLOYMENT_CHECKLIST.md Claims Webhooks/Cron**:
- Lines 64-78 mention Stripe webhooks, cron jobs (`/api/scoring/daily`, `/api/reminders/send`)
- But these API routes don't exist (removed during pivot, see `LEGACY.md`)
- Docs should be updated to reflect: "Deferred - implement as Edge Functions"

❌ **ARCHITECTURE_PIVOT_PLAN.md Mentions RPC Functions Not Found**: ✅ VERIFIED
- Line 497: `update_action_speed(p_user_id UUID, p_event_type TEXT, p_metadata JSONB)` - Function not found with this signature ✅ VERIFIED: No function with this name/signature exists in `db/scoring.sql` (only `update_daily_action_speed()` and `apply_action_speed_bonus()` exist)
- Line 498: `update_profile_quality(p_user_id UUID, p_event_type TEXT, p_metadata JSONB)` - WRONG SIGNATURE ✅ VERIFIED: `db/scoring.sql:147` shows `update_profile_quality(p_user_id UUID)` (only one param)
- Actual function: `update_profile_quality(p_user_id UUID)` ✅ VERIFIED: `db/scoring.sql:147`
- Line 499: `update_reliability(p_user_id UUID, p_event_type TEXT, p_metadata JSONB)` - WRONG SIGNATURE ✅ VERIFIED: `db/scoring.sql:201-204` shows different signature
- Actual function: `update_reliability(p_user_id UUID, p_event_type TEXT, p_value NUMERIC DEFAULT 0)` ✅ VERIFIED: `db/scoring.sql:201-204`

✅ **README.md Accurate**: Claims MVP complete, matches code state

---

## Quick start (copy-paste commands)

### Prerequisites

- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli` (or use npx)
- Supabase account and project
- Git

### Mobile App Setup

```bash
# Clone repo
git clone <repo-url>
cd chem-irl

# Setup mobile app
cd mobile
npm install

# Create .env file (copy from mobile/ENV_SETUP.md or create manually)
cat > .env << EOF
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
EXPO_PUBLIC_APP_URL=https://chemirl.app
EOF

# Start development server
npm start

# In another terminal, run on device:
# - Scan QR code with Expo Go (iOS/Android)
# - OR use: npm run ios (macOS) or npm run android
```

**Note**: If Expo Go shows navigation error, use development build instead (see `mobile/KNOWN_ISSUE_NEW_ARCH.md`)

### Website Setup

```bash
# From repo root
cd web
npm install

# Development
npm run dev
# Visit http://localhost:3000

# Build static site
npm run build
# Output in web/out/
```

### Database Setup

```bash
# 1. Create Supabase project at https://supabase.com
# 2. Run SQL files in Supabase SQL Editor (in order):

# Schema
# Copy contents of db/schema.sql → Run in Supabase SQL Editor

# RLS Policies
# Copy contents of db/rls.sql → Run in Supabase SQL Editor

# Scoring Functions
# Copy contents of db/scoring.sql → Run in Supabase SQL Editor

# KPI Views (optional)
# Copy contents of db/kpi_views.sql → Run in Supabase SQL Editor

# 3. Configure Supabase Auth:
# - Site URL: https://chemirl.app (or your domain)
# - Redirect URLs: chemirl://auth/callback (for mobile deep linking)

# 4. Create Storage bucket:
# - Bucket name: profiles
# - Public: false (or true if using signed URLs)
```

### Common Troubleshooting

**Mobile App Won't Connect to Supabase**:
- Check `.env` file exists and has correct values
- Verify Supabase project URL and anon key
- Check network connectivity (Supabase allows CORS from localhost/Expo)

**Expo Go Navigation Error**:
- See `mobile/KNOWN_ISSUE_NEW_ARCH.md`
- Solution: Build development build with EAS instead of using Expo Go

**Database RLS Errors**:
- Verify RLS policies are installed (`db/rls.sql`)
- Check user is authenticated (`supabase.auth.getUser()`)
- Verify user_id matches `auth.uid()` in RLS policies

**Proposal Expiry Not Working**:
- Known limitation: Expiry is client-side only
- Database status not updated automatically
- See "Current state / known issues" section

**TypeScript Errors**:
- Mobile: `cd mobile && npx tsc --noEmit`
- Web: `cd web && npm run build`
- Check `tsconfig.json` paths and includes

---

## Recommended next cleanups (only based on evidence in code)

### High Priority

1. **Remove Duplicate Database Files**:
   - ✅ COMPLETED: Removed `web/db/` directory, kept `db/` at root as canonical source
   - ✅ COMPLETED: Updated all docs to reference `db/` instead of `web/db/`
   - **Evidence**: Same files in both locations, risk of inconsistency

2. **Clean Up Root Directory**:
   - Delete `src/` at root (unused, leftover from old structure)
   - Delete `public/` at root (unused, website uses `web/public/`)
   - Delete root `package.json`, `next.config.ts`, `tsconfig.json` (unused, use `web/` versions)
   - **Evidence**: Root `src/app/page.tsx` exists but not used, mobile uses `mobile/src/`, web uses `web/src/`

3. **Update DEPLOYMENT_CHECKLIST.md**:
   - Remove references to API routes that don't exist (`/api/scoring/daily`, `/api/reminders/send`, `/api/webhooks/stripe`)
   - Add note: "Webhooks/cron deferred - implement as Supabase Edge Functions when needed"
   - **Evidence**: `LEGACY.md` confirms API routes removed, docs still reference them

4. **Fix ARCHITECTURE_PIVOT_PLAN.md RPC Function Signatures**:
   - Correct `update_profile_quality` signature (remove event_type/metadata params)
   - Correct `update_reliability` signature (p_value NUMERIC, not p_metadata JSONB)
   - **Evidence**: Actual functions in `db/scoring.sql` have different signatures

### Medium Priority

5. **Implement Proposal Expiry Automation**:
   - Option A: Database trigger on `proposals` table to update status when `expires_at < NOW()`
   - Option B: Supabase Edge Function scheduled via pg_cron
   - **Evidence**: Client checks expiry but DB status not updated (see `mobile/src/components/ProposalCard.tsx`)

6. **Consolidate Brand Config**:
   - Keep one source of truth (e.g., `mobile/src/config/brand.ts`)
   - Copy to web during build, or use shared package
   - **Evidence**: Brand config duplicated in 3 locations (`src/config/brand.ts`, `mobile/src/config/brand.ts`, `web/src/config/brand.ts`)

7. **Add Type Checking to Build Process**:
   - Mobile: Add `"type-check": "tsc --noEmit"` to `package.json` scripts
   - Run in CI/pre-commit hook
   - **Evidence**: No automated type checking, only manual

### Low Priority

8. **Document Missing Features**:
   - Create `MISSING_FEATURES.md` listing: proposal expiry automation, daily scoring cron, webhooks, payment integration, profile editing, settings screen
   - Link from README
   - **Evidence**: Features mentioned in architecture/docs but not implemented

9. **Add Test Structure**:
   - Setup Jest for mobile app
   - Add at least smoke tests for critical flows (auth, like/match, proposal)
   - **Evidence**: No tests currently, risky for production

10. **Simplify env.example**:
    - Remove unused variables (Stripe, Postmark, PostHog, Sentry)
    - Keep only variables actually used
    - Split into `mobile/.env.example` and `web/.env.example`
    - **Evidence**: Root `env.example` has many unused vars

---

## Safety rails

### Data Loss Risks

⚠️ **No Backup Strategy Documented**:
- Database backups: Supabase handles automatic backups, but no restore procedure documented
- Photo storage: No backup strategy for Supabase Storage
- Code backups: Git repository (assumed, not verified)

⚠️ **Account Deletion**:
- Schema has `ON DELETE CASCADE` on foreign keys (see `db/schema.sql`)
- If user deleted, related data (likes, matches, proposals, messages) cascades
- No UI for account deletion in mobile app (mentioned in architecture but not implemented)
- **Risk**: Manual deletion via SQL could accidentally cascade-delete related data

⚠️ **Photo Deletion**:
- Photos stored in Supabase Storage
- If profile deleted, photos should be deleted (no automatic cleanup documented)
- **Risk**: Orphaned photos in storage bucket

### File Overwrite Risks

✅ **Safe**: Mobile app uses Supabase (no local file writes)
✅ **Safe**: Website is static (no file writes)
✅ **Safe**: Build outputs go to `out/` or build directories (not overwriting source)

### Network Calls

⚠️ **Supabase Calls**:
- All network calls go to Supabase (controlled by RLS)
- No rate limiting implemented (Supabase has defaults)
- **Risk**: If RLS misconfigured, users could access other users' data

⚠️ **External APIs**:
- Stripe, Postmark, PostHog mentioned but NOT implemented
- No network calls to external APIs currently

### Action Execution Risks

⚠️ **Database Modifications**:
- Mobile app directly inserts/updates Supabase tables
- RLS policies prevent unauthorized access, but bugs in RPC functions could cause data corruption
- **Risk**: `SECURITY DEFINER` functions bypass RLS (intentional, but needs careful review)

⚠️ **Match Creation**:
- Automatic match creation on mutual like (RPC function `create_like_and_check_match`)
- **Risk**: If function has bug, matches might not be created or created incorrectly

⚠️ **Scoring Updates**:
- Scoring functions modify `scores_daily` table
- **Risk**: Bugs could corrupt user scores (affects discovery feed ranking)

### Cost Risks

⚠️ **Supabase Usage**:
- Database queries, storage, realtime subscriptions all have costs
- No usage monitoring/alerts configured
- **Risk**: High usage could incur unexpected costs

⚠️ **No Rate Limiting**:
- Mobile app makes unlimited API calls to Supabase
- **Risk**: Buggy code could cause excessive API calls (costs)

⚠️ **Stripe Webhooks Not Implemented**:
- Payment processing mentioned but not implemented
- **Risk**: When implemented, webhook handling must be secure to prevent fraud

### Production Readiness Gaps

❌ **No Error Monitoring**: Sentry/error tracking not configured
❌ **No Analytics**: PostHog not integrated
❌ **No Logging**: No centralized logging system
❌ **No Health Checks**: No endpoint to check system health
❌ **No Alerts**: No alerts for errors, high usage, or downtime

---

## Summary

**Project Status**: Mobile app MVP is functionally complete for core user flows (auth, discovery, matching, proposals, chat), but missing production infrastructure (webhooks, cron jobs, monitoring). Website is a clean static marketing site.

**Architecture**: App-first with direct Supabase connection (no API layer). Database schema and RLS policies are solid. RPC functions handle complex business logic.

**Main Gaps**: 
1. Proposal expiry automation (client-side only)
2. Daily scoring cron job (function exists, not scheduled)
3. Webhook handlers (Stripe, Postmark - not implemented)
4. Payment integration (no Stripe SDK/UI in mobile)
5. Production observability (no error tracking, analytics, logging)

**Next Steps**: See "Recommended next cleanups" section for specific actionable items.

