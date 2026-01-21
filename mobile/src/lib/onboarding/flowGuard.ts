/**
 * Flow Guard - Determines the next unresolved onboarding step
 * This is the core gating mechanism that prevents app access until onboarding is complete
 */

import { OnboardingStepId, OnboardingState, STEP_CONFIGS, ONBOARDING_STEPS } from './constants';
import { supabase } from '../supabase/client';

export interface ProfileData {
  onboarding?: OnboardingState;
  photos?: string[];
  dob?: string;
  gender_identity?: string[];
  interested_in?: string[];
  location_permission_granted?: boolean;
  height_cm?: number;
  height_prefer_not_say?: boolean;
  languages?: string[];
  relationship_intent?: string;
  family_plans?: string;
  pets?: string;
  drinking?: string;
  smoking?: string;
  drugs?: string;
  activity_level?: string;
  diet?: string;
  interests?: string[];
  interests_skipped?: boolean;
  favourite_first_dates?: string[];
  love_language?: string;
  personality_type?: string;
  astrology_sign?: string;
  job_title?: string;
  education?: string;
  bio?: string;
  photo_verification_status?: string;
  // Auth-related (from users table or auth context)
  email_verified?: boolean;
  phone_verified?: boolean;
  terms_accepted?: boolean; // This might be stored elsewhere
}

/**
 * Get step data from profile for validation
 */
function getStepData(stepId: OnboardingStepId, profile: ProfileData): any {
  switch (stepId) {
    // Phase 1 steps are handled in auth flow, not in onboarding
    // They are excluded from this function as they're not part of onboarding screens
    case 'date_of_birth':
      return { dob: profile.dob };
    case 'gender_identity':
      return { genderIdentity: profile.gender_identity || [] };
    case 'interested_in':
      return { interestedIn: profile.interested_in || [] };
    case 'location_permission':
      return { locationPermissionGranted: profile.location_permission_granted || false };
    case 'profile_photos':
      return { photos: profile.photos || [] };
    case 'height':
      return {
        heightCm: profile.height_cm,
        preferNotSay: profile.height_prefer_not_say || false,
      };
    case 'languages':
      return { languages: profile.languages || [] };
    case 'relationship_intent':
      return { intent: profile.relationship_intent };
    case 'family_plans':
      return { familyPlans: profile.family_plans };
    case 'pets':
      return { pets: profile.pets };
    case 'substances':
      return {
        drinking: profile.drinking,
        smoking: profile.smoking,
        drugs: profile.drugs,
      };
    case 'lifestyle_habits':
      return {
        activityLevel: profile.activity_level,
        diet: profile.diet,
      };
    case 'interests':
      return {
        interests: profile.interests || [],
        skipped: profile.interests_skipped || false,
      };
    case 'ideal_first_dates':
      return { dates: profile.favourite_first_dates || [] };
    case 'love_language':
      return { loveLanguage: profile.love_language };
    case 'personality_type':
      return { personalityType: profile.personality_type };
    case 'astrology_sign':
      return { astrologySign: profile.astrology_sign };
    case 'work_education':
      return {
        jobTitle: profile.job_title,
        education: profile.education,
      };
    case 'bio':
      return { bio: profile.bio || '' };
    case 'photo_verification':
      return {
        verified: profile.photo_verification_status === 'verified',
      };
    case 'profile_review':
      return { reviewed: true }; // Always valid
    case 'enter_app':
      return { entered: true }; // Always valid
    default:
      return {};
  }
}

/**
 * Check if a step is resolved (completed or explicitly skipped)
 * Also treats steps as resolved if they are disabled (enabled=false) or have no screenName
 */
function isStepResolved(
  stepId: OnboardingStepId,
  profile: ProfileData,
  onboardingState?: OnboardingState
): boolean {
  const stepConfig = STEP_CONFIGS[stepId];

  // If step is disabled (enabled=false), treat it as resolved
  if (stepConfig.enabled === false) {
    return true;
  }

  // If step has no screenName, it's not part of onboarding flow (e.g., handled in auth)
  // Treat it as resolved
  if (!stepConfig.screenName) {
    return true;
  }

  // Check if step is marked as resolved in onboarding state
  if (onboardingState?.resolvedSteps?.[stepId]) {
    return true;
  }

  // Fallback: validate step data to see if it's complete
  const stepData = getStepData(stepId, profile);
  const validation = stepConfig.validation(stepData);

  // If step is valid, it's resolved
  if (validation.valid) {
    return true;
  }

  // If step is skippable and explicitly skipped, it's resolved
  if (stepConfig.skippable) {
    // Check for explicit skip indicators in data
    if (stepData?.skipped === true || stepData?.preferNotSay === true) {
      return true;
    }
  }

  return false;
}

/**
 * Find the next unresolved step in the onboarding flow
 * Returns null if all steps are resolved
 */
export function getNextUnresolvedStep(
  profile: ProfileData,
  onboardingState?: OnboardingState
): OnboardingStepId | null {
  // If onboarding state says we're on a specific step, check if it's resolved
  if (onboardingState?.currentStepId) {
    const currentStep = onboardingState.currentStepId;
    if (!isStepResolved(currentStep, profile, onboardingState)) {
      return currentStep;
    }
  }

  // Otherwise, find the first unresolved step in order
  for (const stepId of ONBOARDING_STEPS) {
    if (!isStepResolved(stepId, profile, onboardingState)) {
      return stepId;
    }
  }

  // All steps resolved
  return null;
}

/**
 * Convenience wrapper for external callers that only need the next unresolved step ID
 */
export function getNextUnresolvedStepId(
  profile: ProfileData,
  onboardingState?: OnboardingState
): OnboardingStepId | null {
  return getNextUnresolvedStep(profile, onboardingState);
}

/**
 * Map an OnboardingStepId to its corresponding screen name in OnboardingNavigator
 * Uses STEP_CONFIGS as the source of truth
 */
export function stepIdToScreenName(stepId: OnboardingStepId): string | null {
  const stepConfig = STEP_CONFIGS[stepId];
  return stepConfig?.screenName || null;
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(
  profile: ProfileData,
  onboardingState?: OnboardingState
): boolean {
  return getNextUnresolvedStep(profile, onboardingState) === null;
}

/**
 * Ensure a profile row exists for the given user ID
 * Creates a minimal profile if it doesn't exist
 */
async function ensureProfileRow(userId: string): Promise<{ success: boolean; error?: Error }> {
  try {
    if (__DEV__) {
      console.log('[ensureProfileRow] Ensuring profile exists for user:', userId.substring(0, 8));
    }

    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        prompts: {} as any,
        availability: {} as any,
        photos: [] as any,
        completion_pct: 0,
        signup_completed: false,
        onboarding: { currentStepId: null, resolvedSteps: {} } as any,
        terms_accepted: false,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('[ensureProfileRow] Failed to create profile:', {
        userId: userId.substring(0, 8),
        error: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      return { success: false, error: new Error(`Failed to create profile: ${error.message}`) };
    }

    if (__DEV__) {
      console.log('[ensureProfileRow] Profile ensured for user:', userId.substring(0, 8));
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error creating profile'),
    };
  }
}

/**
 * Load profile data and onboarding state from Supabase
 */
export async function loadOnboardingState(): Promise<{
  profile: ProfileData | null;
  onboardingState: OnboardingState | null;
  error: Error | null;
}> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { profile: null, onboardingState: null, error: new Error('Not authenticated') };
    }

    // Load profile with all onboarding fields (using canonical 'id' column)
    if (__DEV__) {
      console.log(
        `[loadOnboardingState] Loading profile for user: ${user.id.substring(0, 8)} using id column`
      );
    }

    const userId = user.id;
    if (__DEV__) {
      console.log('[loadOnboardingState] Querying profile for user:', userId.substring(0, 8));
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(
        `
        onboarding,
        photos,
        favourite_first_dates,
        height_cm,
        height_prefer_not_say,
        languages,
        relationship_intent,
        family_plans,
        pets,
        drinking,
        smoking,
        drugs,
        activity_level,
        diet,
        interests,
        interests_skipped,
        love_language,
        personality_type,
        astrology_sign,
        job_title,
        education,
        bio,
        photo_verification_status,
        location_permission_granted,
        last_known_lat,
        last_known_lng
      `
      )
      .eq('id', userId)
      .maybeSingle();

    if (__DEV__) {
      console.log('[loadOnboardingState] Profile query result:', {
        userId: userId.substring(0, 8),
        hasProfile: !!profile,
        profileError: profileError?.message,
        profileErrorCode: (profileError as any)?.code,
        profileErrorStatus: (profileError as any)?.status,
        profileErrorDetails: (profileError as any)?.details,
        profileErrorHint: (profileError as any)?.hint,
      });
    }

    if (profileError) {
      console.error('[loadOnboardingState] Supabase error loading profile:', {
        userId: userId.substring(0, 8),
        error: profileError.message,
        code: (profileError as any).code,
        details: (profileError as any).details,
        hint: (profileError as any).hint,
      });
      return {
        profile: null,
        onboardingState: null,
        error: new Error(`Failed to load profile: ${profileError.message}`),
      };
    }

    // If profile doesn't exist, try to create it
    if (!profile) {
      console.warn(
        '[loadOnboardingState] Profile not found, attempting to create:',
        userId.substring(0, 8)
      );
      const ensureResult = await ensureProfileRow(userId);
      if (!ensureResult.success) {
        const errorMsg = `Profile row missing and failed to create: ${ensureResult.error?.message || 'Unknown error'}`;
        console.error('[loadOnboardingState]', errorMsg);
        return {
          profile: null,
          onboardingState: null,
          error: new Error(errorMsg),
        };
      }

      // Re-fetch profile after creation
      const { data: newProfile, error: refetchError } = await supabase
        .from('profiles')
        .select(
          `
          onboarding,
          photos,
          favourite_first_dates,
          height_cm,
          height_prefer_not_say,
          languages,
          relationship_intent,
          family_plans,
          pets,
          drinking,
          smoking,
          drugs,
          activity_level,
          diet,
          interests,
          interests_skipped,
          love_language,
          personality_type,
          astrology_sign,
          job_title,
          education,
          bio,
          photo_verification_status,
          location_permission_granted,
          last_known_lat,
          last_known_lng
        `
        )
        .eq('id', userId)
        .maybeSingle();

      if (refetchError || !newProfile) {
        const errorMsg = `Profile created but failed to refetch: ${refetchError?.message || 'Profile still missing'}`;
        console.error('[loadOnboardingState]', errorMsg);
        return {
          profile: null,
          onboardingState: null,
          error: new Error(errorMsg),
        };
      }

      // Use the newly created profile
      const fullProfile: ProfileData = {
        ...newProfile,
        dob: undefined,
        gender_identity: [],
        interested_in: [],
        email_verified: false,
        phone_verified: false,
        terms_accepted: false,
      };

      const onboardingState: OnboardingState = {
        currentStepId: null,
        resolvedSteps: {},
      };

      return { profile: fullProfile, onboardingState, error: null };
    }

    console.log(
      '[loadOnboardingState] Profile loaded successfully, onboarding:',
      profile.onboarding
    );

    // Load user data for dob, gender, orientation, email/phone verification
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('dob, gender, orientation, email, phone')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userError) {
      console.warn('Failed to load user data:', userError);
    }

    // Check email/phone verification from auth metadata
    const emailVerified = user.email_confirmed_at !== null;
    const phoneVerified = user.phone_confirmed_at !== null;

    // Profile is guaranteed to exist at this point (checked above)
    const fullProfile: ProfileData = {
      ...profile,
      dob: userData?.dob,
      gender_identity: userData?.gender ? [userData.gender] : [],
      interested_in: userData?.orientation ? [userData.orientation] : [],
      email_verified: emailVerified,
      phone_verified: phoneVerified,
      terms_accepted: false, // TODO: Store this in profiles or separate table
    };

    // Ensure safe defaults for onboarding state
    let onboardingState: OnboardingState;
    if (profile?.onboarding) {
      const parsed = profile.onboarding as OnboardingState;
      onboardingState = {
        currentStepId: parsed.currentStepId ?? null,
        resolvedSteps: parsed.resolvedSteps || {},
      };
    } else {
      onboardingState = {
        currentStepId: null,
        resolvedSteps: {},
      };
    }

    return { profile: fullProfile, onboardingState, error: null };
  } catch (error) {
    return {
      profile: null,
      onboardingState: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}

/**
 * Mark a step as resolved in the onboarding state
 */
export async function markStepResolved(
  stepId: OnboardingStepId,
  status: 'completed' | 'skipped'
): Promise<{ success: boolean; error?: Error }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: new Error('Not authenticated') };
    }

    // Load current onboarding state (using canonical 'id' column)
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding')
      .eq('id', user.id)
      .maybeSingle();

    const currentState: OnboardingState =
      (profile?.onboarding as OnboardingState) ||
      ({
        currentStepId: null,
        resolvedSteps: {},
      } as OnboardingState);

    // Update resolved steps
    const updatedState: OnboardingState = {
      currentStepId: null, // Will be recalculated on next load
      resolvedSteps: {
        ...currentState.resolvedSteps,
        [stepId]: {
          status,
          timestamp: new Date().toISOString(),
        },
      },
    };

    // Update profile (using canonical 'id' column)
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding: updatedState })
      .eq('id', user.id);

    if (error) {
      console.error('[markStepResolved] Supabase update error:', {
        stepId,
        status,
        error: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      return {
        success: false,
        error: new Error(`Failed to update onboarding state: ${error.message}`),
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error('Unknown error'),
    };
  }
}
