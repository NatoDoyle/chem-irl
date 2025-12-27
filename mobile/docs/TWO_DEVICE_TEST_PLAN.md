# Two-Device Testing Plan

## Setup

### Accounts

**Account A (Phone A):**
- Email: `your.email+userA@gmail.com` (using Gmail plus-addressing)
- Or create a separate test account
- Complete full onboarding

**Account B (Phone B):**
- Email: `your.email+userB@gmail.com` (using Gmail plus-addressing)
- Or create a separate test account
- Complete full onboarding

**Note:** Gmail plus-addressing allows using `+userA` and `+userB` to create multiple accounts with the same base email.

### Environment

- [ ] Confirm Supabase project: **Staging** vs **Production**
  - Staging recommended for testing
  - Update `.env` with correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY`
- [ ] Both devices connected to same network (for discovery/matching)
- [ ] Both devices have app installed and running

## Test Checklist

### 1. Auth & Deep Linking ✅

**Phone A:**
- [ ] Launch app → Welcome screen appears
- [ ] Navigate to Login screen
- [ ] Enter Account A email
- [ ] Tap "Send Magic Link"
- [ ] Magic Link Sent screen appears
- [ ] Open email app
- [ ] Tap magic link → App opens automatically
- [ ] User is authenticated and sees onboarding or main app

**Phone B:**
- [ ] Repeat above steps with Account B email

**Session Persistence:**
- [ ] Force close app on Phone A
- [ ] Reopen app → User remains authenticated (no login required)
- [ ] Repeat on Phone B

---

### 2. Onboarding ✅

**Phone A:**
- [ ] Profile Setup screen appears (if not completed)
- [ ] Enter headline (min 5 characters)
- [ ] Enter bio (min 20 characters)
- [ ] Submit → Navigates to Photos screen
- [ ] Add at least 1 photo
- [ ] Tap Continue → Navigates to main app (Discover tab)

**Phone B:**
- [ ] Complete onboarding with different headline/bio/photos

---

### 3. Discovery & Matching ✅

**Prerequisites:**
- [ ] Both users have completed onboarding
- [ ] Both users are in discoverable state (check preferences/filters)
- [ ] Both users have compatible preferences (gender/orientation/distance)

**Phone A:**
- [ ] Navigate to Discover tab
- [ ] Swipe right (like) on Phone B's profile
- [ ] Profile disappears from feed

**Phone B:**
- [ ] Navigate to Discover tab
- [ ] Swipe right (like) on Phone A's profile
- [ ] **Match modal should appear** ✅
- [ ] Tap "View Match" → Navigates to Match Detail screen

**Phone A:**
- [ ] Navigate to Matches tab
- [ ] Phone B should appear in matches list
- [ ] Tap match → Match Detail screen loads

**Verification:**
- [ ] Both users see the match in their Matches tab
- [ ] Match Detail shows correct other user's info

---

### 4. Proposals ✅

**Phone A:**
- [ ] Navigate to Matches tab → Open match with Phone B
- [ ] Tap "Propose 2-3 Times" button
- [ ] Date/Time picker appears

**Date/Time Picker Constraints:**
- [ ] Can only select dates within next 7 days ✅
- [ ] Can select start time
- [ ] Can select end time (must be after start time) ✅
- [ ] Validation prevents selecting end time before start time ✅
- [ ] Can add 2nd time window
- [ ] Can add 3rd time window
- [ ] Cannot add 4th time window (max 3) ✅
- [ ] Cannot add overlapping time windows ✅
- [ ] Select 1-3 date types (Coffee, Drinks, etc.)
- [ ] Add optional note
- [ ] Submit proposal → Success message appears

**Phone B:**
- [ ] Navigate to Matches tab → Open match with Phone A
- [ ] Proposal appears with time windows
- [ ] Can confirm or decline proposal

---

### 5. Chat (Real-time) ✅

**Phone A:**
- [ ] Navigate to Match Detail with Phone B
- [ ] If proposal confirmed, tap "Open Chat"
- [ ] Chat screen loads (empty or with messages)

**Real-time Testing:**
- [ ] Phone A: Type a message and send
- [ ] Phone B: Message appears immediately (no refresh needed) ✅
- [ ] Phone B: Reply with a message
- [ ] Phone A: Reply appears immediately ✅
- [ ] Scroll behavior works correctly

**Offline Testing:**
- [ ] Phone A: Turn on airplane mode
- [ ] Phone A: Send message → Should show error or queue message
- [ ] Phone A: Turn off airplane mode
- [ ] Phone A: Message should send when online
- [ ] Phone B: Should receive message

---

### 6. Profile Edit & Photo Management ✅

**Phone A:**
- [ ] Navigate to Profile tab
- [ ] Profile loads with current data (headline, bio, photos)

**Edit Profile:**
- [ ] Change headline → Save → Success message
- [ ] Change bio → Save → Success message
- [ ] Reload app → Changes persist ✅

**Photo Operations:**
- [ ] Add new photo → Photo uploads and appears
- [ ] Remove photo → Photo disappears from UI
- [ ] Verify in Supabase Storage: File is deleted from bucket ✅
- [ ] Verify in database: `profiles.photos` array updated ✅

**Rollback Testing (Photo Deletion):**
- [ ] Phone A: Turn on airplane mode
- [ ] Phone A: Remove photo → Error appears, photo reappears (rollback) ✅
- [ ] Phone A: Turn off airplane mode
- [ ] Phone A: Remove photo → Success, file deleted

**Ownership Guard:**
- [ ] (Unit test covers this) ✅

**DB Failure After Deletion:**
- [ ] (Edge case - verify error message shows warning about storage deletion)

---

### 7. Sentry Verification (Production Builds Only) ⚠️

**Prerequisites:**
- [ ] `EXPO_PUBLIC_ENVIRONMENT=production` in `.env`
- [ ] `EXPO_PUBLIC_SENTRY_DSN` is set
- [ ] Build production app: `eas build --platform ios` or `--platform android`

**Testing:**
- [ ] Trigger an error (e.g., network error in Discover screen)
- [ ] Check Sentry Dashboard → Error event appears ✅
- [ ] Verify stack trace is readable
- [ ] Verify error title/tags are present

**Development Build:**
- [ ] Set `EXPO_PUBLIC_ENVIRONMENT=development`
- [ ] Trigger error → Error should NOT appear in Sentry ✅
- [ ] Error still displays to user correctly

---

## Troubleshooting

### "If A can't see B in Discover"

Check the following:

1. **Profile Completion:**
   - [ ] Both users have `completion_pct >= 100` in database
   - [ ] Both users completed onboarding

2. **Preferences/Filters:**
   - [ ] Check gender preferences match (e.g., if A wants men and B is a woman, and A is straight → won't match)
   - [ ] Check orientation compatibility
   - [ ] Check age range preferences (if implemented)
   - [ ] Check distance/location settings

3. **Database State:**
   - [ ] Both users exist in `users` table
   - [ ] Both users have profiles in `profiles` table
   - [ ] RPC function `get_discovery_feed` is working correctly
   - [ ] Check if there are any RLS (Row Level Security) policies blocking access

4. **Network:**
   - [ ] Both devices on same network
   - [ ] App can reach Supabase (check console for errors)

5. **Already Matched:**
   - [ ] Check if users already have a match in `matches` table
   - [ ] Users who have matched should not appear in discovery feed

6. **Already Swiped:**
   - [ ] Check if user has already swiped on the other user (likes/passes table)
   - [ ] Users who have been swiped on should not reappear

7. **Location/Distance:**
   - [ ] If distance filtering is enabled, verify users are within range
   - [ ] Check `city_id` or location data matches

**Quick Debug Steps:**
1. Use Debug Screen (if enabled) to check current user ID
2. Query Supabase directly: `SELECT * FROM profiles WHERE user_id IN (...)` to verify both profiles exist
3. Check discovery feed RPC: `SELECT * FROM get_discovery_feed(...)` to see who appears
4. Verify preferences in database match expected values

---

## Quick Reset for Testing

Use the Debug Screen (DEV builds only) to quickly reset state:
- Clear AsyncStorage / local cache
- Reset onboarding state (set `completion_pct < 100`)
- Sign out

Or manually:
- Delete app and reinstall
- Or manually update `profiles.completion_pct` in Supabase to reset onboarding
