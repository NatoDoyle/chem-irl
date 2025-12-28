# Mobile App Release Checklist

**Last verified:** 2025-01-28

## Pre-Build Checks

- [ ] Verify Node.js version matches project requirements (check `package.json` engines if specified)
- [ ] Verify Expo CLI is up-to-date: `npx expo --version`
- [ ] Clean install: `rm -rf node_modules && npm install`
- [ ] Verify environment variables in `.env`:
  - [ ] `EXPO_PUBLIC_SUPABASE_URL` is set
  - [ ] `EXPO_PUBLIC_SUPABASE_KEY` is set
  - [ ] `EXPO_PUBLIC_SENTRY_DSN` is set (if using error logging)
  - [ ] `EXPO_PUBLIC_ENVIRONMENT` is set to `production` for production builds
- [ ] Run `npm run check:env` (should pass)
- [ ] Run `npm run lint` (should pass with 0 errors)
- [ ] Run `npm run type-check` (should pass)
- [ ] Run `npm test` (all tests should pass)

## Manual Smoke Test Flow

### 1. Auth Flow

- [ ] Launch app on device/simulator
- [ ] AuthGate screen displays correctly (Sign up / Log in buttons)
- [ ] Sign up flow: Email → OTP code → Phone → SMS code → Name → Onboarding
- [ ] Log in flow: Phone → SMS code → Main app (or onboarding if incomplete)
- [ ] OTP codes are entered in-app (no browser redirects)

### 2. Onboarding Flow

- [ ] Profile Setup screen loads after auth
- [ ] Enter headline (validates min 5 chars)
- [ ] Enter bio (validates min 20 chars)
- [ ] Submit profile → navigates to Photos screen
- [ ] Photos screen loads (shows existing photos if returning)
- [ ] Add photo via image picker
- [ ] Photo uploads successfully
- [ ] Continue button enables after at least 1 photo
- [ ] Submit photos → navigates to main app

### 3. Discovery & Matching

- [ ] Discover screen loads feed
- [ ] Swipe right (like) on a profile → profile removed from feed
- [ ] Swipe left (pass) on a profile → profile removed from feed
- [ ] When mutual like occurs → Match modal appears
- [ ] Match modal "View Match" button navigates to Match Detail

### 4. Proposals

- [ ] Navigate to Matches tab → list of matches displays
- [ ] Open a match → Match Detail screen loads
- [ ] Tap "Propose 2-3 Times" button
- [ ] Date/time picker works correctly:
  - [ ] Can select date within next 7 days
  - [ ] Can select start time
  - [ ] Can select end time (must be after start time)
  - [ ] Validation prevents overlapping windows
  - [ ] Can add 2-3 windows
- [ ] Select date types (1-3 required)
- [ ] Add optional note
- [ ] Submit proposal → success message, returns to Match Detail

### 5. Chat

- [ ] Navigate to Match Detail
- [ ] If proposal confirmed, tap "Open Chat"
- [ ] Chat screen loads messages (or empty state)
- [ ] Send a message → message appears immediately
- [ ] Receive a message (via another device) → message appears in real-time
- [ ] Scroll behavior works correctly

### 6. Profile Management

- [ ] Navigate to Profile tab
- [ ] Profile loads with current headline, bio, photos
- [ ] Edit headline → save → success message, changes persist
- [ ] Edit bio → save → success message, changes persist
- [ ] Add new photo → photo uploads and appears in list
- [ ] Remove photo:
  - [ ] Photo disappears from UI
  - [ ] Verify in Supabase Storage bucket that file is deleted
  - [ ] Verify in database that profile.photos array is updated

### 7. Sign Out

- [ ] Tap "Sign Out" button
- [ ] User is logged out → returns to Welcome screen

## Storage Deletion Verification

### Test 1: Normal Deletion

1. Open Profile screen
2. Note a photo URL before deletion
3. Remove photo from UI
4. Verify in Supabase Dashboard:
   - [ ] Storage bucket `profiles` no longer contains the file
   - [ ] Database `profiles` row has updated `photos` array (missing URL)
5. Reload app → photo should not reappear

### Test 2: Rollback Behavior (Offline)

1. Put device in airplane mode
2. Remove photo from Profile screen
3. Verify:
   - [ ] Error message appears
   - [ ] Photo reappears in UI (rollback)
   - [ ] Database is NOT updated
4. Re-enable network
5. Photo should still be visible

### Test 3: Ownership Guard

1. Manually construct a URL for a photo that belongs to a different user
2. Attempt to delete it via storage utilities (unit test)
3. Verify:
   - [ ] `deletePhotoFromStorage()` returns error
   - [ ] Storage deletion is NOT attempted
   - [ ] No files are deleted

### Test 4: DB Failure After Deletion

1. Temporarily break database connection (or use invalid user ID)
2. Remove photo → storage deletion succeeds
3. Verify:
   - [ ] Error message appears about database update failure
   - [ ] Warning mentions photo was deleted from storage
   - [ ] Photo UI state is restored (shows original photo)
   - [ ] Storage file is actually deleted (check Supabase)

## Sentry Verification

### Development Environment

1. Set `EXPO_PUBLIC_ENVIRONMENT=development` in `.env`
2. Set `EXPO_PUBLIC_SENTRY_DSN` to valid DSN
3. Start app: `npm start`
4. Trigger an error (e.g., network error in Discover screen)
5. Verify:
   - [ ] Error is NOT sent to Sentry (disabled in dev)
   - [ ] Error still displays to user correctly

### Production Environment

1. Set `EXPO_PUBLIC_ENVIRONMENT=production` in `.env`
2. Build app: `npm run build` or EAS build
3. Install on device
4. Trigger an error
5. Verify in Sentry Dashboard:
   - [ ] Error event appears
   - [ ] Stack trace is readable
   - [ ] Error title/tags are present

### Without Sentry DSN

1. Remove `EXPO_PUBLIC_SENTRY_DSN` from `.env`
2. Start app
3. Verify:
   - [ ] App starts normally (no Sentry errors)
   - [ ] Error handling still works (errors shown to user)

## Post-Release

- [ ] Monitor Sentry dashboard for new errors (if enabled)
- [ ] Verify app store listing information is correct
- [ ] Test deep linking with magic links on fresh install
- [ ] Verify push notifications work (if implemented)
