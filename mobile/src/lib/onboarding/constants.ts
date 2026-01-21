/**
 * Onboarding step constants and flow configuration
 * Defines the strict 26-step onboarding flow with phases and validation rules
 */

export type OnboardingStepId =
  // Phase 1: Account, Safety & Legal (NON-SKIPPABLE)
  | 'account_creation'
  | 'terms_acceptance'
  | 'email_verification'
  | 'phone_verification'
  // Phase 2: Core Eligibility & Matching (NON-SKIPPABLE)
  | 'date_of_birth'
  | 'gender_identity'
  | 'interested_in'
  | 'location_permission'
  // Phase 3: Visual Identity & Trust (NON-SKIPPABLE)
  | 'profile_photos'
  // Phase 4: High-Signal Profile Data (MANDATORY OR EXPLICIT SKIP)
  | 'height'
  | 'languages'
  | 'relationship_intent'
  | 'family_plans'
  | 'pets'
  | 'substances' // drinking, smoking, drugs
  | 'lifestyle_habits' // activity_level, diet
  // Phase 5: Personality & Social Context (OPTIONAL BUT ENFORCED)
  | 'interests'
  | 'ideal_first_dates'
  | 'love_language'
  | 'personality_type'
  | 'astrology_sign'
  | 'work_education'
  // Phase 6: Bio Generation & Verification (NON-SKIPPABLE)
  | 'bio'
  | 'photo_verification'
  // Phase 7: Final Review & Entry
  | 'profile_review'
  | 'enter_app';

export type StepStatus = 'completed' | 'skipped';

export interface StepResolution {
  status: StepStatus;
  timestamp: string;
  dataVersion?: number; // For future use if we need to invalidate old data
}

export interface OnboardingState {
  currentStepId: OnboardingStepId | null;
  resolvedSteps: Partial<Record<OnboardingStepId, StepResolution>>;
}

export interface StepConfig {
  id: OnboardingStepId;
  phase: number;
  phaseName: string;
  title: string;
  subtitle?: string;
  skippable: boolean;
  requiresExplicitSkip: boolean; // If true, user must confirm skip
  validation: (data: any) => { valid: boolean; error?: string };
  screenName?: string; // Screen name in OnboardingNavigator (null/undefined = no screen, step is disabled)
  enabled?: boolean; // Feature flag: if false, step is treated as resolved/disabled
}

/**
 * Ordered list of all onboarding steps
 * Note: Phase 1 steps (account_creation, terms_acceptance, email_verification, phone_verification)
 * are handled in the auth flow and marked as resolved there, not in onboarding screens.
 */
export const ONBOARDING_STEPS: OnboardingStepId[] = [
  // Phase 2: Core Eligibility & Matching
  'date_of_birth',
  'gender_identity',
  'interested_in',
  'location_permission',
  // Phase 3: Visual Identity & Trust
  'profile_photos',
  // Phase 4: High-Signal Profile Data
  'height',
  'languages',
  'relationship_intent',
  'family_plans',
  'pets',
  'substances',
  'lifestyle_habits',
  // Phase 5: Personality & Social Context
  'interests',
  'ideal_first_dates',
  'love_language',
  'personality_type',
  'astrology_sign',
  'work_education',
  // Phase 6: Bio Generation & Verification
  'bio',
  'photo_verification',
  // Phase 7: Final Review & Entry
  'profile_review',
  'enter_app',
];

/**
 * Step configurations with validation rules
 */
export const STEP_CONFIGS: Record<OnboardingStepId, StepConfig> = {
  account_creation: {
    id: 'account_creation',
    phase: 1,
    phaseName: 'Account, Safety & Legal',
    title: 'Create Account',
    skippable: false,
    requiresExplicitSkip: false,
    validation: () => ({ valid: true }), // Handled by auth system
    screenName: undefined, // Handled in auth flow
    enabled: true,
  },
  terms_acceptance: {
    id: 'terms_acceptance',
    phase: 1,
    phaseName: 'Account, Safety & Legal',
    title: 'Terms & Privacy Policy',
    subtitle: 'Please review and accept our terms',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: data?.termsAccepted === true,
      error: data?.termsAccepted ? undefined : 'You must accept the terms to continue',
    }),
    screenName: undefined, // Handled in auth flow
    enabled: true,
  },
  email_verification: {
    id: 'email_verification',
    phase: 1,
    phaseName: 'Account, Safety & Legal',
    title: 'Verify Email',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: data?.emailVerified === true,
      error: data?.emailVerified ? undefined : 'Email must be verified',
    }),
    screenName: undefined, // Handled in auth flow
    enabled: true,
  },
  phone_verification: {
    id: 'phone_verification',
    phase: 1,
    phaseName: 'Account, Safety & Legal',
    title: 'Verify Phone Number',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: data?.phoneVerified === true,
      error: data?.phoneVerified ? undefined : 'Phone must be verified',
    }),
    screenName: undefined, // Handled in auth flow, not onboarding
    enabled: false, // Phone auth is temporarily disabled for testing
  },
  date_of_birth: {
    id: 'date_of_birth',
    phase: 2,
    phaseName: 'Core Eligibility & Matching',
    title: 'Date of Birth',
    subtitle: 'You must be 18 or older to use this app',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => {
      if (!data?.dob) {
        return { valid: false, error: 'Date of birth is required' };
      }
      const age = calculateAge(data.dob);
      if (age < 18) {
        return { valid: false, error: 'You must be 18 or older to use this app' };
      }
      return { valid: true };
    },
    screenName: 'DateOfBirth',
    enabled: true,
  },
  gender_identity: {
    id: 'gender_identity',
    phase: 2,
    phaseName: 'Core Eligibility & Matching',
    title: 'Gender Identity',
    subtitle: 'Select all that apply',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: Array.isArray(data?.genderIdentity) && data.genderIdentity.length > 0,
      error:
        Array.isArray(data?.genderIdentity) && data.genderIdentity.length > 0
          ? undefined
          : 'Please select at least one gender identity',
    }),
    screenName: 'GenderIdentity',
    enabled: true,
  },
  interested_in: {
    id: 'interested_in',
    phase: 2,
    phaseName: 'Core Eligibility & Matching',
    title: 'Interested In',
    subtitle: 'Who are you interested in matching with?',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: Array.isArray(data?.interestedIn) && data.interestedIn.length > 0,
      error:
        Array.isArray(data?.interestedIn) && data.interestedIn.length > 0
          ? undefined
          : 'Please select at least one option',
    }),
    screenName: 'InterestedIn',
    enabled: true,
  },
  location_permission: {
    id: 'location_permission',
    phase: 2,
    phaseName: 'Core Eligibility & Matching',
    title: 'Location Permission',
    subtitle: 'We need your location to show nearby matches',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: data?.locationPermissionGranted === true,
      error: data?.locationPermissionGranted
        ? undefined
        : 'Location permission is required to proceed',
    }),
    screenName: 'LocationPermission',
    enabled: true,
  },
  profile_photos: {
    id: 'profile_photos',
    phase: 3,
    phaseName: 'Visual Identity & Trust',
    title: 'Profile Photos',
    subtitle: 'Add at least 2 photos',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: Array.isArray(data?.photos) && data.photos.length >= 2,
      error:
        Array.isArray(data?.photos) && data.photos.length >= 2
          ? undefined
          : 'Please add at least 2 photos',
    }),
    screenName: 'ProfilePhotos',
    enabled: true,
  },
  height: {
    id: 'height',
    phase: 4,
    phaseName: 'High-Signal Profile Data',
    title: 'Height',
    subtitle: 'Optional - you can skip this',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => {
      if (data?.preferNotSay === true) {
        return { valid: true };
      }
      if (data?.heightCm && data.heightCm >= 50 && data.heightCm <= 250) {
        return { valid: true };
      }
      return { valid: false, error: 'Please enter a valid height or choose to skip' };
    },
    screenName: 'Height',
    enabled: true,
  },
  languages: {
    id: 'languages',
    phase: 4,
    phaseName: 'High-Signal Profile Data',
    title: 'Languages Spoken',
    subtitle: 'Select at least one language',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: Array.isArray(data?.languages) && data.languages.length > 0,
      error:
        Array.isArray(data?.languages) && data.languages.length > 0
          ? undefined
          : 'Please select at least one language',
    }),
    screenName: 'Languages',
    enabled: true,
  },
  relationship_intent: {
    id: 'relationship_intent',
    phase: 4,
    phaseName: 'High-Signal Profile Data',
    title: 'Relationship Intent',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => ({
      valid: data?.intent || data?.preferNotSay === true,
      error:
        data?.intent || data?.preferNotSay
          ? undefined
          : 'Please select an option or choose to skip',
    }),
    screenName: 'RelationshipIntent',
    enabled: true,
  },
  family_plans: {
    id: 'family_plans',
    phase: 4,
    phaseName: 'High-Signal Profile Data',
    title: 'Family Plans',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => ({
      valid: data?.familyPlans || data?.preferNotSay === true,
      error:
        data?.familyPlans || data?.preferNotSay
          ? undefined
          : 'Please select an option or choose to skip',
    }),
    screenName: 'FamilyPlans',
    enabled: true,
  },
  pets: {
    id: 'pets',
    phase: 4,
    phaseName: 'High-Signal Profile Data',
    title: 'Pets',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => ({
      valid: data?.pets || data?.preferNotSay === true,
      error:
        data?.pets || data?.preferNotSay ? undefined : 'Please select an option or choose to skip',
    }),
    screenName: 'Pets',
    enabled: true,
  },
  substances: {
    id: 'substances',
    phase: 4,
    phaseName: 'High-Signal Profile Data',
    title: 'Drinking, Smoking & Drugs',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => {
      const hasDrinking = data?.drinking || data?.drinkingPreferNotSay === true;
      const hasSmoking = data?.smoking || data?.smokingPreferNotSay === true;
      const hasDrugs = data?.drugs || data?.drugsPreferNotSay === true;
      return {
        valid: hasDrinking && hasSmoking && hasDrugs,
        error:
          hasDrinking && hasSmoking && hasDrugs
            ? undefined
            : 'Please answer all three questions or choose to skip',
      };
    },
    screenName: 'Substances',
    enabled: true,
  },
  lifestyle_habits: {
    id: 'lifestyle_habits',
    phase: 4,
    phaseName: 'High-Signal Profile Data',
    title: 'Lifestyle Habits',
    subtitle: 'Activity level is required',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => {
      const hasActivityLevel = data?.activityLevel || data?.activityLevelPreferNotSay === true;
      const hasDiet = data?.diet || data?.dietPreferNotSay === true;
      return {
        valid: hasActivityLevel && hasDiet,
        error:
          hasActivityLevel && hasDiet ? undefined : 'Please answer all questions or choose to skip',
      };
    },
    screenName: 'LifestyleHabits',
    enabled: true,
  },
  interests: {
    id: 'interests',
    phase: 5,
    phaseName: 'Personality & Social Context',
    title: 'Interests & Hobbies',
    subtitle: 'Select at least 3 or skip',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => {
      if (data?.skipped === true) {
        return { valid: true };
      }
      return {
        valid: Array.isArray(data?.interests) && data.interests.length >= 3,
        error:
          Array.isArray(data?.interests) && data.interests.length >= 3
            ? undefined
            : 'Please select at least 3 interests or choose to skip',
      };
    },
    screenName: 'Interests',
    enabled: true,
  },
  ideal_first_dates: {
    id: 'ideal_first_dates',
    phase: 5,
    phaseName: 'Personality & Social Context',
    title: 'Ideal First Dates',
    subtitle: 'Choose up to 3 or skip',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => {
      if (data?.skipped === true) {
        return { valid: true };
      }
      const dates = data?.dates || [];
      return {
        valid: Array.isArray(dates) && dates.length <= 3,
        error:
          Array.isArray(dates) && dates.length <= 3
            ? undefined
            : 'You can select up to 3 date ideas',
      };
    },
    screenName: 'IdealFirstDates',
    enabled: true,
  },
  love_language: {
    id: 'love_language',
    phase: 5,
    phaseName: 'Personality & Social Context',
    title: 'Love Language',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => ({
      valid: data?.loveLanguage || data?.skipped === true,
      error:
        data?.loveLanguage || data?.skipped
          ? undefined
          : 'Please select an option or choose to skip',
    }),
    screenName: 'LoveLanguage',
    enabled: true,
  },
  personality_type: {
    id: 'personality_type',
    phase: 5,
    phaseName: 'Personality & Social Context',
    title: 'Personality Type',
    subtitle: 'e.g. MBTI',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => ({
      valid: data?.personalityType || data?.skipped === true,
      error:
        data?.personalityType || data?.skipped
          ? undefined
          : 'Please select an option or choose to skip',
    }),
    screenName: 'PersonalityType',
    enabled: true,
  },
  astrology_sign: {
    id: 'astrology_sign',
    phase: 5,
    phaseName: 'Personality & Social Context',
    title: 'Astrology Sign',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => ({
      valid: data?.astrologySign || data?.skipped === true,
      error:
        data?.astrologySign || data?.skipped
          ? undefined
          : 'Please select an option or choose to skip',
    }),
    screenName: 'AstrologySign',
    enabled: true,
  },
  work_education: {
    id: 'work_education',
    phase: 5,
    phaseName: 'Personality & Social Context',
    title: 'Work & Education',
    skippable: true,
    requiresExplicitSkip: true,
    validation: (data) => {
      const hasJob = data?.jobTitle || data?.jobTitleSkipped === true;
      const hasEducation = data?.education || data?.educationSkipped === true;
      return {
        valid: hasJob && hasEducation,
        error: hasJob && hasEducation ? undefined : 'Please fill in or skip both fields',
      };
    },
    screenName: 'WorkEducation',
    enabled: true,
  },
  bio: {
    id: 'bio',
    phase: 6,
    phaseName: 'Bio Generation & Verification',
    title: 'Bio',
    subtitle: 'We generated a bio for you - edit or accept',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => {
      const bio = data?.bio || '';
      return {
        valid: bio.trim().length >= 20,
        error: bio.trim().length >= 20 ? undefined : 'Bio must be at least 20 characters',
      };
    },
    screenName: 'Bio',
    enabled: true,
  },
  photo_verification: {
    id: 'photo_verification',
    phase: 6,
    phaseName: 'Bio Generation & Verification',
    title: 'Photo Verification',
    subtitle: 'Verify your identity with a selfie',
    skippable: false,
    requiresExplicitSkip: false,
    validation: (data) => ({
      valid: data?.verified === true,
      error: data?.verified ? undefined : 'Photo verification is required',
    }),
    screenName: 'PhotoVerification',
    enabled: true,
  },
  profile_review: {
    id: 'profile_review',
    phase: 7,
    phaseName: 'Final Review & Entry',
    title: 'Review Your Profile',
    skippable: false,
    requiresExplicitSkip: false,
    validation: () => ({ valid: true }), // Review screen is always valid
    screenName: 'ProfileReview',
    enabled: true,
  },
  enter_app: {
    id: 'enter_app',
    phase: 7,
    phaseName: 'Final Review & Entry',
    title: 'Enter App',
    skippable: false,
    requiresExplicitSkip: false,
    validation: () => ({ valid: true }), // Final step
    screenName: 'EnterApp',
    enabled: true,
  },
};

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: string | Date): number {
  const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Dev-only: Validate that all enabled steps have screenName
 * This runs at module load time in development
 */
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const missingScreenNames: OnboardingStepId[] = [];
  for (const stepId of ONBOARDING_STEPS) {
    const config = STEP_CONFIGS[stepId];
    if (config.enabled !== false && !config.screenName) {
      missingScreenNames.push(stepId);
    }
  }
  if (missingScreenNames.length > 0) {
    const errorMsg = `[constants.ts] Enabled steps missing screenName: ${missingScreenNames.join(', ')}`;
    console.error(errorMsg);
    // Alert will be shown at runtime in BaseOnboardingScreen if navigation fails
  }
}
