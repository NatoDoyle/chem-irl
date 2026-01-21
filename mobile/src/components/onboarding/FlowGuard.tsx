/**
 * FlowGuard - Checks onboarding status and routes to correct step
 * This component ensures users are on the right onboarding step and prevents navigation loops
 */

import { useEffect } from 'react';
import { NavigationContainerRef, CommonActions } from '@react-navigation/native';
import {
  loadOnboardingState,
  getNextUnresolvedStep,
  isOnboardingComplete,
} from '../../lib/onboarding/flowGuard';
import { OnboardingStepId } from '../../lib/onboarding/constants';

interface FlowGuardProps {
  navigationRef: React.RefObject<NavigationContainerRef<any> | null>;
  session: any; // Session from Supabase
  navReady: boolean; // Whether navigation container is ready
  onStepChange?: (step: OnboardingStepId | null) => void;
  onComplete?: () => void; // Callback when onboarding is complete
}

// Shared state for navigation guard (prevents concurrent navigation)
const isNavigatingRef = { current: false };
const lastNavigatedStepRef = { current: null as OnboardingStepId | null };

/**
 * Check onboarding state and route to the next unresolved step
 * Can be called externally (e.g., from BaseOnboardingScreen after marking step resolved)
 */
export async function checkAndRoute(
  navigationRef: React.RefObject<NavigationContainerRef<any> | null>,
  session: any,
  navReady: boolean,
  onStepChange?: (step: OnboardingStepId | null) => void,
  onComplete?: () => void
) {
  // Prevent concurrent navigation
  if (isNavigatingRef.current) {
    return;
  }

  if (!session || !navReady || !navigationRef.current?.isReady()) {
    return;
  }

  console.log('[FlowGuard.checkAndRoute] Starting check:', {
    session: !!session,
    navReady,
    isNavReady: navigationRef.current?.isReady(),
  });

  try {
    const { profile, onboardingState, error: loadError } = await loadOnboardingState();

    if (loadError || !profile) {
      console.error('[FlowGuard.checkAndRoute] Failed to load onboarding state:', {
        loadError: loadError?.message,
        hasProfile: !!profile,
      });
      return;
    }

    // Check if onboarding is complete
    const isComplete = isOnboardingComplete(profile, onboardingState || undefined);
    if (isComplete) {
      console.log('[FlowGuard.checkAndRoute] Onboarding complete');
      if (onComplete) {
        onComplete();
      }
      if (onStepChange) {
        onStepChange(null);
      }
      return;
    }

    const unresolvedStep = getNextUnresolvedStep(profile, onboardingState || undefined);

    console.log('[FlowGuard.checkAndRoute] Unresolved step:', unresolvedStep);

    if (onStepChange) {
      onStepChange(unresolvedStep);
    }

    // Don't navigate if already on the correct step
    if (unresolvedStep === lastNavigatedStepRef.current) {
      console.log('[FlowGuard.checkAndRoute] Already navigated to this step, skipping');
      return;
    }

    if (unresolvedStep && navigationRef.current?.isReady()) {
      // Map step ID to screen name
      // Phase 1 steps (account_creation, terms_acceptance, email_verification, phone_verification)
      // are handled in auth flow and should not appear in onboarding flow
      const stepToScreen: Partial<Record<OnboardingStepId, string>> = {
        date_of_birth: 'DateOfBirth',
        gender_identity: 'GenderIdentity',
        interested_in: 'InterestedIn',
        location_permission: 'LocationPermission',
        profile_photos: 'ProfilePhotos',
        height: 'Height',
        languages: 'Languages',
        relationship_intent: 'RelationshipIntent',
        family_plans: 'FamilyPlans',
        pets: 'Pets',
        substances: 'Substances',
        lifestyle_habits: 'LifestyleHabits',
        interests: 'Interests',
        ideal_first_dates: 'IdealFirstDates',
        love_language: 'LoveLanguage',
        personality_type: 'PersonalityType',
        astrology_sign: 'AstrologySign',
        work_education: 'WorkEducation',
        bio: 'Bio',
        photo_verification: 'PhotoVerification',
        profile_review: 'ProfileReview',
        enter_app: 'EnterApp',
      };

      const screenName = stepToScreen[unresolvedStep] || 'DateOfBirth';

      // Check current route to prevent unnecessary navigation
      const currentState = navigationRef.current.getState();
      const currentRoute = currentState?.routes?.[currentState.index];
      const isOnOnboarding = currentRoute?.name === 'Onboarding';
      const nestedState = currentRoute?.state;
      const nestedIndex = nestedState?.index;
      const nestedRoute =
        nestedState?.routes && nestedIndex !== undefined
          ? nestedState.routes[nestedIndex]
          : undefined;
      const isOnCorrectScreen = nestedRoute?.name === screenName;

      console.log('[FlowGuard.checkAndRoute] Navigation check:', {
        unresolvedStep,
        screenName,
        currentRoute: currentRoute?.name,
        nestedRoute: nestedRoute?.name,
        isOnOnboarding,
        isOnCorrectScreen,
      });

      // Only navigate if not already on the correct screen
      if (!isOnOnboarding || !isOnCorrectScreen) {
        isNavigatingRef.current = true;
        lastNavigatedStepRef.current = unresolvedStep;

        try {
          // Use reset to ensure clean navigation state with nested navigator
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                {
                  name: 'Onboarding',
                  state: {
                    routes: [{ name: screenName }],
                    index: 0,
                  },
                },
              ],
            })
          );
        } catch (navError) {
          console.error('FlowGuard: Navigation error', navError);
          // Fallback to regular navigate
          try {
            navigationRef.current.navigate('Onboarding', {
              screen: screenName,
            });
          } catch (fallbackError) {
            console.error('FlowGuard: Fallback navigation error', fallbackError);
          }
        } finally {
          // Reset navigation guard after a delay
          setTimeout(() => {
            isNavigatingRef.current = false;
          }, 500);
        }
      }
    }
  } catch (err) {
    console.error('FlowGuard: Error checking onboarding status', err);
    isNavigatingRef.current = false;
  }
}

export default function FlowGuard({
  navigationRef,
  session,
  navReady,
  onStepChange,
  onComplete,
}: FlowGuardProps) {
  useEffect(() => {
    if (!session || !navReady || !navigationRef.current?.isReady()) {
      return;
    }

    // Debounce navigation checks to prevent loops
    const timeoutId = setTimeout(() => {
      checkAndRoute(navigationRef, session, navReady, onStepChange, onComplete);
    }, 100);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, navReady]);

  return null; // This component doesn't render anything
}
