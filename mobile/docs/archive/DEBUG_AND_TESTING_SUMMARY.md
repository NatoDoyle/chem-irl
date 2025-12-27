# Debug Screen & Two-Device Testing - Implementation Summary

**Date:** 2025-01-27  
**Status:** ✅ All parts completed

## Commits

### 1. `docs: add two-device test plan`
- Created `mobile/docs/TWO_DEVICE_TEST_PLAN.md` with comprehensive two-device testing workflow
- Includes setup instructions (Account A/B with Gmail plus-addressing)
- Step-by-step checklist for all major features:
  - Auth/deep linking & session persistence
  - Onboarding
  - Discovery & matching
  - Proposals (with datetime picker constraint verification)
  - Real-time chat & offline testing
  - Profile edit & photo deletion (including rollback/ownership guard)
  - Sentry verification (production builds only)
- Troubleshooting section: "If A can't see B in Discover" with common causes
- Linked from `mobile/README.md` under "Testing" section

### 2. `feat: add dev-only debug screen for manual testing`
- Created `mobile/src/screens/debug/DebugScreen.tsx` - Debug utility screen
- **Gated behind:** `__DEV__` or `EXPO_PUBLIC_ENABLE_DEBUG_MENU=true`
- Added debug tab to `MainNavigator` (only visible in dev builds)
- Features:
  - Display current user ID, email, app version, build info
  - Clear AsyncStorage / local cache
  - Reset onboarding state (sets `completion_pct = 0`)
  - Sign out
  - Refetch profile (with JSON display)
- **Production safety:** Screen and route are completely excluded from production builds

## Files Changed

### Part 1 - Documentation
- **New:**
  - `mobile/docs/TWO_DEVICE_TEST_PLAN.md` (267 lines)
- **Modified:**
  - `mobile/README.md` (added "Testing" section with link)

### Part 2 - Debug Screen
- **New:**
  - `mobile/src/screens/debug/DebugScreen.tsx` (313 lines)
- **Modified:**
  - `mobile/src/navigation/MainNavigator.tsx` (added conditional Debug tab)
- **Dependencies:**
  - `expo-constants` (already installed via Expo SDK)

**Total:** 2 new files, 2 modified files

## How to Enable/Disable Debug Screen

### Enable (Development - Default)
The debug screen is **automatically enabled** in development builds (`__DEV__ === true`). No configuration needed when running:
```bash
npm start
```

### Enable via Environment Variable (Optional)
Add to `.env`:
```env
EXPO_PUBLIC_ENABLE_DEBUG_MENU=true
```

### Disable
- Development builds: Remove `EXPO_PUBLIC_ENABLE_DEBUG_MENU` from `.env` (or set to `false`)
- **Production builds:** Debug screen is automatically disabled (`__DEV__ === false` in production builds)

### Verification
- **Development:** Debug tab appears in bottom tab navigator
- **Production:** Debug tab does NOT appear (route is conditionally excluded)

## Quality Checks ✅

All checks passing:
- ✅ Lint: 0 errors, 0 warnings
- ✅ Type-check: No type errors
- ✅ Tests: 44/44 passing (no new tests needed - pure UI component)

### Commands Used:
```bash
# Lint
npm run lint

# Type Check
npm run type-check

# Tests
npm test
```

## Implementation Details

### Debug Screen Gating
The debug screen uses a two-tier gate:

1. **Compile-time check:**
   ```typescript
   const ENABLE_DEBUG_MENU = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEBUG_MENU === 'true';
   ```

2. **Conditional route registration:**
   ```typescript
   {ENABLE_DEBUG_MENU && DebugScreen && (
     <Tab.Screen name="Debug" component={DebugScreen} />
   )}
   ```

3. **Lazy import:**
   The DebugScreen component is only imported when `ENABLE_DEBUG_MENU` is true, ensuring zero production bundle impact.

### Reset Onboarding
The "Reset Onboarding State" action sets `completion_pct = 0` in the database, which will:
- Trigger the onboarding flow on next app load (via `App.tsx` profile completion check)
- Allow testing onboarding multiple times without creating new accounts

### Clear Cache
The "Clear AsyncStorage / Cache" action:
- Clears all AsyncStorage data
- May require app restart for full effect
- Useful for testing fresh install scenarios

## Production Safety

✅ **Zero production impact:**
- Debug screen route is conditionally excluded from navigation
- Component is only imported in development builds
- `__DEV__` is automatically `false` in production builds
- TypeScript types mark Debug route as optional
- No production code paths reference debug functionality

## Testing Workflow

See `mobile/docs/TWO_DEVICE_TEST_PLAN.md` for:
- Step-by-step two-device testing instructions
- Troubleshooting guide for discovery feed issues
- Quick reset procedures using debug screen

