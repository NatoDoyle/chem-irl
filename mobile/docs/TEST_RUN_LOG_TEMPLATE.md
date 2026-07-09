# Test Run Log

**Date:** [YYYY-MM-DD]  
**Time:** [HH:MM]  
**Tester:** [Name]  
**Git Commit:** [hash] - [short commit message]

## Build Information

**Build Type:**

- [ ] Dev client (`bun start`)
- [ ] Development build (`eas build --profile development`)
- [ ] Production build (`eas build --profile production`)

**Build Details:**

- Platform: [iOS / Android / Both]
- Expo SDK Version: [version]
- App Version: [version]

## Device Information

**Device A (Phone A):**

- Model: [e.g., iPhone 15 Pro, Pixel 8]
- OS: [e.g., iOS 17.2, Android 14]
- App Install Method: [Expo Go / Dev Build / Production]

**Device B (Phone B):**

- Model: [e.g., iPhone 14, Pixel 7]
- OS: [e.g., iOS 16.5, Android 13]
- App Install Method: [Expo Go / Dev Build / Production]

## Test Accounts

**Account A:**

- Email: [email]
- User ID: [from Debug Screen or Supabase]
- Profile Complete: [Yes / No]

**Account B:**

- Email: [email]
- User ID: [from Debug Screen or Supabase]
- Profile Complete: [Yes / No]

**Supabase Project:**

- [ ] Staging
- [ ] Production
- Project URL: [url]

## Test Results

### 1. Auth & Deep Linking

- [ ] Pass
- [ ] Fail
- [ ] Partial
- Notes: [any issues encountered]

### 2. Onboarding

- [ ] Pass
- [ ] Fail
- [ ] Partial
- Notes: [any issues encountered]

### 3. Discovery & Matching

- [ ] Pass
- [ ] Fail
- [ ] Partial
- Notes: [any issues encountered]

### 4. Proposals

- [ ] Pass
- [ ] Fail
- [ ] Partial
- Notes: [any issues encountered]
- **Date/Time Picker:**
  - [ ] Constraints enforced correctly
  - [ ] Overlap validation works
  - [ ] Max 3 windows enforced

### 5. Chat (Real-time)

- [ ] Pass
- [ ] Fail
- [ ] Partial
- Notes: [any issues encountered]
- **Real-time:**
  - [ ] Messages appear immediately
  - [ ] Offline handling works

### 6. Profile Edit & Photo Management

- [ ] Pass
- [ ] Fail
- [ ] Partial
- Notes: [any issues encountered]
- **Photo Deletion:**
  - [ ] Storage file deleted
  - [ ] Database updated
  - [ ] Rollback works when offline

### 7. Sentry Verification (Production Only)

- [ ] Pass
- [ ] Fail
- [ ] N/A (not production build)
- Notes: [any issues encountered]

## Bugs Found

### Bug #1

**Severity:** [Critical / High / Medium / Low]  
**Section:** [e.g., Proposals, Chat]  
**Steps to Reproduce:**

1. [step]
2. [step]
3. [step]

**Expected:** [what should happen]  
**Actual:** [what actually happened]  
**Screenshots/Logs:** [links or references]

---

### Bug #2

**Severity:** [Critical / High / Medium / Low]  
**Section:** [e.g., Discovery]  
**Steps to Reproduce:**

1. [step]
2. [step]
3. [step]

**Expected:** [what should happen]  
**Actual:** [what actually happened]  
**Screenshots/Logs:** [links or references]

---

## General Notes

[Any additional observations, edge cases discovered, performance notes, etc.]

## Next Steps

- [ ] Bugs filed in issue tracker
- [ ] Follow-up tests needed
- [ ] Ready for release / needs fixes
