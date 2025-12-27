# Beta Smoke Test Checklist

**Last updated:** 2025-01-28

This checklist covers the core user loop for beta smoke testing. Focus on critical path functionality only.

## Pre-flight Checks

**⚠️ Complete before starting tests to avoid common setup mistakes:**

- [ ] `npm run use:staging` executed
- [ ] Expo restarted after env switch
- [ ] `npm run verify:staging` passed
- [ ] Phones installed using Expo Go
- [ ] Phones installed using Dev build
- [ ] Phones installed using Production build

## Prerequisites

- [ ] Two test accounts ready (use Gmail plus-addressing: `email+userA@gmail.com`, `email+userB@gmail.com`)
- [ ] Both devices on same network (or tunnel mode for Expo)

---

## Core Loop Checklist

### 1. Auth & Session ✅

**Device A:**

- [ ] Launch app → Welcome/Login screen appears
- [ ] Enter email, tap "Send Magic Link"
- [ ] Open email, tap magic link → App opens and authenticates
- [ ] **Recording required** if deep linking fails
- [ ] Force close app, reopen → Session persists (still logged in)

**Device B:**

- [ ] Repeat above steps with different email

---

### 2. Onboarding (if needed) ✅

**Device A:**

- [ ] Profile setup screen appears (if first time)
- [ ] Enter headline (min 5 chars) and bio (min 20 chars)
- [ ] Submit → Navigate to Photos screen
- [ ] Upload at least 1 photo
- [ ] Tap Continue → Main app loads (Discover tab)

**Device B:**

- [ ] Complete onboarding with different content

**Note:** Skip if both accounts already have completed profiles.

---

### 3. Discovery & Mutual Match ✅

**Device A:**

- [ ] Navigate to Discover tab
- [ ] Swipe right (like) on Device B's profile
- [ ] Profile disappears from feed

**Device B:**

- [ ] Navigate to Discover tab
- [ ] Swipe right (like) on Device A's profile
- [ ] **Match modal appears** ✅
- [ ] **Recording required** if match modal doesn't appear or appears delayed

**Device A:**

- [ ] Navigate to Matches tab
- [ ] **Device B appears in matches list within ~1s** (realtime)
- [ ] **Recording required** if match appears only after manual refresh
- [ ] Tap match → Match Detail screen loads

---

### 4. Proposals (Date/Time Picker) ✅

**Device A:**

- [ ] From Match Detail, tap "Propose 2-3 Times"
- [ ] Date/Time picker appears
- [ ] Select date within next 7 days
- [ ] Add first time window (start < end)
- [ ] Add second time window
- [ ] Attempt to add third window → **Max 3 enforced** ✅
- [ ] Attempt to create overlapping windows → **Validation prevents** ✅
- [ ] Attempt to select date > 7 days away → **Constraint enforced** ✅
- [ ] Submit proposal → Success message appears

**Device B:**

- [ ] Open Match Detail for Device A
- [ ] See active proposal card
- [ ] Tap "Confirm" on one time window
- [ ] **Date Confirmed banner appears** ✅

---

### 5. Chat (Real-time) ✅

**Device A:**

- [ ] From Match Detail (with confirmed date), tap "Open Chat"
- [ ] Chat screen loads with message history (if any)
- [ ] Type message, send
- [ ] Message appears in list immediately

**Device B:**

- [ ] Navigate to Chat screen for Device A match
- [ ] **Message from Device A appears immediately** (realtime)
- [ ] **Recording required** if message doesn't appear without refresh
- [ ] Type reply, send
- [ ] Reply appears immediately

**Device A:**

- [ ] **Reply from Device B appears immediately** (realtime)
- [ ] **Recording required** if reply doesn't appear without refresh

---

### 6. Profile Edit & Photo Delete ✅

**Device A:**

- [ ] Navigate to Profile tab
- [ ] Current headline, bio, and photos display correctly
- [ ] Tap to edit headline → Update text → Save
- [ ] Changes persist (navigate away and back to verify)
- [ ] Tap to delete a photo
- [ ] Photo removed from UI immediately
- [ ] **Verify in Supabase:** Storage file deleted, profile row updated

---

### 7. Sign Out ✅

**Device A:**

- [ ] From Profile tab, tap "Sign Out"
- [ ] Confirmation dialog appears
- [ ] Confirm → User logged out, returns to Welcome/Login screen
- [ ] Attempt to access protected route → Redirects to login

---

## Quick Notes

**Issues Found:**

- [ ] None
- [ ] See bugs section in test run log

**Recording Required For:**

- Deep link failures (auth)
- Realtime match delays
- Realtime chat delays

**Overall Result:**

- [ ] ✅ Pass - Core loop functional
- [ ] ⚠️ Partial - Some issues, but usable
- [ ] ❌ Fail - Critical blockers

---

## Next Steps

After completing smoke test:

- [ ] File bugs found in issue tracker
- [ ] Link to test run log file
- [ ] Tag as "beta-smoke" in issue tracker
