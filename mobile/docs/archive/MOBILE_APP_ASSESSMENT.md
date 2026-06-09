# Mobile App Assessment Report

**Generated:** 2025-01-28  
**Scope:** `mobile/` directory (React Native/Expo app)  
**Assessment Type:** Functional audit and gap analysis for MVP → Beta → Production roadmap

---

## A) App Overview

### What the app does today

Chem IRL is a React Native dating app that enables users to discover potential matches, propose 2-3 specific time windows for dates within 7 days, and chat after mutual confirmation. The app uses passwordless authentication via magic links, requires profile completion (headline, bio, photos) before accessing the main feed, and enforces structured proposal mechanics where proposals expire after 72 hours.

**Core user journey:**

1. User opens app → Welcome screen → Enters email → Receives magic link → Clicks link → Authenticated
2. Onboarding: User enters headline (min 5 chars) and bio (min 20 chars) → Uploads 1-6 photos → Profile complete (completion_pct >= 100)
3. Discovery: Swipeable card stack showing potential matches from `get_discovery_feed` RPC → Swipe right (like) or left (pass) → On mutual like, match created
4. Matches: View list of matches → Open match detail → View/respond to proposals or create new proposal (2-3 time windows, 1-3 date types, optional note)
5. Proposals: Receiver can confirm a window or respond "none suit" → After confirmation, chat unlocks
6. Chat: Real-time messaging via Supabase Realtime subscriptions
7. Profile: Edit headline/bio, upload/delete photos (with storage cleanup), sign out

**Architecture pattern:** Direct Supabase client connection with RLS policies. No API layer. Session tokens stored in encrypted LargeSecureStore (AES-256 + SecureStore + AsyncStorage).

### Current maturity level

**MVP with hardening gaps.** The core features are implemented and functional, but several production-readiness concerns remain:

- ✅ Authentication, onboarding, discovery, matching, proposals, chat, profile editing are working
- ⚠️ Error handling is centralized but inconsistent usage across screens
- ⚠️ Offline handling is minimal (no queue for messages/proposals when offline)
- ⚠️ No push notifications
- ⚠️ Performance optimizations missing (no list virtualization, image caching, pagination)
- ⚠️ Analytics/logging incomplete (Sentry scaffold exists but not fully integrated)
- ⚠️ Testing infrastructure exists (Jest unit tests) but coverage is minimal

**Verdict:** **MVP-ready for limited beta testing**, but requires hardening before production launch.

---

## B) Repo Map (mobile)

**Mobile root:** `mobile/` (confirmed by presence of `app.json`, `eas.json`, `package.json`, `index.ts`)

### Key directories and files

#### Root configuration

- `app.json` (lines 1-43): Expo config, app scheme `chemirl`, plugins (image-picker, datetimepicker, sentry)
- `eas.json` (lines 1-37): EAS build profiles (development, preview, production)
- `package.json` (lines 1-88): Dependencies, scripts (test:unit, check:env, use:staging, verify:staging)
- `index.ts` (lines 1-26): Entry point, Sentry initialization (conditional on `EXPO_PUBLIC_SENTRY_DSN`)
- `babel.config.js`: Babel configuration with Flow/TypeScript transforms
- `tsconfig.json`: TypeScript configuration

#### Source structure (`src/`)

**`src/navigation/`** - Navigation configuration

- `AuthNavigator.tsx` (lines 1-26): Stack for Welcome → Login → MagicLinkSent
- `OnboardingNavigator.tsx` (lines 1-23): Stack for ProfileSetup → Photos
- `MainNavigator.tsx` (lines 1-91): Tab navigator (Discover, MatchesStack, Profile, Debug [dev-only])
  - MatchesStack: Nested stack (MatchesList → MatchDetail → Propose → Chat)

**`src/screens/`** - Screen components

_Auth flow:_

- `auth/WelcomeScreen.tsx`: Landing page with "Get Started" button
- `auth/LoginScreen.tsx` (lines 1-136): Email input, sends magic link via `sendMagicLink()`
- `auth/MagicLinkSentScreen.tsx`: Confirmation message

_Onboarding:_

- `onboarding/ProfileSetupScreen.tsx` (lines 1-191): Headline/bio input, validates min lengths, upserts to `profiles` table
- `onboarding/PhotosScreen.tsx` (lines 1-240): Photo upload (1-6 photos), loads existing photos on mount

_Main app:_

- `discover/DiscoverScreen.tsx` (lines 1-188): Loads feed via RPC `get_discovery_feed`, handles like/pass, shows match modal
- `matches/MatchesScreen.tsx` (lines 1-230): Lists matches from `matches` table, fetches profile photos/headlines
- `matches/MatchDetailScreen.tsx` (lines 1-269): Shows match info, proposals, confirms, navigation to Propose/Chat
- `matches/ProposeScreen.tsx` (lines 1-623): Date/time picker (2-3 windows, within 7 days, no overlaps), date types (1-3), note, inserts to `proposals` table
- `matches/ChatScreen.tsx` (lines 1-282): Real-time chat via Supabase Realtime subscription on `messages` table
- `profile/ProfileScreen.tsx` (lines 1-513): Edit headline/bio, upload/delete photos (with storage cleanup), photo reconciliation, sign out

_Dev tools:_

- `debug/DebugScreen.tsx` (lines 1-317): Dev-only (gated by `__DEV__` or `EXPO_PUBLIC_ENABLE_DEBUG_MENU`), shows user info, clear cache, reset onboarding, sign out

**`src/components/`** - Reusable components

- `DiscoveryCard.tsx`: Individual profile card (headline, bio, photos, placeholder image)
- `DiscoveryCardStack.tsx` (lines 1-151): Swipeable card stack using PanResponder
- `MatchModal.tsx` (lines 1-112): Match notification modal
- `ProposalCard.tsx` (lines 1-179): Displays proposal, handles confirm/none suits

**`src/lib/`** - Utilities and services

_Supabase:_

- `supabase/client.ts` (lines 1-71): Supabase client initialization with `LargeSecureStore` for encrypted session storage

_Auth:_

- `auth.ts` (lines 1-57): `handleMagicLink()` (parses deep link, sets session), `sendMagicLink()` (sends OTP email)

_Storage:_

- `storage.ts` (lines 1-100): `extractStoragePathFromUrl()`, `validatePathOwnership()`, `deletePhotoFromStorage()`

_Reconciliation:_

- `reconcilePhotos.ts` (lines 1-130): Checks if photo URLs point to existing storage objects, caches reconciliation timestamp (24h), prompts user to remove broken photos

_Error handling:_

- `errors.ts` (lines 1-90): `getErrorAlert()`, `getUserErrorMessage()`, `formatError()`, `isRecoverableError()`, Sentry integration (lazy import)

_Types:_

- `types.ts` (lines 1-94): TypeScript interfaces matching Supabase schema (User, Profile, FeedItem, Match, Proposal, Confirm, Message)

**`src/config/`** - Configuration

- `brand.ts`: Brand colors, tagline, description constants

**`src/assets/`** - Static assets

- `icon.png`, `splash-icon.png`, `adaptive-icon.png`, `favicon.png`, `placeholder-profile.png`

#### Scripts (`scripts/`)

- `checkEnv.ts`: Validates required env vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY`)
- `switchEnv.ts`: Switches between `.env.staging` and `.env.production`
- `verifySupabase.ts`: Verifies Supabase setup (tables, RPCs, storage buckets) using service role key from `.env.seed`
- `printTwoDeviceWorkflow.ts`: Prints testing workflow instructions
- `newTestRunLog.ts`: Generates prefilled test run log with git commit hash

#### Documentation (`docs/`)

- `INSTALL_ON_PHONES.md`: Installation guide (Expo Go vs EAS dev build)
- `SUPABASE_STAGING_SETUP.md`: Staging environment setup
- `TWO_DEVICE_TEST_PLAN.md`: Two-device testing checklist
- `RELEASE_CHECKLIST.md`: Pre-build verification steps
- `README.md`: Mobile app documentation index
- `archive/`: Historical implementation summaries

#### Tests (`src/lib/__tests__/`)

- `auth.test.ts`: Tests for `handleMagicLink()` and `sendMagicLink()`
- `storage.test.ts`: Tests for storage path extraction and ownership validation
- `reconcilePhotos.test.ts`: Tests for photo reconciliation logic
- `supabase-client.test.ts`: Tests for Supabase client initialization
- `types.test.ts`: Type validation tests

---

## C) Run & Build Reality Check

### Exact commands in `mobile/package.json` (lines 5-24)

**Development:**

- `npm start` → `expo start` (Expo dev server)
- `npm run android` → `expo start --android`
- `npm run ios` → `expo start --ios`
- `npm run web` → `expo start --web`

**Quality:**

- `npm run type-check` → `tsc --noEmit` (TypeScript type checking)
- `npm run lint` → `eslint . --ext .ts,.tsx`
- `npm run lint:fix` → `eslint . --ext .ts,.tsx --fix`
- `npm run format` → `prettier --write "**/*.{ts,tsx,js,jsx,json,md}"`
- `npm run format:check` → `prettier --check "**/*.{ts,tsx,js,jsx,json,md}"`

**Testing:**

- `npm test` → `npm run test:unit` (default)
- `npm run test:unit` → `jest -c jest.unit.config.js` (unit tests in Node environment)
- `npm run test:native` → `jest -c jest.native.config.js` (React Native component tests)

**Environment management:**

- `npm run check:env` → `tsx scripts/checkEnv.ts` (validates env vars, runs as `prebuild` hook)
- `npm run use:staging` → `tsx scripts/switchEnv.ts staging` (switches to staging env)
- `npm run use:production` → `tsx scripts/switchEnv.ts production` (switches to production env)
- `npm run verify:staging` → `tsx scripts/verifySupabase.ts` (verifies Supabase setup)

**Testing workflow:**

- `npm run test:two-device` → `tsx scripts/printTwoDeviceWorkflow.ts`
- `npm run test:log:new` → `tsx scripts/newTestRunLog.ts`

### Environment variables

**Required (read in `src/lib/supabase/client.ts` lines 7-8):**

- `EXPO_PUBLIC_SUPABASE_URL`: Supabase project URL
- `EXPO_PUBLIC_SUPABASE_KEY`: Supabase anon/public publishable key

**Optional (read in `index.ts` lines 5, 12, 15):**

- `EXPO_PUBLIC_SENTRY_DSN`: Sentry DSN for error logging
- `EXPO_PUBLIC_ENVIRONMENT`: Environment name (defaults to 'development', Sentry only enabled if 'production')

**Optional (read in `src/navigation/MainNavigator.tsx` line 11):**

- `EXPO_PUBLIC_ENABLE_DEBUG_MENU`: Enable debug screen in production (if `'true'`)

**Environment files:**

- `.env` or `.env.local`: Loaded by Expo (Expo automatically loads `.env` files)
- `.env.staging`: Example staging env (not loaded automatically, used by `use:staging` script)
- `.env.production`: Example production env (not loaded automatically, used by `use:production` script)
- `.env.seed`: Service role key for verification scripts (gitignored, never used in app)

**Evidence:** `src/lib/supabase/client.ts` lines 7-8 use `process.env.EXPO_PUBLIC_SUPABASE_URL!` and `process.env.EXPO_PUBLIC_SUPABASE_KEY!`. Expo inlines `EXPO_PUBLIC_*` vars at build time.

### Expo Go vs Dev Client vs Production build

**Expo Go support:** ✅ **Supported** (no custom native modules required for core features)

- Evidence: `app.json` plugins are Expo Go-compatible (image-picker, datetimepicker, sentry can work with Expo Go in some cases)
- Limitations: Sentry native crash reporting may be limited in Expo Go, deep linking works but may require manual configuration

**EAS Dev Client support:** ✅ **Supported** (recommended for full feature testing)

- Evidence: `eas.json` has `development` profile (lines 6-14) with `developmentClient: true`
- Benefits: Full native module support, better deep linking, production-like experience

**Production build support:** ✅ **Supported**

- Evidence: `eas.json` has `production` profile (lines 25-31), `submit` section for App Store/Play Store
- Build commands: `eas build --profile production --platform ios/android`

**Native module usage:**

- `expo-image-picker`: ✅ Works in Expo Go, better in dev client
- `@react-native-community/datetimepicker`: ✅ Works in Expo Go
- `@sentry/react-native`: ⚠️ Limited in Expo Go, full support in dev client/production
- `expo-secure-store`: ✅ Works in Expo Go
- `@react-native-async-storage/async-storage`: ✅ Works in Expo Go

---

## D) Feature Inventory

| Feature                        | Entry Point                                        | File Path(s)                                                                                                | Backend Dependency                                                                               | Status         | Evidence                                                                                                                          | Risks                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Magic Link Auth**            | `WelcomeScreen` → `LoginScreen`                    | `src/screens/auth/LoginScreen.tsx` (lines 24-49), `src/lib/auth.ts` (lines 40-57)                           | Supabase Auth (`signInWithOtp`)                                                                  | ✅ Implemented | `sendMagicLink()` calls `supabase.auth.signInWithOtp()` with email redirect URL `chemirl:///auth/callback`                        | Deep link handler may fail silently if URL parsing fails                                                                                               |
| **Deep Link Handling**         | `App.tsx` on mount and URL listener                | `App.tsx` (lines 91-105), `src/lib/auth.ts` (lines 8-35)                                                    | Supabase Auth (`setSession`)                                                                     | ✅ Implemented | `handleMagicLink()` parses `access_token`/`refresh_token` from URL, calls `supabase.auth.setSession()`                            | URL format must match exactly `chemirl:///auth/callback` (triple slash), no error UI if parsing fails                                                  |
| **Session Persistence**        | `App.tsx` on mount                                 | `src/lib/supabase/client.ts` (lines 64-71), `App.tsx` (lines 34-62)                                         | `LargeSecureStore` (encrypted AsyncStorage + SecureStore)                                        | ✅ Implemented | Supabase client uses `LargeSecureStore` for `persistSession: true`, `autoRefreshToken: true`                                      | Encryption key stored in SecureStore; if SecureStore fails, session may not persist                                                                    |
| **Profile Completion Gating**  | `App.tsx` conditional render                       | `App.tsx` (lines 39-56, 126-132)                                                                            | `profiles` table (`completion_pct` column)                                                       | ✅ Implemented | Checks `profile.completion_pct >= 100` to determine if onboarding is complete                                                     | No retry logic if profile fetch fails; user stuck on loading screen                                                                                    |
| **Profile Setup (Onboarding)** | `OnboardingNavigator` → `ProfileSetupScreen`       | `src/screens/onboarding/ProfileSetupScreen.tsx` (lines 34-86)                                               | `profiles` table (UPSERT with `prompts.headline`, `prompts.bio`, `completion_pct: 50`)           | ✅ Implemented | Validates headline >= 5 chars, bio >= 20 chars, upserts to `profiles`                                                             | No network retry; if upsert fails, user must retry manually                                                                                            |
| **Photo Upload (Onboarding)**  | `OnboardingNavigator` → `PhotosScreen`             | `src/screens/onboarding/PhotosScreen.tsx` (lines 48-133)                                                    | `profiles` storage bucket (upload), `profiles` table (UPSERT with `photos` array)                | ✅ Implemented | Uploads to `storage.from('profiles').upload()`, updates `profiles.photos` array, sets `completion_pct: 100` if photos.length >= 1 | No progress indicator for large images; no compression before upload; photo order not preserved on reload                                              |
| **Discovery Feed**             | `MainNavigator` → `DiscoverScreen`                 | `src/screens/discover/DiscoverScreen.tsx` (lines 22-77)                                                     | RPC `get_discovery_feed(p_viewer, p_limit: 20)`, `profiles` table (SELECT `photos`)              | ✅ Implemented | Calls `supabase.rpc('get_discovery_feed')`, then fetches photos for each item separately                                          | N+1 query pattern (1 RPC + N profile queries); no pagination; feed doesn't refresh automatically                                                       |
| **Swipe Gestures**             | `DiscoverScreen` → `DiscoveryCardStack`            | `src/components/DiscoveryCardStack.tsx` (lines 25-101)                                                      | None (client-side only)                                                                          | ✅ Implemented | Uses `PanResponder` with threshold 120px; animates card off screen on swipe                                                       | No haptic feedback; animation may lag on slower devices                                                                                                |
| **Like User**                  | `DiscoverScreen.handleLike()`                      | `src/screens/discover/DiscoverScreen.tsx` (lines 79-111)                                                    | RPC `create_like_and_check_match(p_liker, p_likee)`                                              | ✅ Implemented | Calls RPC, checks `data.matched` and `data.match_id`, shows `MatchModal` if matched                                               | No optimistic UI; if RPC fails, card stays in feed; no retry                                                                                           |
| **Pass User**                  | `DiscoverScreen.handlePass()`                      | `src/screens/discover/DiscoverScreen.tsx` (lines 113-116)                                                   | None (client-side only)                                                                          | ✅ Implemented | Removes card from local state                                                                                                     | No server-side "pass" record; user may see same person again if feed refreshes                                                                         |
| **Matches List**               | `MainNavigator` → `MatchesStack` → `MatchesScreen` | `src/screens/matches/MatchesScreen.tsx` (lines 51-109)                                                      | `matches` table (SELECT with RLS filter), `profiles` table (SELECT `photos`, `prompts.headline`) | ✅ Implemented | Queries `matches` table with `or(user_a.eq.id,user_b.eq.id).eq('status','open')`, then fetches profile for each match             | N+1 query pattern; no pagination; FlatList not optimized (no `getItemLayout`); pull-to-refresh works                                                   |
| **Match Detail**               | `MatchesStack` → `MatchDetailScreen`               | `src/screens/matches/MatchDetailScreen.tsx` (lines 39-104)                                                  | `matches` table, `profiles` table, `proposals` table (SELECT), `confirms` table (SELECT)         | ✅ Implemented | Loads match, other user profile, proposals, confirms                                                                              | No error handling for individual query failures; if profile fetch fails, user photo/name missing                                                       |
| **Create Proposal**            | `MatchDetailScreen` → `ProposeScreen`              | `src/screens/matches/ProposeScreen.tsx` (lines 47-331)                                                      | `proposals` table (INSERT with `windows`, `date_types`, `note`, `expires_at`)                    | ✅ Implemented | Date/time picker (`@react-native-community/datetimepicker`), validates 2-3 windows, within 7 days, no overlaps, 1-3 date types    | Complex validation logic; Android picker UX different from iOS; no timezone handling (assumes local time)                                              |
| **View Proposals**             | `MatchDetailScreen` → `ProposalCard`               | `src/components/ProposalCard.tsx` (lines 78-120)                                                            | None (receives proposal as prop)                                                                 | ✅ Implemented | Displays proposal windows, date types, note; shows expired/confirmed states                                                       | No refresh mechanism; if proposal expires while viewing, UI doesn't update                                                                             |
| **Confirm Proposal**           | `ProposalCard.handleConfirm()`                     | `src/components/ProposalCard.tsx` (lines 25-59)                                                             | `confirms` table (INSERT), `proposals` table (UPDATE `status: 'confirmed'`)                      | ✅ Implemented | Creates confirm record, updates proposal status                                                                                   | Race condition possible if both users confirm simultaneously; no optimistic UI                                                                         |
| **Chat (Real-time)**           | `MatchesStack` → `ChatScreen`                      | `src/screens/matches/ChatScreen.tsx` (lines 33-87)                                                          | `messages` table (SELECT, INSERT), Supabase Realtime subscription                                | ✅ Implemented | Loads messages on mount, subscribes to `postgres_changes` on `messages` table, inserts new messages                               | No offline queue; if offline, message is lost; no read receipts; no typing indicators; subscription cleanup may leak if component unmounts incorrectly |
| **Send Message**               | `ChatScreen.handleSend()`                          | `src/screens/matches/ChatScreen.tsx` (lines 89-123)                                                         | `messages` table (INSERT)                                                                        | ✅ Implemented | Inserts message with `content`, `bytes` (blob size), scrolls to bottom                                                            | No optimistic UI; if insert fails, message is lost; no character limit enforcement beyond maxLength                                                    |
| **Profile Editing**            | `MainNavigator` → `ProfileScreen`                  | `src/screens/profile/ProfileScreen.tsx` (lines 126-177)                                                     | `profiles` table (UPSERT with `prompts.headline`, `prompts.bio`, `photos`)                       | ✅ Implemented | Edits headline/bio, validates lengths, saves to `profiles`                                                                        | No draft saving; if save fails, changes lost; no conflict resolution if profile updated elsewhere                                                      |
| **Photo Upload (Profile)**     | `ProfileScreen.uploadPhoto()`                      | `src/screens/profile/ProfileScreen.tsx` (lines 199-244)                                                     | `profiles` storage bucket (upload), `profiles` table (UPSERT)                                    | ✅ Implemented | Same logic as onboarding photos; limits to 6 photos                                                                               | No duplicate detection; if upload succeeds but DB update fails, orphaned file in storage                                                               |
| **Photo Deletion**             | `ProfileScreen.removePhoto()`                      | `src/screens/profile/ProfileScreen.tsx` (lines 246-303), `src/lib/storage.ts` (lines 67-100)                | `profiles` storage bucket (`remove()`), `profiles` table (UPSERT)                                | ✅ Implemented | Deletes from storage via `deletePhotoFromStorage()`, updates DB; handles rollback if DB update fails                              | If storage delete fails but DB update succeeds, inconsistent state; ownership validation relies on path prefix matching                                |
| **Photo Reconciliation**       | `ProfileScreen.loadProfile()`                      | `src/screens/profile/ProfileScreen.tsx` (lines 66-116), `src/lib/reconcilePhotos.ts` (lines 22-130)         | `profiles` storage bucket (`list()` with search)                                                 | ✅ Implemented | Checks if photo URLs point to existing files, caches reconciliation timestamp (24h), prompts user to remove broken photos         | Network error handling may mark valid photos as invalid; reconciliation runs on every profile load (cached to 24h max); no batch reconciliation        |
| **Error Handling**             | Various screens                                    | `src/lib/errors.ts` (lines 75-90)                                                                           | Sentry (optional)                                                                                | ⚠️ Partial     | `getErrorAlert()` exists and captures to Sentry, but usage is inconsistent (some screens use `Alert.alert()` directly)            | Not all errors use centralized handler; Sentry may not capture all errors if DSN not set                                                               |
| **Debug Tools**                | `MainNavigator` (dev-only)                         | `src/screens/debug/DebugScreen.tsx` (lines 16-317), `src/navigation/MainNavigator.tsx` (lines 11-17, 80-87) | `profiles` table (UPSERT `completion_pct`), AsyncStorage                                         | ✅ Implemented | Gated by `__DEV__` or `EXPO_PUBLIC_ENABLE_DEBUG_MENU`, shows user ID/email, clear cache, reset onboarding, sign out               | Debug screen accessible in production if env var set; no rate limiting on actions                                                                      |
| **Analytics/Logging**          | `index.ts`                                         | `index.ts` (lines 5-23), `src/lib/errors.ts` (lines 79-84)                                                  | Sentry                                                                                           | ⚠️ Partial     | Sentry initialized conditionally in `index.ts`, captures exceptions in `getErrorAlert()`, but only enabled in production env      | Sentry disabled in development (good), but no custom events/tags for user actions; no performance monitoring                                           |
| **Settings/Sign Out**          | `ProfileScreen`                                    | `src/screens/profile/ProfileScreen.tsx` (lines 305-307)                                                     | Supabase Auth (`signOut()`)                                                                      | ✅ Implemented | Calls `supabase.auth.signOut()`, triggers navigation reset via `App.tsx` auth state listener                                      | No confirmation dialog; sign out may fail silently                                                                                                     |
| **Token Auto-Refresh**         | `App.tsx`                                          | `App.tsx` (lines 19-25)                                                                                     | Supabase Auth                                                                                    | ✅ Implemented | `AppState.addEventListener` starts/stops auto-refresh based on app foreground/background                                          | If refresh fails, user may be signed out unexpectedly; no retry logic                                                                                  |

---

## E) Critical Path Tests

**Two-device test flow** (based on `mobile/docs/TWO_DEVICE_TEST_PLAN.md` and code analysis):

### Device A (Account A: `email+userA@example.com`)

1. **App Launch & Auth**
   - ✅ **Entry:** `App.tsx` (line 113) shows loading, then checks session
   - ✅ **No session:** Routes to `AuthNavigator` → `WelcomeScreen` → `LoginScreen`
   - ✅ **Send magic link:** `LoginScreen.handleLogin()` (line 24) → `sendMagicLink()` → `supabase.auth.signInWithOtp()` (`src/lib/auth.ts` line 42)
   - ⚠️ **Deep link:** Magic link email contains `chemirl:///auth/callback?access_token=...` → App must be running or opened from email → `App.tsx` (lines 91-105) handles initial URL and URL listener → `handleMagicLink()` parses tokens → `supabase.auth.setSession()` (`src/lib/auth.ts` lines 17-20)
   - **Fragile:** Deep link handling depends on exact URL format; if app not running, user must open link manually

2. **Onboarding**
   - ✅ **Profile setup:** `ProfileSetupScreen` → Enter headline (min 5 chars), bio (min 20 chars) → `handleContinue()` (line 34) → UPSERT to `profiles` table with `completion_pct: 50`
   - ✅ **Photos:** `PhotosScreen` → Upload 1-6 photos → `uploadPhoto()` (line 67) → Upload to `profiles` bucket, update `profiles.photos` array, set `completion_pct: 100`
   - ✅ **Completion check:** `App.tsx` (lines 49, 78) checks `completion_pct >= 100` → Routes to `MainNavigator`
   - **Fragile:** If profile fetch fails during completion check, user stuck on loading screen (no retry)

3. **Discovery**
   - ✅ **Load feed:** `DiscoverScreen.loadFeed()` (line 22) → RPC `get_discovery_feed(p_viewer: user.id, p_limit: 20)` → Fetches photos for each item (N+1 queries)
   - ⚠️ **No matches yet:** Feed may be empty if no other users or if RPC filters exclude all candidates
   - **Fragile:** Feed doesn't refresh automatically; if network fails, shows empty state with retry button

4. **Like User B (after Device B completes onboarding)**
   - ✅ **Swipe right:** `DiscoveryCardStack` detects swipe > 120px → `DiscoverScreen.handleLike(userB.id)` (line 79) → RPC `create_like_and_check_match(p_liker: userA.id, p_likee: userB.id)`
   - ✅ **No match yet:** RPC returns `matched: false` → Card removed from feed
   - **Fragile:** If RPC fails, card stays in feed; no retry mechanism

### Device B (Account B: `email+userB@example.com`)

5. **Complete onboarding (same as Device A steps 1-3)**

6. **Like User A**
   - ✅ **Swipe right on User A:** `create_like_and_check_match(p_liker: userB.id, p_likee: userA.id)` → RPC detects mutual like → Creates match → Returns `matched: true`, `match_id`
   - ✅ **Match modal:** `DiscoverScreen` shows `MatchModal` (lines 146-153)
   - **Fragile:** If match creation fails in RPC, user B may not see match notification; no sync mechanism

### Device A (after Device B likes)

7. **Match Appears**
   - ⚠️ **No real-time sync:** Match only appears when Device A:
     - Refreshes matches list (`MatchesScreen.loadMatches()` line 51) OR
     - Likes Device B (then RPC returns match)
   - ✅ **Matches list:** `MatchesScreen` queries `matches` table → Shows User B with photo/headline
   - **Fragile:** User must manually refresh or navigate away/back to see new match

8. **Create Proposal**
   - ✅ **Navigate:** `MatchDetailScreen` → Tap "Propose 2-3 Times" → `ProposeScreen`
   - ✅ **Select windows:** Date picker → Start time → End time → Validates within 7 days, no overlaps, start < end → Adds to `selectedWindows` array (max 3)
   - ✅ **Select date types:** Tap 1-3 date type buttons (Coffee, Drinks, Dinner, etc.)
   - ✅ **Optional note:** Enter text (max 200 chars)
   - ✅ **Submit:** `handleSubmit()` (line 269) → Validates 2-3 windows, 1-3 date types → Calculates `expires_at` (72 hours) → INSERT to `proposals` table
   - **Fragile:** Complex validation logic may fail on edge cases (timezone boundaries, DST transitions); Android picker UX different from iOS

### Device B (receive proposal)

9. **View Proposal**
   - ⚠️ **No notification:** Device B must manually open match detail to see proposal
   - ✅ **Match detail:** `MatchDetailScreen.loadMatchData()` (line 39) → Queries `proposals` table → `ProposalCard` displays windows, date types, note
   - ✅ **Confirm window:** `ProposalCard.handleConfirm(chosenWindow)` (line 25) → INSERT to `confirms` table, UPDATE `proposals.status: 'confirmed'`
   - **Fragile:** Race condition if both users try to confirm different windows simultaneously

10. **Chat Unlocks**
    - ✅ **Chat button:** `MatchDetailScreen` shows "Open Chat" button if `confirms.length > 0` (line 147)
    - ✅ **Chat screen:** `ChatScreen` → Loads messages, subscribes to Realtime → Sends/receives messages
    - **Fragile:** If Realtime subscription fails, messages don't update in real-time; no offline queue

### Both Devices

11. **Chat Real-time Test**
    - ✅ **Device A sends:** `ChatScreen.handleSend()` (line 89) → INSERT to `messages` table → Realtime subscription triggers on Device B
    - ⚠️ **Device B receives:** Realtime subscription callback (lines 67-73) adds message to state → Scrolls to bottom
    - **Fragile:** Subscription may not work if app backgrounded; no connection status indicator

12. **Profile Edit**
    - ✅ **Edit headline/bio:** `ProfileScreen` → Edit fields → `handleSave()` (line 126) → UPSERT to `profiles` table
    - ✅ **Upload photo:** `uploadPhoto()` → Upload to storage, update `profiles.photos`
    - ✅ **Delete photo:** `removePhoto()` (line 246) → Delete from storage, update DB with rollback on failure
    - **Fragile:** Photo deletion rollback only handles DB failure after storage deletion; if storage delete fails, photo stays in DB

13. **Sign Out**
    - ✅ **Sign out:** `ProfileScreen.handleSignOut()` (line 305) → `supabase.auth.signOut()` → `App.tsx` auth state listener (line 69) detects sign out → Routes to `AuthNavigator`
    - **Fragile:** No confirmation dialog; if sign out fails, user may not know

---

## F) Gaps & Bugs (Prioritized)

### 1) Blocks MVP

#### G-1.1: No offline queue for messages/proposals

**Problem:** If user sends message or creates proposal while offline, it's lost. No retry mechanism.
**Why it matters:** Core functionality fails in poor network conditions, leading to user frustration and lost interactions.
**Files:** `src/screens/matches/ChatScreen.tsx` (lines 89-123), `src/screens/matches/ProposeScreen.tsx` (lines 269-331)
**Suggested fix:** Implement offline queue using AsyncStorage or a queue library (e.g., `@react-native-async-storage/async-storage`). Store pending operations, retry on network restore, show queue status in UI.
**Scope:** M

#### G-1.2: Feed doesn't refresh automatically after match

**Problem:** After mutual like creates match, user must manually refresh matches list or navigate away/back to see new match.
**Why it matters:** User expects immediate feedback; may think match didn't work.
**Files:** `src/screens/discover/DiscoverScreen.tsx` (lines 99-102), `src/screens/matches/MatchesScreen.tsx` (lines 51-109)
**Suggested fix:** After match created, navigate to matches tab automatically or trigger refresh. Alternatively, use Supabase Realtime subscription on `matches` table to detect new matches.
**Scope:** S

#### G-1.3: No error retry UI on critical screens

**Problem:** If network request fails (feed load, match load, proposal submit), user sees error alert but must manually retry.
**Why it matters:** Transient network errors block user progress; no recovery path.
**Files:** `src/screens/discover/DiscoverScreen.tsx` (lines 37-43), `src/screens/matches/ProposeScreen.tsx` (lines 316-321)
**Suggested fix:** Add "Retry" button to error states. Implement exponential backoff retry for automatic retries on recoverable errors.
**Scope:** S

#### G-1.4: Photo upload has no progress indicator

**Problem:** Large images upload with no visual feedback; user doesn't know if upload is in progress or stalled.
**Why it matters:** Poor UX; user may cancel or retry unnecessarily.
**Files:** `src/screens/onboarding/PhotosScreen.tsx` (lines 67-133), `src/screens/profile/ProfileScreen.tsx` (lines 199-244)
**Suggested fix:** Use Supabase Storage upload progress callback or implement file size check with estimated time. Show progress bar.
**Scope:** S

#### G-1.5: No proposal expiry auto-update

**Problem:** If proposal expires while user is viewing match detail, UI doesn't update to show expired state.
**Why it matters:** User may try to confirm expired proposal, leading to confusion.
**Files:** `src/components/ProposalCard.tsx` (lines 22-23), `src/screens/matches/MatchDetailScreen.tsx` (lines 77-87)
**Suggested fix:** Add timer or polling to check proposal expiry. Use `useEffect` with interval or Supabase Realtime subscription on `proposals` table.
**Scope:** S

### 2) Needed for Beta Quality

#### G-2.1: N+1 query pattern in discovery feed

**Problem:** Feed loads via RPC, then makes separate query for each user's photos (N queries for N users).
**Why it matters:** Slow performance with many users; increased database load; potential rate limiting.
**Files:** `src/screens/discover/DiscoverScreen.tsx` (lines 45-67)
**Suggested fix:** Modify `get_discovery_feed` RPC to return photos array in response, or batch fetch profiles. Alternatively, cache photos in local state.
**Scope:** M

#### G-2.2: No pagination on discovery feed

**Problem:** Feed loads 20 items at once; no "load more" or infinite scroll.
**Why it matters:** With many users, initial load is slow; can't browse beyond first 20.
**Files:** `src/screens/discover/DiscoverScreen.tsx` (line 34)
**Suggested fix:** Implement pagination with `p_limit` and `p_offset` parameters. Add "Load More" button or infinite scroll using `FlatList.onEndReached`.
**Scope:** M

#### G-2.3: No image caching

**Problem:** Profile photos are fetched from URLs every time; no local caching.
**Why it matters:** Slow scrolling, high bandwidth usage, poor offline experience.
**Files:** `src/components/DiscoveryCard.tsx`, `src/screens/matches/MatchesScreen.tsx` (line 147)
**Suggested fix:** Use `expo-image` with caching or implement custom image cache using AsyncStorage/FileSystem. Consider using `react-native-fast-image` or similar.
**Scope:** M

#### G-2.4: Matches list not optimized for performance

**Problem:** FlatList doesn't use `getItemLayout`, `keyExtractor` is simple but not optimized, no `removeClippedSubviews`.
**Why it matters:** Slow scrolling with many matches; memory usage issues.
**Files:** `src/screens/matches/MatchesScreen.tsx` (lines 137-160)
**Suggested fix:** Add `getItemLayout` if item heights are known, enable `removeClippedSubviews`, use `React.memo` for list items.
**Scope:** S

#### G-2.5: No timezone handling in proposals

**Problem:** Date/time picker uses local time, but no timezone conversion for display or storage.
**Why it matters:** Users in different timezones may see incorrect times; proposals may be invalid.
**Files:** `src/screens/matches/ProposeScreen.tsx` (lines 72-194)
**Suggested fix:** Store times in UTC, convert to user's timezone for display. Use `date-fns-tz` or similar library.
**Scope:** M

#### G-2.6: Chat has no read receipts or typing indicators

**Problem:** User doesn't know if message was read or if other user is typing.
**Why it matters:** Poor communication UX; users expect modern chat features.
**Files:** `src/screens/matches/ChatScreen.tsx`
**Suggested fix:** Add `read_at` column to `messages` table, update on message view. Implement typing indicator using Supabase Realtime presence channels.
**Scope:** L

#### G-2.7: No duplicate photo detection

**Problem:** User can upload same photo multiple times; no check for duplicates.
**Why it matters:** Wastes storage, cluttered profile.
**Files:** `src/screens/profile/ProfileScreen.tsx` (lines 199-244), `src/screens/onboarding/PhotosScreen.tsx` (lines 67-133)
**Suggested fix:** Hash photo file or compare URLs before upload. Check if photo URL already exists in `photos` array.
**Scope:** S

#### G-2.8: Photo reconciliation may mark valid photos as invalid on network error

**Problem:** If network error occurs during reconciliation check, valid photos may be treated as invalid.
**Why it matters:** User may lose valid photos unnecessarily.
**Files:** `src/lib/reconcilePhotos.ts` (lines 36-80)
**Suggested fix:** Improve network error detection; don't mark photos as invalid if network error occurred. Add retry logic.
**Scope:** S

### 3) Needed for Production Safety

#### G-3.1: No input sanitization for user-generated content

**Problem:** Headlines, bios, notes, messages are inserted directly without sanitization (though RLS should protect, XSS risk exists in future web views).
**Why it matters:** Security risk if content is rendered unsafely; potential for injection attacks.
**Files:** `src/screens/onboarding/ProfileSetupScreen.tsx` (lines 64-72), `src/screens/matches/ChatScreen.tsx` (lines 102-107)
**Suggested fix:** Sanitize inputs before sending to Supabase. Use library like `dompurify` or custom sanitization for common patterns.
**Scope:** S

#### G-3.2: No rate limiting on client side

**Problem:** User can spam likes, messages, or proposals; no client-side throttling.
**Why it matters:** Poor UX for recipients; potential abuse; increased server load.
**Files:** `src/screens/discover/DiscoverScreen.tsx` (line 79), `src/screens/matches/ChatScreen.tsx` (line 89)
**Suggested fix:** Implement debouncing/throttling on actions. Add cooldown timers. Server-side rate limiting should also be implemented.
**Scope:** S

#### G-3.3: Sentry integration incomplete

**Problem:** Sentry only captures exceptions in `getErrorAlert()`; no custom events, breadcrumbs, or performance monitoring.
**Why it matters:** Limited visibility into production issues; can't track user flows or performance.
**Files:** `src/lib/errors.ts` (lines 79-84), `index.ts` (lines 10-16)
**Suggested fix:** Add Sentry breadcrumbs for key actions (auth, like, proposal, message). Implement performance monitoring for API calls. Add user context.
**Scope:** M

#### G-3.4: No analytics for key events

**Problem:** No tracking of user actions (signups, matches, proposals, messages).
**Why it matters:** Can't measure product metrics, optimize conversion, or debug issues.
**Files:** None (feature missing)
**Suggested fix:** Integrate analytics SDK (PostHog, Mixpanel, or similar). Track events: `user_signed_up`, `profile_completed`, `like_sent`, `match_created`, `proposal_sent`, `message_sent`.
**Scope:** M

#### G-3.5: No push notifications

**Problem:** User doesn't receive notifications for matches, proposals, or messages when app is closed.
**Why it matters:** Critical for engagement; users may miss important interactions.
**Files:** None (feature missing)
**Suggested fix:** Implement Expo Notifications or Firebase Cloud Messaging. Set up Supabase webhooks to trigger notifications on match/proposal/message creation.
**Scope:** L

#### G-3.6: Debug screen accessible in production if env var set

**Problem:** If `EXPO_PUBLIC_ENABLE_DEBUG_MENU=true` is set in production, debug screen is accessible to all users.
**Why it matters:** Security risk; users can clear cache, reset onboarding, or access internal functions.
**Files:** `src/navigation/MainNavigator.tsx` (line 11)
**Suggested fix:** Only enable debug screen if `__DEV__ === true`. Remove `EXPO_PUBLIC_ENABLE_DEBUG_MENU` check for production builds.
**Scope:** S

#### G-3.7: No session expiry handling

**Problem:** If session expires (token refresh fails), user may be stuck on loading screen or see cryptic errors.
**Why it matters:** Poor UX; user may think app is broken.
**Files:** `App.tsx` (lines 34-62), `src/lib/supabase/client.ts` (lines 67-68)
**Suggested fix:** Add error handler for token refresh failures. Redirect to login screen with clear message. Implement session expiry detection.
**Scope:** S

#### G-3.8: Photo deletion race condition

**Problem:** If user deletes photo while upload is in progress, or if multiple deletions happen simultaneously, state may be inconsistent.
**Why it matters:** Data inconsistency; photos may be orphaned or deleted incorrectly.
**Files:** `src/screens/profile/ProfileScreen.tsx` (lines 246-303)
**Suggested fix:** Add loading state per photo. Disable delete during upload. Implement optimistic updates with rollback.
**Scope:** S

---

## G) Architecture / Tech Debt Notes

### Navigation/State Management

**Pattern:** React Navigation v7 with nested navigators (Stack → Tab → Stack). No global state management library (Redux, Zustand, etc.). State is component-local using `useState`/`useEffect`.

**Issues:**

- **No shared state:** Match data is fetched separately in `MatchesScreen` and `MatchDetailScreen`; no cache between screens. If match updated in detail screen, list screen doesn't refresh automatically.
- **Navigation coupling:** Deep navigation paths (`MatchesStack.MatchDetail.Propose`) make type safety complex. `CompositeNavigationProp` used but can be error-prone.
- **No state persistence:** If app is killed, all component state is lost. Only Supabase session persists.

**Recommendations:**

- Consider lightweight state management (Zustand, Jotai) for shared match/proposal data.
- Implement navigation state persistence for better UX on app restart.
- Add deep link handling for match/proposal URLs.

### Data Fetching Patterns

**Pattern:** Direct Supabase client calls in components. No data fetching library (React Query, SWR, etc.). Each screen fetches its own data on mount.

**Issues:**

- **N+1 queries:** Discovery feed fetches photos separately for each user. Matches list fetches profiles separately.
- **No caching:** Same data fetched multiple times (e.g., profile data in multiple screens).
- **No refetch strategy:** Data doesn't refresh automatically; user must pull-to-refresh or navigate away/back.
- **Error handling inconsistency:** Some screens use `getErrorAlert()`, others use `Alert.alert()` directly.

**Recommendations:**

- Implement React Query or SWR for caching, refetching, and error handling.
- Batch profile fetches using Supabase `.in()` queries.
- Add automatic refetch on app foreground or network reconnect.

### Supabase Contract Risks

**RLS Policies:** App relies on Supabase RLS to enforce data access. Policies are not in mobile codebase (they're in database migrations).

**Risks:**

- **Policy changes break app:** If RLS policies change, app may fail silently or show errors.
- **No policy verification:** App doesn't verify RLS is working correctly (e.g., can't access other users' data).
- **Error messages opaque:** RLS violations return generic errors; hard to debug.

**Recommendations:**

- Document expected RLS behavior in code comments.
- Add integration tests that verify RLS (requires test users and service role key).
- Improve error messages to distinguish RLS violations from other errors.

**RPC Error Surfaces:** App calls two RPCs: `get_discovery_feed` and `create_like_and_check_match`.

**Risks:**

- **RPC may return unexpected format:** If RPC signature changes, app breaks.
- **No RPC versioning:** Can't gracefully handle RPC updates.
- **Error handling assumes specific error codes:** RPC errors may not match expected format.

**Recommendations:**

- Add TypeScript types for RPC responses (generate from database schema if possible).
- Version RPCs or add feature flags for gradual rollout.
- Handle RPC errors gracefully with fallback behavior.

**Storage:** App uses `profiles` bucket for photo storage. Path format: `{userId}/{timestamp}.{ext}`.

**Risks:**

- **Path parsing fragile:** `extractStoragePathFromUrl()` assumes specific URL format. If Supabase changes URL structure, extraction fails.
- **Ownership validation relies on path prefix:** If path format changes, ownership check may fail.
- **No storage quota enforcement:** User can upload unlimited photos (though UI limits to 6).

**Recommendations:**

- Add validation for storage URLs before parsing.
- Consider storing file paths in database for more reliable ownership checks.
- Implement storage quota checks before upload.

### Performance Risks

**Re-rendering:**

- **No memoization:** Components don't use `React.memo` or `useMemo`; unnecessary re-renders likely.
- **Large state objects:** Feed items include photos arrays; updating feed causes all cards to re-render.
- **FlatList not optimized:** `MatchesScreen` FlatList doesn't use performance optimizations.

**List Virtualization:**

- **Discovery feed not virtualized:** `DiscoveryCardStack` renders all cards in stack (though only top few visible). With many users, performance degrades.
- **Chat messages:** `ChatScreen` FlatList should be fine, but no `getItemLayout` optimization.

**Image Handling:**

- **No image compression:** Photos uploaded at full resolution; large file sizes, slow uploads.
- **No progressive loading:** Images load all at once; no placeholder or blur-up.
- **No size limits:** User can upload very large images (though `quality: 0.8` in ImagePicker helps).

**Recommendations:**

- Add `React.memo` to card components.
- Implement image compression before upload (use `expo-image-manipulator` or similar).
- Add image size limits (e.g., max 5MB per photo).
- Use `expo-image` with caching for better performance.

---

## H) Plan & Roadmap

### MVP Punchlist (ordered by priority)

1. **G-1.3: Add error retry UI** (Scope: S)
   - Add "Retry" button to `DiscoverScreen`, `MatchesScreen`, `ProposeScreen` error states
   - Implement automatic retry with exponential backoff for recoverable errors
   - Files: `src/screens/discover/DiscoverScreen.tsx`, `src/screens/matches/MatchesScreen.tsx`, `src/screens/matches/ProposeScreen.tsx`

2. **G-1.2: Auto-refresh matches after match created** (Scope: S)
   - After match modal shown, navigate to matches tab or trigger refresh
   - Files: `src/screens/discover/DiscoverScreen.tsx`, `src/screens/matches/MatchesScreen.tsx`

3. **G-1.4: Add photo upload progress indicator** (Scope: S)
   - Show progress bar during photo upload
   - Files: `src/screens/onboarding/PhotosScreen.tsx`, `src/screens/profile/ProfileScreen.tsx`

4. **G-1.5: Auto-update proposal expiry** (Scope: S)
   - Add timer to check proposal expiry every minute
   - Files: `src/components/ProposalCard.tsx`, `src/screens/matches/MatchDetailScreen.tsx`

5. **G-1.1: Implement offline queue** (Scope: M)
   - Add offline queue for messages and proposals
   - Store pending operations in AsyncStorage, retry on network restore
   - Files: `src/screens/matches/ChatScreen.tsx`, `src/screens/matches/ProposeScreen.tsx`, new `src/lib/offlineQueue.ts`

6. **G-3.6: Remove debug screen from production** (Scope: S)
   - Only enable debug screen if `__DEV__ === true`
   - Files: `src/navigation/MainNavigator.tsx`

### Beta Hardening List

7. **G-2.1: Fix N+1 query in discovery feed** (Scope: M)
   - Modify RPC to return photos or batch fetch profiles
   - Files: `src/screens/discover/DiscoverScreen.tsx`, database RPC (backend)

8. **G-2.2: Add pagination to discovery feed** (Scope: M)
   - Implement infinite scroll or "Load More" button
   - Files: `src/screens/discover/DiscoverScreen.tsx`, `src/components/DiscoveryCardStack.tsx`

9. **G-2.3: Implement image caching** (Scope: M)
   - Use `expo-image` or implement custom cache
   - Files: `src/components/DiscoveryCard.tsx`, `src/screens/matches/MatchesScreen.tsx`

10. **G-2.4: Optimize matches list** (Scope: S)
    - Add `getItemLayout`, `removeClippedSubviews`, `React.memo`
    - Files: `src/screens/matches/MatchesScreen.tsx`

11. **G-2.5: Add timezone handling** (Scope: M)
    - Store times in UTC, convert for display
    - Files: `src/screens/matches/ProposeScreen.tsx`, `src/components/ProposalCard.tsx`

12. **G-2.7: Add duplicate photo detection** (Scope: S)
    - Check if photo URL exists before upload
    - Files: `src/screens/profile/ProfileScreen.tsx`, `src/screens/onboarding/PhotosScreen.tsx`

13. **G-3.3: Enhance Sentry integration** (Scope: M)
    - Add breadcrumbs, custom events, user context
    - Files: `src/lib/errors.ts`, `index.ts`, all screens

14. **G-3.4: Add analytics** (Scope: M)
    - Integrate PostHog or similar, track key events
    - Files: New `src/lib/analytics.ts`, all screens

### Production Readiness List

15. **G-3.1: Add input sanitization** (Scope: S)
    - Sanitize user inputs before sending to Supabase
    - Files: All screens with text inputs

16. **G-3.2: Add client-side rate limiting** (Scope: S)
    - Implement debouncing/throttling on actions
    - Files: `src/screens/discover/DiscoverScreen.tsx`, `src/screens/matches/ChatScreen.tsx`

17. **G-3.5: Implement push notifications** (Scope: L)
    - Set up Expo Notifications, Supabase webhooks
    - Files: New `src/lib/notifications.ts`, `index.ts`

18. **G-3.7: Add session expiry handling** (Scope: S)
    - Handle token refresh failures, redirect to login
    - Files: `App.tsx`, `src/lib/supabase/client.ts`

19. **G-3.8: Fix photo deletion race condition** (Scope: S)
    - Add loading state per photo, disable during upload
    - Files: `src/screens/profile/ProfileScreen.tsx`

20. **Performance optimizations** (Scope: M)
    - Add `React.memo` to components, implement image compression
    - Files: All components, `src/screens/onboarding/PhotosScreen.tsx`

---

### "Next 3 Commits" (Smallest, Highest Impact)

#### Commit 1: Add error retry UI to critical screens

**Commit message:**

```
feat: add retry UI for network errors on discover and matches screens

- Add "Retry" button to empty error states in DiscoverScreen and MatchesScreen
- Implement automatic retry with exponential backoff for recoverable errors
- Improve error messaging to distinguish network vs other errors

Files:
- src/screens/discover/DiscoverScreen.tsx
- src/screens/matches/MatchesScreen.tsx
- src/lib/errors.ts (add isNetworkError helper)

Acceptance criteria:
- Error states show "Retry" button
- Clicking retry attempts to reload data
- Automatic retry happens for network errors (max 3 attempts)
- Error messages clearly indicate if retry is possible
```

#### Commit 2: Auto-refresh matches after match created

**Commit message:**

```
feat: auto-navigate to matches tab after mutual match

- After match modal is shown, automatically navigate to Matches tab
- Trigger matches list refresh to show new match immediately
- Improve match modal UX with better navigation flow

Files:
- src/screens/discover/DiscoverScreen.tsx
- src/components/MatchModal.tsx
- src/navigation/MainNavigator.tsx (add navigation ref if needed)

Acceptance criteria:
- After match created, user sees match modal
- Clicking "View Match" or "Continue Browsing" works as expected
- Matches list refreshes automatically when navigating to Matches tab
- New match appears in list without manual refresh
```

#### Commit 3: Add photo upload progress indicator

**Commit message:**

```
feat: show upload progress for profile photos

- Add progress indicator during photo upload (spinner + percentage if available)
- Show upload status (uploading, success, error) per photo
- Disable delete/upload actions during active upload

Files:
- src/screens/onboarding/PhotosScreen.tsx
- src/screens/profile/ProfileScreen.tsx
- src/components/PhotoUploadButton.tsx (new component, optional)

Acceptance criteria:
- Upload shows spinner/indicator during upload
- User can see which photo is uploading
- Upload button disabled during upload
- Error state shows retry option
- Success state shows checkmark or similar
```

---

**Report End**
