# Mobile App Analysis - Chem IRL

**Generated:** 2025-01-27  
**App Root:** `mobile/`  
**Framework:** React Native (Expo SDK 54)

---

## A. Mobile App Overview

**Chem IRL** is a dating app mobile client focused on rapid in-person meetings. The app's core value proposition is "Spend less time texting. Test chemistry IRL." The mobile app is a React Native application built with Expo, implementing a full-stack dating flow: discovery/swiping, matching, proposing dates, and messaging.

**Current maturity level:** **Partially built MVP** - The app has complete navigation architecture, working authentication (magic links), onboarding flow, discovery feed with swipe mechanics, matching system, proposal creation/confirmation, and real-time chat. However, some screens are stubs (ProfileScreen), and several features need polish (error handling, offline support, photo management). The app is functional end-to-end but lacks production-level error resilience and some UI polish.

**Evidence:**
- All navigation stacks are defined and functional (`mobile/src/navigation/*`)
- Auth flow complete with deep linking (`mobile/src/lib/auth.ts`, `mobile/App.tsx`)
- Discovery, matches, proposals, and chat screens all have working implementations
- ProfileScreen shows "coming soon" placeholder (`mobile/src/screens/profile/ProfileScreen.tsx:13`)
- Error handling exists but is basic (`mobile/src/lib/errors.ts`)

---

## B. Repo Map (mobile-specific)

**Mobile app root:** `mobile/`

### Key Directories and Files

- **`mobile/App.tsx`** - Root component. Handles session state, profile completion check, deep linking, and routes to Auth/Onboarding/Main navigators.
- **`mobile/app.json`** - Expo configuration (scheme: `chemirl`, bundle IDs, icons, splash)
- **`mobile/package.json`** - Dependencies (Expo 54, React Native 0.81.5, React Navigation 7, Supabase 2.86, TypeScript)
- **`mobile/src/navigation/`** - Navigation structure:
  - `AuthNavigator.tsx` - Welcome → Login → MagicLinkSent
  - `OnboardingNavigator.tsx` - ProfileSetup → Photos
  - `MainNavigator.tsx` - Bottom tabs: Discover, Matches (stack), Profile
- **`mobile/src/screens/`** - All screen components organized by feature:
  - `auth/` - WelcomeScreen, LoginScreen, MagicLinkSentScreen
  - `onboarding/` - ProfileSetupScreen, PhotosScreen
  - `discover/` - DiscoverScreen (swipe feed)
  - `matches/` - MatchesScreen (list), MatchDetailScreen, ProposeScreen, ChatScreen
  - `profile/` - ProfileScreen (stub)
  - `todos/` - Empty directory (likely leftover from testing)
- **`mobile/src/components/`** - Reusable UI:
  - `DiscoveryCard.tsx` - Individual profile card in discovery stack
  - `DiscoveryCardStack.tsx` - Swipeable card stack with pan gestures
  - `MatchModal.tsx` - Modal shown when match occurs
  - `ProposalCard.tsx` - Displays proposal with time windows for confirmation
- **`mobile/src/lib/`** - Core utilities:
  - `supabase/client.ts` - Supabase client with LargeSecureStore (AES-256 encrypted AsyncStorage)
  - `auth.ts` - `sendMagicLink()`, `handleMagicLink()` for auth flow
  - `types.ts` - TypeScript interfaces matching Supabase schema
  - `errors.ts` - Error formatting utilities (basic)
- **`mobile/src/config/`** - Brand constants:
  - `brand.ts` - Colors, messages, brand info (`BRAND_COLORS.primary = '#1453FF'`)
- **`mobile/jest.unit.config.js`** - Jest config for unit tests (Node environment)
- **`mobile/jest.native.config.js`** - Jest config for React Native component tests
- **`mobile/.eslintrc.js`** - ESLint config (Expo preset + Prettier)
- **`mobile/babel.config.js`** - Babel config with custom plugin for React Native Jest file preprocessing

### No Duplicated/Legacy App Folders Found

The repo structure is clean—single mobile app implementation in `mobile/`. No duplicate or legacy folders detected.

---

## C. How to Run (dev workflow)

### Installation

```bash
cd mobile
npm install
```

**Requirements:**
- Node.js (version inferred from package.json: any recent LTS compatible with Expo 54)
- npm or yarn
- For iOS: macOS with Xcode (via Expo Go or EAS)
- For Android: Android Studio (or use Expo Go)

### Environment Variables

Create `mobile/.env` (gitignored):

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_publishable_key_here
EXPO_PUBLIC_APP_URL=https://chemirl.app
```

**Where loaded:** Expo automatically loads `.env` at build/start time. Variables prefixed with `EXPO_PUBLIC_` are inlined into the bundle by Babel.

**File reference:** `mobile/ENV_SETUP.md` documents this.

### Run Commands

```bash
# Start Expo dev server (Metro bundler)
npm start

# Run on iOS simulator (requires macOS + Xcode)
npm run ios

# Run on Android emulator (requires Android Studio)
npm run android

# Run on web browser (limited React Native web support)
npm run web
```

### Tooling

- **Expo CLI:** Bundled with `expo` package (SDK 54)
- **EAS Build:** Configured via `mobile/eas.json` (not examined, but file exists)
- **CocoaPods:** Not required (Expo managed workflow)
- **Metro:** Bundler configured by Expo preset

### Common Run Failures (Anticipated from Codebase)

1. **Missing `.env` file**
   - **Symptom:** `process.env.EXPO_PUBLIC_SUPABASE_URL` is `undefined`, app crashes on Supabase client init
   - **Fix:** Create `mobile/.env` with required variables (see `mobile/ENV_SETUP.md`)

2. **Deep linking not working (iOS/Android)**
   - **Symptom:** Magic link emails don't open app
   - **Fix:** Ensure `app.json` has `"scheme": "chemirl"` (already configured). For production builds, configure associated domains in EAS.

3. **Photo upload fails**
   - **Symptom:** `PhotosScreen` upload throws storage error
   - **Fix:** Verify Supabase Storage bucket `profiles` exists with RLS policies allowing authenticated uploads

4. **Jest test failures (unit tests)**
   - **Symptom:** `npm test` fails with React Native mock parsing errors
   - **Fix:** Tests already separated into `test:unit` (Node env) and `test:native` (Expo preset). Use `npm run test:unit` for stable unit tests.

**Evidence:** `mobile/src/lib/supabase/client.ts:7-8` uses `process.env.EXPO_PUBLIC_SUPABASE_URL!` - will crash if undefined. `mobile/App.tsx:94` handles deep links but requires proper scheme configuration.

---

## D. Architecture & Data Flow

### Navigation Structure

**Root:** `App.tsx` uses `NavigationContainer` with conditional rendering:
- **No session** → `AuthNavigator` (stack)
- **Session but `profile.completion_pct < 100`** → `OnboardingNavigator` (stack)
- **Session and profile complete** → `MainNavigator` (bottom tabs)

**AuthNavigator** (`mobile/src/navigation/AuthNavigator.tsx`):
- `Welcome` → `Login` → `MagicLinkSent`

**OnboardingNavigator** (`mobile/src/navigation/OnboardingNavigator.tsx`):
- `ProfileSetup` → `Photos`

**MainNavigator** (`mobile/src/navigation/MainNavigator.tsx`):
- Bottom tabs:
  - **Discover** (DiscoverScreen) - swipe feed
  - **Matches** (MatchesStackNavigator - nested stack):
    - `MatchesList` (MatchesScreen)
    - `MatchDetail` (MatchDetailScreen)
    - `Propose` (ProposeScreen)
    - `Chat` (ChatScreen)
  - **Profile** (ProfileScreen - stub)

**Navigation library:** `@react-navigation/native` v7 with `@react-navigation/native-stack` and `@react-navigation/bottom-tabs`.

### State Management

**Pattern:** React hooks (useState, useEffect, useCallback) + local component state. **No global state management library** (Redux, Zustand, Context API for app-wide state).

**Session state:** Managed in `App.tsx`:
- `useState<Session | null>(null)` for current session
- `useState<boolean>(false)` for `profileComplete`
- Updated via `supabase.auth.onAuthStateChange()` listener

**Screen-level state:** Each screen manages its own data:
- `DiscoverScreen`: `feed` state, `loading`, `matchModalVisible`
- `MatchesScreen`: `matches` state, `loading`, `refreshing`
- `ChatScreen`: `messages` state, real-time subscription
- `ProposeScreen`: `selectedWindows`, `selectedDateTypes`, `note`

**Evidence:** No imports of Redux/Zustand/Context providers in `App.tsx` or navigation files. All screens use local `useState` hooks.

### API Layer

**Direct Supabase integration** - no API abstraction layer. All screens call Supabase client directly.

**Client initialization:** `mobile/src/lib/supabase/client.ts`
- Creates Supabase client with `LargeSecureStore` (AES-256 encrypted AsyncStorage)
- Auto-refresh tokens enabled
- Session persistence enabled
- URL detection disabled (deep links handled manually)

**Base URL:** `process.env.EXPO_PUBLIC_SUPABASE_URL` (Babel-inlined at build time)

**Auth headers:** Automatic via Supabase JS client (JWT in Authorization header)

**API calls pattern:**
- **RPC functions:** `supabase.rpc('get_discovery_feed', {...})`, `supabase.rpc('create_like_and_check_match', {...})`
- **Queries:** `supabase.from('table').select().eq(...)`
- **Mutations:** `supabase.from('table').insert(...)`, `.update(...)`, `.upsert(...)`
- **Real-time:** `supabase.channel(...).on('postgres_changes', ...).subscribe()`

**Example locations:**
- `mobile/src/screens/discover/DiscoverScreen.tsx:31` - RPC call for feed
- `mobile/src/screens/discover/DiscoverScreen.tsx:83` - RPC for like/match
- `mobile/src/screens/matches/ChatScreen.tsx:52` - Real-time subscription
- `mobile/src/screens/matches/MatchesScreen.tsx:58` - Direct query

**Refresh logic:** Automatic token refresh via `supabase.auth.startAutoRefresh()` when app is active (`App.tsx:21`). Manual refresh handled by Supabase client.

### Error Handling

**Pattern:** Try-catch blocks in async functions, `Alert.alert()` for user feedback, console.error for debugging.

**Utilities:** `mobile/src/lib/errors.ts` provides:
- `formatError()` - converts unknown error to string
- `getUserErrorMessage()` - maps common errors to user-friendly messages
- `isRecoverableError()` - checks if error is retryable

**Usage:** Most screens use inline try-catch with `Alert.alert()`. `errors.ts` utilities are defined but **not widely used** (only imported in screens implicitly, if at all).

**Evidence:**
- `mobile/src/screens/discover/DiscoverScreen.tsx:36` - `Alert.alert('Error', 'Failed to load discovery feed')`
- `mobile/src/screens/auth/LoginScreen.tsx:44` - `Alert.alert('Error', result.error || 'Failed to send magic link')`
- No retry logic observed in screens

**Offline behavior:** **Not implemented.** No offline queue, no cache, no "retry when online" logic. App will fail silently or show errors if network is unavailable.

### Local Persistence

**Storage solution:** 
- **Session tokens:** `LargeSecureStore` (AES-256 encrypted AsyncStorage)
  - Encryption key stored in Expo SecureStore (2048 byte limit)
  - Session data stored in AsyncStorage (encrypted)
  - Implementation: `mobile/src/lib/supabase/client.ts:17-62`

**What is stored:**
- Supabase auth session (JWT tokens, user data) - handled by Supabase client via `LargeSecureStore`
- No other app data is explicitly persisted (no user preferences cache, no feed cache, no offline message queue)

**Storage keys:** Managed internally by Supabase client (not exposed in app code).

**Evidence:** `mobile/src/lib/supabase/client.ts:64-71` configures `storage: new LargeSecureStore()`. No AsyncStorage or SecureStore calls in screen components (only via Supabase client).

---

## E. Features & Screens (inventory)

| Screen/Feature | Route Name | File Path | Purpose | Data Sources | Status |
|----------------|------------|-----------|---------|--------------|--------|
| **Welcome** | `Welcome` | `src/screens/auth/WelcomeScreen.tsx` | Landing page with tagline, "Get Started" button | None (static) | ✅ Implemented |
| **Login** | `Login` | `src/screens/auth/LoginScreen.tsx` | Email input, sends magic link | `sendMagicLink()` → Supabase Auth | ✅ Implemented |
| **Magic Link Sent** | `MagicLinkSent` | `src/screens/auth/MagicLinkSentScreen.tsx` | Confirmation screen after email sent | Route params (email) | ✅ Implemented |
| **Profile Setup** | `ProfileSetup` | `src/screens/onboarding/ProfileSetupScreen.tsx` | Collect headline + bio, saves to `profiles` | `supabase.from('profiles').upsert()` | ✅ Implemented |
| **Photos** | `Photos` | `src/screens/onboarding/PhotosScreen.tsx` | Photo upload (1-6 photos), saves to Storage + `profiles.photos` | `supabase.storage.from('profiles')`, `profiles` table | ✅ Implemented |
| **Discover** | `Discover` | `src/screens/discover/DiscoverScreen.tsx` | Swipeable feed, like/pass actions | `supabase.rpc('get_discovery_feed')`, `supabase.rpc('create_like_and_check_match')` | ✅ Implemented |
| **Matches List** | `MatchesList` | `src/screens/matches/MatchesScreen.tsx` | List of all open matches | `supabase.from('matches').select()` | ✅ Implemented |
| **Match Detail** | `MatchDetail` | `src/screens/matches/MatchDetailScreen.tsx` | View match, proposals, confirms, navigate to propose/chat | `matches`, `proposals`, `confirms`, `profiles` tables | ✅ Implemented |
| **Propose** | `Propose` | `src/screens/matches/ProposeScreen.tsx` | Create proposal with 2-3 time windows, date types, note | `supabase.from('proposals').insert()` | ✅ Implemented (simplified date picker) |
| **Chat** | `Chat` | `src/screens/matches/ChatScreen.tsx` | Real-time messaging via Supabase Realtime | `supabase.from('messages')`, `supabase.channel()` subscription | ✅ Implemented |
| **Profile** | `Profile` | `src/screens/profile/ProfileScreen.tsx` | User profile view/edit | None | 🚧 Stub ("coming soon" placeholder) |
| **Match Modal** | N/A (component) | `src/components/MatchModal.tsx` | Modal shown when match occurs | Props (matchId) | ✅ Implemented |
| **Discovery Card Stack** | N/A (component) | `src/components/DiscoveryCardStack.tsx` | Swipeable card stack with pan gestures | Props (feed array) | ✅ Implemented |
| **Proposal Card** | N/A (component) | `src/components/ProposalCard.tsx` | Displays proposal with time windows, confirm actions | `supabase.from('confirms').insert()`, `proposals.update()` | ✅ Implemented |

**Status Legend:**
- ✅ **Implemented** - Fully functional with API integration
- 🚧 **Stub** - Placeholder UI, no functionality
- ⚠️ **Partial** - Partially functional, missing features
- ❌ **Broken** - Known bugs or non-functional

**Additional Notes:**
- **ProposeScreen** uses a simplified date picker (hardcoded times 1-3 days ahead, 6-8 PM). Comment at line 42-43 indicates "For MVP, use a simple date picker approach. In production, use a proper date/time picker."
- **ChatScreen** implements real-time subscriptions correctly but has no message read receipts or typing indicators.
- **ProfileScreen** is completely stubbed - shows "Profile screen coming soon..." and only has a Sign Out button.

---

## F. Auth & Accounts

### Login/Signup Implementation

**Method:** Email magic links (passwordless authentication)

**Flow:**
1. User enters email on `LoginScreen`
2. `sendMagicLink(email)` called (`mobile/src/lib/auth.ts:40`)
3. Supabase sends email with deep link: `chemirl://auth/callback?access_token=...&refresh_token=...`
4. App handles deep link via `Linking` API (`App.tsx:91-105`)
5. `handleMagicLink(url)` extracts tokens and calls `supabase.auth.setSession()`
6. Session stored via `LargeSecureStore`
7. `App.tsx` detects session via `onAuthStateChange` listener

**File references:**
- Login UI: `mobile/src/screens/auth/LoginScreen.tsx`
- Auth logic: `mobile/src/lib/auth.ts`
- Deep link handling: `mobile/App.tsx:91-105`
- Session check: `mobile/App.tsx:32-88`

**Email verification:** Supabase handles sending emails. Magic links expire in 1 hour (Supabase default, configurable in Supabase dashboard).

### Token/Session Model

**Storage:** JWT tokens stored in `LargeSecureStore` (AES-256 encrypted AsyncStorage)

**Token types:**
- `access_token` - Short-lived JWT (default: 1 hour, Supabase configurable)
- `refresh_token` - Long-lived token for obtaining new access tokens

**Refresh logic:**
- Auto-refresh enabled (`autoRefreshToken: true` in client config)
- `App.tsx:19-25` starts/stops auto-refresh based on `AppState` (active/background)
- Manual refresh handled by Supabase client automatically

**Session structure:** Managed by Supabase client. Session object includes `user` (id, email, metadata), `access_token`, `refresh_token`, `expires_at`.

**Evidence:** `mobile/src/lib/supabase/client.ts:64-71` configures auth storage and refresh. `mobile/App.tsx:19-25` handles AppState-based refresh control.

### User Profile Model

**Database mapping:** User data stored in Supabase `profiles` table (not `users` - that's Supabase Auth table).

**Profile structure** (from `mobile/src/lib/types.ts:30-38`):
- `user_id` (UUID, foreign key to auth.users)
- `prompts` (JSONB: `{ headline: string, bio: string }`)
- `availability` (JSONB: flexible structure)
- `photos` (string[] - URLs to Supabase Storage)
- `completion_pct` (number: 0-100, used for onboarding gate)
- `created_at`, `updated_at`

**Profile completion check:** `App.tsx:41-56` queries `profiles.completion_pct` to gate access to main app. If `completion_pct >= 100`, user sees `MainNavigator`, otherwise `OnboardingNavigator`.

**Evidence:** 
- TypeScript types: `mobile/src/lib/types.ts:30-38`
- Profile completion check: `mobile/App.tsx:41-56`
- Profile creation: `mobile/src/screens/onboarding/ProfileSetupScreen.tsx:65-72`

---

## G. UI System & Components

### Design System / Component Library

**No external component library** - custom components built with React Native primitives.

**Brand system:** `mobile/src/config/brand.ts` defines:
- Colors: `BRAND_COLORS.primary = '#1453FF'`, text colors, success/warning/danger
- Brand messages: proposal errors, speed messages, report messages
- Brand info: name, tagline, description

**Evidence:** No imports of Material UI, NativeBase, React Native Elements, or similar. All screens use `View`, `Text`, `TouchableOpacity`, `TextInput` from `react-native`.

### Shared Components

**Location:** `mobile/src/components/`

**Components:**
1. **DiscoveryCard** (`DiscoveryCard.tsx`) - Displays single profile card with photo, headline, bio, availability, scores (action_speed, profile_quality, reliability), Like/Pass buttons
2. **DiscoveryCardStack** (`DiscoveryCardStack.tsx`) - Stack of swipeable cards using `PanResponder` and `Animated`
3. **MatchModal** (`MatchModal.tsx`) - Modal shown when match occurs ("It's a Match!")
4. **ProposalCard** (`ProposalCard.tsx`) - Displays proposal with time windows (clickable to confirm), date types, note, confirm/decline actions

**No shared layout components** (no `Layout.tsx`, `Container.tsx`, `Button.tsx`, etc.) - each screen defines its own layout and styling.

### Theming / Styling Approach

**Method:** React Native `StyleSheet.create()` - all styles defined locally in each component file.

**Pattern:** No global theme object (except brand colors). Each screen/component has its own `styles` object.

**Color usage:** Brand colors imported from `config/brand.ts`:
- `BRAND_COLORS.primary` - Primary blue (#1453FF)
- `BRAND_COLORS.text[900]` - Dark text
- `BRAND_COLORS.text[600]` - Light text
- `BRAND_COLORS.success`, `danger`, `warning` - Semantic colors

**Typography:** No centralized typography system - font sizes/weights defined per component.

**Evidence:** Every screen file ends with `const styles = StyleSheet.create({...})`. Brand colors imported but no shared button/layout components.

---

## H. Testing & Quality

### Test Setup

**Unit tests:** `mobile/jest.unit.config.js`
- Environment: Node.js (no React Native)
- Transform: `babel-jest`
- Test match: `src/lib/__tests__/**/*.test.ts`, `src/config/__tests__/**/*.test.ts`
- Setup file: `jest.unit.setup.js` (mocks React Native, SecureStore, AsyncStorage, crypto)

**React Native tests:** `mobile/jest.native.config.js`
- Preset: `jest-expo`
- For component/integration tests (not actively used based on file structure)

**Test runner:** Jest 29.7.0

**Scripts:**
- `npm test` → `test:unit` (default)
- `npm run test:unit` - Unit tests
- `npm run test:native` - React Native tests

### Current Test Files

Found in `mobile/src/lib/__tests__/`:
1. **auth.test.ts** - Tests `sendMagicLink()`, `handleMagicLink()` with mocked Supabase
2. **supabase-client.test.ts** - Tests client initialization, env var usage
3. **types.test.ts** - Type validation tests

Found in `mobile/src/config/__tests__/`:
1. **brand.test.ts** - Brand constants tests

**Test count:** 14 tests total (verified via `npm test` output in conversation history)

**Coverage:** Limited - only tests `lib/` utilities and `config/`. **No screen component tests, no navigation tests, no integration tests.**

### Lint / Format / Typecheck Setup

**ESLint:**
- Config: `mobile/.eslintrc.js`
- Preset: `eslint-config-expo` (v10)
- Plugins: `prettier`, `@typescript-eslint`
- Rules: Prettier integration, TypeScript v8 rules (`no-empty-object-type`, `no-unsafe-function-type`, `no-wrapper-object-types`)
- Script: `npm run lint`, `npm run lint:fix`

**Prettier:**
- Integrated via ESLint plugin
- Scripts: `npm run format`, `npm run format:check`

**TypeScript:**
- Config: `mobile/tsconfig.json` (extends `expo/tsconfig.base`, `strict: true`)
- Script: `npm run type-check`
- Status: All files are `.ts`/`.tsx`, no `.js` files (except config files)

**Current status:** All checks passing (0 errors, 1 warning about import order - non-blocking).

---

## I. Known Issues / Tech Debt (from code evidence)

### High Priority (Blocks Progress)

1. **ProfileScreen is completely stubbed** (`mobile/src/screens/profile/ProfileScreen.tsx:13`)
   - Shows "Profile screen coming soon..." placeholder
   - Users cannot view/edit their profile after onboarding
   - **Impact:** Cannot update photos, bio, or other profile data

2. **No error retry logic or offline handling**
   - All API calls fail immediately if network unavailable
   - No queue for failed requests
   - No "retry" buttons on error states
   - **Impact:** Poor UX in poor network conditions

3. **ProposeScreen uses hardcoded date/time picker** (`mobile/src/screens/matches/ProposeScreen.tsx:42-43`)
   - Comment says "For MVP, use a simple date picker approach. In production, use a proper date/time picker."
   - Currently just adds 1, 2, or 3 days ahead with fixed 6-8 PM times
   - **Impact:** Users cannot propose custom times, limiting flexibility

4. **PhotosScreen doesn't load existing photos on mount** (`mobile/src/screens/onboarding/PhotosScreen.tsx:19`)
   - `photos` state initialized as empty array
   - No `useEffect` to load existing photos from profile
   - **Impact:** If user navigates back, photos disappear from UI (though still in DB)

5. **No message read receipts or typing indicators in ChatScreen**
   - Chat works but lacks modern chat features
   - **Impact:** Users don't know if messages are read or if other person is typing

### Medium Priority (UX/Polish)

6. **DiscoveryCardStack has potential memory leak** (`mobile/src/components/DiscoveryCardStack.tsx:107`)
   - Renders up to 3 cards but doesn't clean up `Animated.ValueXY` instances
   - **Impact:** Memory usage grows with many swipes

7. **Error handling utilities not used** (`mobile/src/lib/errors.ts`)
   - `formatError()`, `getUserErrorMessage()`, `isRecoverableError()` defined but screens use inline `Alert.alert()`
   - **Impact:** Inconsistent error messages, code duplication

8. **Placeholder images hardcoded** (multiple files)
   - `https://via.placeholder.com/400x500` in `DiscoveryCard.tsx:12`
   - `https://via.placeholder.com/80` in `MatchesScreen.tsx:139`
   - `https://via.placeholder.com/100` in `MatchDetailScreen.tsx:139`
   - **Impact:** External dependency, should use local placeholder asset

9. **No loading states for some async operations**
   - `ProposalCard.handleConfirm()` doesn't show loading spinner during API call
   - Some screens show loading only on initial load, not on refresh
   - **Impact:** Users may click multiple times, causing duplicate API calls

10. **Profile completion logic may race condition** (`mobile/App.tsx:41-56`)
    - Checks `completion_pct` in multiple places (initial load, auth change)
    - If profile updated externally, app may not reflect change until refresh
    - **Impact:** User may see wrong navigator after profile update

### Low Priority (Cleanup)

11. **Empty `todos/` directory** (`mobile/src/screens/todos/`)
    - Likely leftover from testing/development
    - **Impact:** None, just clutter

12. **No shared Button component**
    - Every screen defines its own button styles
    - **Impact:** Inconsistent button styles, code duplication

13. **TypeScript `as any` casts in navigation** (`mobile/src/screens/onboarding/ProfileSetupScreen.tsx:81`)
    - `navigation.navigate('Photos' as any)` - bypasses type safety
    - **Impact:** Potential runtime errors if route name changes

14. **Hardcoded string literals for error messages**
    - Error messages scattered across screens instead of centralized
    - Some match `BRAND_MESSAGES` from `brand.ts`, others don't
    - **Impact:** Hard to update copy, inconsistent messaging

15. **No image optimization or lazy loading**
    - Photos loaded directly from Supabase Storage URLs
    - No image caching or optimization
    - **Impact:** Slow loading on slow connections, high data usage

---

## J. Next Steps (practical)

### To Get to Clean, Shippable MVP

1. **Implement ProfileScreen** (`mobile/src/screens/profile/ProfileScreen.tsx`)
   - Load current user profile from `profiles` table
   - Display/edit: headline, bio, photos
   - Reuse `PhotosScreen` component or extract photo management
   - Save updates to `profiles` table
   - **Files to modify:** `ProfileScreen.tsx`, potentially extract `PhotoManager` component

2. **Fix PhotosScreen to load existing photos** (`mobile/src/screens/onboarding/PhotosScreen.tsx`)
   - Add `useEffect` to load `profiles.photos` on mount
   - Update state with existing photos
   - **File:** `PhotosScreen.tsx:17-21` (add useEffect after useState)

3. **Add proper date/time picker to ProposeScreen** (`mobile/src/screens/matches/ProposeScreen.tsx`)
   - Install `@react-native-community/datetimepicker` or similar
   - Replace hardcoded `addTimeWindow()` logic with actual date/time selection
   - Validate dates are within 7 days (keep existing validation)
   - **Files:** `ProposeScreen.tsx:36-67`, `package.json` (add dependency)

4. **Implement basic error retry logic**
   - Create `useRetryableQuery` hook or similar
   - Add "Retry" button to error states in key screens (DiscoverScreen, MatchesScreen, ChatScreen)
   - Use `isRecoverableError()` from `errors.ts`
   - **Files:** Create `src/lib/hooks/useRetryableQuery.ts`, update error-prone screens

5. **Centralize error messages**
   - Move all error strings to `BRAND_MESSAGES` in `brand.ts` or new `messages.ts`
   - Use `getUserErrorMessage()` from `errors.ts` in all screens
   - **Files:** `brand.ts`, all screen files with `Alert.alert()`

6. **Fix placeholder images**
   - Add placeholder image asset to `assets/`
   - Replace all `https://via.placeholder.com/*` with local asset
   - **Files:** `DiscoveryCard.tsx:12`, `MatchesScreen.tsx:139`, `MatchDetailScreen.tsx:139`, add asset file

7. **Add loading states to ProposalCard** (`mobile/src/components/ProposalCard.tsx`)
   - Show `ActivityIndicator` in `handleConfirm()` during API call
   - Disable buttons while loading
   - **File:** `ProposalCard.tsx:25-59`

8. **Clean up empty directory**
   - Delete `mobile/src/screens/todos/` if not needed
   - **Action:** `rm -rf mobile/src/screens/todos`

**Estimated effort:** Items 1-3 are critical for MVP (8-12 hours). Items 4-8 are polish (4-6 hours). Total: **12-18 hours** to reach clean MVP.

---

## Appendix: Key Files Reference

### Entry Points
- `mobile/App.tsx` - Root component, navigation routing
- `mobile/index.ts` - Expo entry point (register root component)
- `mobile/app.json` - Expo configuration

### Core Infrastructure
- `mobile/src/lib/supabase/client.ts` - Supabase client setup
- `mobile/src/lib/auth.ts` - Auth functions
- `mobile/src/lib/types.ts` - TypeScript types
- `mobile/src/config/brand.ts` - Brand constants

### Navigation
- `mobile/src/navigation/AuthNavigator.tsx`
- `mobile/src/navigation/OnboardingNavigator.tsx`
- `mobile/src/navigation/MainNavigator.tsx`

### Critical Screens
- `mobile/src/screens/discover/DiscoverScreen.tsx` - Main discovery feed
- `mobile/src/screens/matches/ChatScreen.tsx` - Real-time chat
- `mobile/src/screens/profile/ProfileScreen.tsx` - **NEEDS IMPLEMENTATION**

