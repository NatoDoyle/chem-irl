# Onboarding Flow Implementation Guide

## Overview

This document describes the implementation of the strict 26-step onboarding flow. The infrastructure is in place, and this guide explains how to complete the remaining screens.

## What's Been Implemented

### Database
- ✅ Migration `20260107000000_add_onboarding_fields.sql` adds all required fields to `profiles` table
- ✅ `onboarding` JSONB field for state tracking
- ✅ All profile fields for onboarding data

### Core Infrastructure
- ✅ `src/lib/onboarding/constants.ts` - Step definitions, validation rules, phase structure
- ✅ `src/lib/onboarding/flowGuard.ts` - Flow guard logic to determine next unresolved step
- ✅ `src/lib/onboarding/bioGenerator.ts` - Bio generation from collected data
- ✅ `src/components/onboarding/FlowGuard.tsx` - Component that gates app access
- ✅ `src/components/onboarding/BaseOnboardingScreen.tsx` - Reusable base component for all screens

### Screens Implemented
- ✅ `DateOfBirthScreen.tsx` - Phase 2, Step 5 (example implementation)
- ✅ `PhotosScreen.tsx` - Phase 3, Step 9 (exists, needs min 2 photos enforcement)

### Navigation
- ✅ `OnboardingNavigator.tsx` - All routes defined, placeholders for unimplemented screens

## What Needs Implementation

### Phase 1: Account, Safety & Legal (Handled in Auth Flow)
These steps are already handled in the existing auth flow:
- Account creation (Apple/Google/Phone)
- Terms acceptance
- Email verification (OTP)
- Phone verification (OTP)

**Action**: Ensure these mark their steps as resolved in onboarding state when complete.

### Phase 2: Core Eligibility & Matching
- ✅ Date of Birth - **IMPLEMENTED**
- ⏳ Gender Identity - Multi-select screen needed
- ⏳ Interested In - Multi-select screen needed
- ⏳ Location Permission - Permission request screen needed

### Phase 3: Visual Identity & Trust
- ⏳ Profile Photos - **EXISTS** but needs min 2 photos enforcement before allowing continue

### Phase 4: High-Signal Profile Data
All screens need implementation:
- ⏳ Height (with "Prefer not to say" option)
- ⏳ Languages (multi-select, min 1)
- ⏳ Relationship Intent (with skip option)
- ⏳ Family Plans (with skip option)
- ⏳ Pets (with skip option)
- ⏳ Substances (drinking, smoking, drugs - all with skip options)
- ⏳ Lifestyle Habits (activity level required, diet optional with skip)

### Phase 5: Personality & Social Context
All screens need implementation:
- ⏳ Interests (min 3 or explicit skip)
- ⏳ Ideal First Dates (up to 3, can reuse ProfileScreen logic)
- ⏳ Love Language (select or skip)
- ⏳ Personality Type (select or skip)
- ⏳ Astrology Sign (select or skip)
- ⏳ Work & Education (job title and education, both can skip)

### Phase 6: Bio Generation & Verification
- ⏳ Bio - Generate using `bioGenerator.ts`, allow edit/accept
- ⏳ Photo Verification - Stub implementation needed (mark as verified for now)

### Phase 7: Final Review & Entry
- ⏳ Profile Review - Summary screen with edit shortcuts
- ⏳ Enter App - Final step that marks onboarding complete

## Implementation Pattern

Each screen should follow this pattern (see `DateOfBirthScreen.tsx` as example):

```typescript
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { useState, useEffect } from 'react';
// ... other imports

export default function YourScreen() {
  const [data, setData] = useState(/* initial state */);
  const [loading, setLoading] = useState(false);

  // Load existing data
  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    // Load from Supabase
  };

  const handleContinue = async () => {
    // Validate
    // Save to Supabase
    // Return { success: boolean, error?: string }
  };

  const handleSkip = async () => {
    // If skippable, save skip state
    // Return { success: boolean, error?: string }
  };

  const canContinue = /* validation logic */;

  return (
    <BaseOnboardingScreen
      stepId="your_step_id"
      onContinue={handleContinue}
      onSkip={handleSkip} // Only if skippable
      canContinue={canContinue}
      loading={loading}
      showSkip={true} // Only if skippable
    >
      {/* Your UI here */}
    </BaseOnboardingScreen>
  );
}
```

## Key Requirements Per Screen Type

### Multi-Select Screens (Gender, Interested In, Languages, Interests)
- Use checkboxes or toggle buttons
- Enforce minimum selections per validation rules
- Save as text[] array

### Select or Skip Screens (Height, Intent, Family Plans, etc.)
- Provide "Prefer not to say" / "Skip" option
- Show confirmation dialog when skipping
- Save either the value or skip flag

### Required Screens (DOB, Gender, Photos, Bio, etc.)
- No skip option
- Must validate before allowing continue
- Show clear error messages

## Database Field Mappings

When saving data, map to these profile fields:
- `height_cm` / `height_prefer_not_say`
- `languages` (text[])
- `relationship_intent`
- `family_plans`
- `pets`
- `drinking`, `smoking`, `drugs`
- `activity_level`, `diet`
- `interests` (text[]), `interests_skipped`
- `favourite_first_dates` (text[]) - already exists
- `love_language`
- `personality_type`
- `astrology_sign`
- `job_title`, `education`
- `bio`
- `photo_verification_status`

## Integration with App.tsx

The `FlowGuard` component should be integrated into `App.tsx` to:
1. Check onboarding status on app launch
2. Route to onboarding if incomplete
3. Allow main app access only when complete

## Testing Checklist

For each screen:
- [ ] Loads existing data correctly
- [ ] Validates input per rules
- [ ] Saves to Supabase correctly
- [ ] Marks step as resolved in onboarding state
- [ ] Handles errors gracefully
- [ ] Shows appropriate skip option (if allowed)
- [ ] Requires skip confirmation (if required)
- [ ] Disables continue until valid
- [ ] Navigation works correctly

## Next Steps

1. Implement remaining Phase 2 screens (Gender, Interested In, Location)
2. Update PhotosScreen to enforce min 2 photos
3. Implement all Phase 4 screens
4. Implement all Phase 5 screens
5. Implement Bio screen with generation
6. Implement Photo Verification stub
7. Implement Profile Review screen
8. Implement Enter App screen
9. Integrate FlowGuard into App.tsx
10. Test complete flow end-to-end

## Notes

- Photo Verification is a stub - implement actual verification later
- Some screens can reuse logic from ProfileScreen (e.g., Ideal First Dates)
- All validation rules are defined in `constants.ts`
- Flow guard automatically determines next step - no manual navigation needed
