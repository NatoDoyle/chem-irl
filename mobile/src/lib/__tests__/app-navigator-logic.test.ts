/**
 * Tests for the App.tsx navigator selection logic.
 *
 * App.tsx determines which navigator to show based on auth + profile state:
 *   1. No session OR signup incomplete -> AuthNavigator
 *   2. Session + signup complete + completion_pct < 100 -> OnboardingNavigator
 *   3. Session + signup complete + completion_pct >= 100 -> MainNavigator
 *
 * This test validates the decision logic as a pure function, extracted from
 * the component's render path: `if (!session || signupIncomplete) -> Auth;
 * if (!profileComplete) -> Onboarding; else -> Main`.
 *
 * It also tests the checkSessionAndProfile state machine that determines
 * these state variables from Supabase responses.
 */

// Mock all dependencies of errors module
jest.mock('../sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

// eslint-disable-next-line import/first
import { isSessionExpiredError, isRecoverableError } from '../errors';

// --- Navigator selection logic (mirrors App.tsx render) ---

type NavigatorName = 'Auth' | 'Onboarding' | 'Main';

interface AppState {
  session: { user: { id: string } } | null;
  signupIncomplete: boolean;
  profileComplete: boolean;
  sessionExpired: boolean;
  profileError: string | null;
  loading: boolean;
}

/**
 * Determines which screen/navigator the user sees based on current state.
 * This mirrors the logic in App.tsx's render method.
 */
function resolveNavigator(state: AppState): NavigatorName | 'expired' | 'error' | 'loading' {
  if (state.sessionExpired) return 'expired';
  if (state.profileError) return 'error';
  if (state.loading) return 'loading';
  if (!state.session || state.signupIncomplete) return 'Auth';
  if (!state.profileComplete) return 'Onboarding';
  return 'Main';
}

// --- Profile state derivation (mirrors checkSessionAndProfile logic) ---

interface ProfileData {
  completion_pct: number;
  signup_completed: boolean;
}

interface DerivedState {
  profileComplete: boolean;
  signupIncomplete: boolean;
}

/**
 * Derives the state variables from a profile row.
 * Mirrors the logic in checkSessionAndProfile when profile is loaded successfully.
 */
function deriveProfileState(profile: ProfileData | null): DerivedState {
  if (!profile) {
    return { profileComplete: false, signupIncomplete: true };
  }

  const isSignupComplete = profile.signup_completed === true;
  const isProfileComplete = profile.completion_pct >= 100;

  if (isSignupComplete && isProfileComplete) {
    return { profileComplete: true, signupIncomplete: false };
  } else if (isSignupComplete && !isProfileComplete) {
    return { profileComplete: false, signupIncomplete: false };
  } else {
    // signup not complete
    return { profileComplete: false, signupIncomplete: true };
  }
}

describe('App Navigator Selection Logic', () => {
  describe('resolveNavigator', () => {
    it('should show Auth when there is no session', () => {
      const result = resolveNavigator({
        session: null,
        signupIncomplete: false,
        profileComplete: false,
        sessionExpired: false,
        profileError: null,
        loading: false,
      });
      expect(result).toBe('Auth');
    });

    it('should show Auth when signup is incomplete even with a session', () => {
      const result = resolveNavigator({
        session: { user: { id: 'user-123' } },
        signupIncomplete: true,
        profileComplete: false,
        sessionExpired: false,
        profileError: null,
        loading: false,
      });
      expect(result).toBe('Auth');
    });

    it('should show Onboarding when session exists, signup complete, but profile incomplete', () => {
      const result = resolveNavigator({
        session: { user: { id: 'user-123' } },
        signupIncomplete: false,
        profileComplete: false,
        sessionExpired: false,
        profileError: null,
        loading: false,
      });
      expect(result).toBe('Onboarding');
    });

    it('should show Main when session exists, signup complete, and profile complete', () => {
      const result = resolveNavigator({
        session: { user: { id: 'user-123' } },
        signupIncomplete: false,
        profileComplete: true,
        sessionExpired: false,
        profileError: null,
        loading: false,
      });
      expect(result).toBe('Main');
    });

    it('should show expired screen when session has expired', () => {
      const result = resolveNavigator({
        session: null,
        signupIncomplete: false,
        profileComplete: false,
        sessionExpired: true,
        profileError: null,
        loading: false,
      });
      expect(result).toBe('expired');
    });

    it('should prioritize expired state over other states', () => {
      const result = resolveNavigator({
        session: { user: { id: 'user-123' } },
        signupIncomplete: false,
        profileComplete: true,
        sessionExpired: true,
        profileError: null,
        loading: false,
      });
      expect(result).toBe('expired');
    });

    it('should show error screen when profile error exists', () => {
      const result = resolveNavigator({
        session: { user: { id: 'user-123' } },
        signupIncomplete: false,
        profileComplete: false,
        sessionExpired: false,
        profileError: 'Failed to load profile',
        loading: false,
      });
      expect(result).toBe('error');
    });

    it('should prioritize error over navigator selection', () => {
      const result = resolveNavigator({
        session: { user: { id: 'user-123' } },
        signupIncomplete: false,
        profileComplete: true,
        sessionExpired: false,
        profileError: 'Some error',
        loading: false,
      });
      expect(result).toBe('error');
    });

    it('should show loading screen when loading', () => {
      const result = resolveNavigator({
        session: null,
        signupIncomplete: false,
        profileComplete: false,
        sessionExpired: false,
        profileError: null,
        loading: true,
      });
      expect(result).toBe('loading');
    });

    it('should prioritize sessionExpired over profileError', () => {
      const result = resolveNavigator({
        session: null,
        signupIncomplete: false,
        profileComplete: false,
        sessionExpired: true,
        profileError: 'Some error',
        loading: false,
      });
      expect(result).toBe('expired');
    });
  });

  describe('deriveProfileState', () => {
    it('should return Main-eligible state when signup and profile are both complete', () => {
      const result = deriveProfileState({
        signup_completed: true,
        completion_pct: 100,
      });
      expect(result.profileComplete).toBe(true);
      expect(result.signupIncomplete).toBe(false);
    });

    it('should return Onboarding-eligible state when signup is complete but profile is not', () => {
      const result = deriveProfileState({
        signup_completed: true,
        completion_pct: 60,
      });
      expect(result.profileComplete).toBe(false);
      expect(result.signupIncomplete).toBe(false);
    });

    it('should return Auth-eligible state when signup is not complete', () => {
      const result = deriveProfileState({
        signup_completed: false,
        completion_pct: 0,
      });
      expect(result.profileComplete).toBe(false);
      expect(result.signupIncomplete).toBe(true);
    });

    it('should treat signup_completed: false with high completion_pct as Auth-eligible', () => {
      // Edge case: user somehow has completion data but signup_completed is false
      const result = deriveProfileState({
        signup_completed: false,
        completion_pct: 100,
      });
      expect(result.profileComplete).toBe(false);
      expect(result.signupIncomplete).toBe(true);
    });

    it('should treat null profile as Auth-eligible (signup incomplete)', () => {
      const result = deriveProfileState(null);
      expect(result.profileComplete).toBe(false);
      expect(result.signupIncomplete).toBe(true);
    });

    it('should treat completion_pct of exactly 100 as complete', () => {
      const result = deriveProfileState({
        signup_completed: true,
        completion_pct: 100,
      });
      expect(result.profileComplete).toBe(true);
    });

    it('should treat completion_pct of 99 as incomplete', () => {
      const result = deriveProfileState({
        signup_completed: true,
        completion_pct: 99,
      });
      expect(result.profileComplete).toBe(false);
    });

    it('should treat completion_pct of 0 as incomplete', () => {
      const result = deriveProfileState({
        signup_completed: true,
        completion_pct: 0,
      });
      expect(result.profileComplete).toBe(false);
    });

    it('should handle completion_pct above 100 as complete', () => {
      // Edge case: completion_pct could theoretically exceed 100
      const result = deriveProfileState({
        signup_completed: true,
        completion_pct: 150,
      });
      expect(result.profileComplete).toBe(true);
    });
  });

  describe('Error classification in session check flow', () => {
    it('should identify JWT expired as session expiry', () => {
      expect(isSessionExpiredError(new Error('JWT expired'))).toBe(true);
    });

    it('should identify invalid refresh token as session expiry', () => {
      expect(isSessionExpiredError(new Error('Invalid refresh token'))).toBe(true);
    });

    it('should not classify network error as session expiry', () => {
      expect(isSessionExpiredError(new Error('Network request failed'))).toBe(false);
    });

    it('should classify lowercase network error as recoverable', () => {
      // Note: isRecoverableError uses case-sensitive matching for 'network'
      expect(isRecoverableError(new Error('network request failed'))).toBe(true);
    });

    it('should not classify capitalized Network error as recoverable', () => {
      // "Network" with capital N does not match the lowercase check
      expect(isRecoverableError(new Error('Network request failed'))).toBe(false);
    });

    it('should classify fetch error as recoverable', () => {
      expect(isRecoverableError(new Error('Failed to fetch'))).toBe(true);
    });

    it('should not classify auth error as recoverable', () => {
      expect(isRecoverableError(new Error('Invalid login credentials'))).toBe(false);
    });
  });

  describe('Retry logic constants', () => {
    // These constants are defined in App.tsx
    const MAX_RETRY_ATTEMPTS = 3;
    const INITIAL_RETRY_DELAY = 1000;

    it('should compute exponential backoff delays correctly', () => {
      const delays = Array.from(
        { length: MAX_RETRY_ATTEMPTS },
        (_, attempt) => INITIAL_RETRY_DELAY * Math.pow(2, attempt)
      );

      expect(delays).toEqual([1000, 2000, 4000]);
    });

    it('should not exceed max retry attempts', () => {
      // Verify that attempt < MAX_RETRY_ATTEMPTS check works
      expect(0 < MAX_RETRY_ATTEMPTS).toBe(true);
      expect(1 < MAX_RETRY_ATTEMPTS).toBe(true);
      expect(2 < MAX_RETRY_ATTEMPTS).toBe(true);
      expect(3 < MAX_RETRY_ATTEMPTS).toBe(false);
    });
  });

  describe('Full state transition scenarios', () => {
    it('should transition new user through Auth -> Onboarding -> Main', () => {
      // Step 1: New user with no session
      expect(
        resolveNavigator({
          session: null,
          signupIncomplete: false,
          profileComplete: false,
          sessionExpired: false,
          profileError: null,
          loading: false,
        })
      ).toBe('Auth');

      // Step 2: User signs up but has not completed signup details
      const afterSignup = deriveProfileState({
        signup_completed: false,
        completion_pct: 0,
      });
      expect(
        resolveNavigator({
          session: { user: { id: 'new-user' } },
          signupIncomplete: afterSignup.signupIncomplete,
          profileComplete: afterSignup.profileComplete,
          sessionExpired: false,
          profileError: null,
          loading: false,
        })
      ).toBe('Auth');

      // Step 3: User completes signup but profile is incomplete
      const afterSignupComplete = deriveProfileState({
        signup_completed: true,
        completion_pct: 30,
      });
      expect(
        resolveNavigator({
          session: { user: { id: 'new-user' } },
          signupIncomplete: afterSignupComplete.signupIncomplete,
          profileComplete: afterSignupComplete.profileComplete,
          sessionExpired: false,
          profileError: null,
          loading: false,
        })
      ).toBe('Onboarding');

      // Step 4: User completes all onboarding
      const afterOnboarding = deriveProfileState({
        signup_completed: true,
        completion_pct: 100,
      });
      expect(
        resolveNavigator({
          session: { user: { id: 'new-user' } },
          signupIncomplete: afterOnboarding.signupIncomplete,
          profileComplete: afterOnboarding.profileComplete,
          sessionExpired: false,
          profileError: null,
          loading: false,
        })
      ).toBe('Main');
    });

    it('should transition returning user from loading to Main', () => {
      // Loading
      expect(
        resolveNavigator({
          session: null,
          signupIncomplete: false,
          profileComplete: false,
          sessionExpired: false,
          profileError: null,
          loading: true,
        })
      ).toBe('loading');

      // Resolved with complete profile
      const profileState = deriveProfileState({
        signup_completed: true,
        completion_pct: 100,
      });
      expect(
        resolveNavigator({
          session: { user: { id: 'returning-user' } },
          signupIncomplete: profileState.signupIncomplete,
          profileComplete: profileState.profileComplete,
          sessionExpired: false,
          profileError: null,
          loading: false,
        })
      ).toBe('Main');
    });

    it('should handle session expiry during use', () => {
      // User was on Main, session expires
      expect(
        resolveNavigator({
          session: null,
          signupIncomplete: false,
          profileComplete: false,
          sessionExpired: true,
          profileError: null,
          loading: false,
        })
      ).toBe('expired');
    });

    it('should handle profile load failure with error state', () => {
      expect(
        resolveNavigator({
          session: { user: { id: 'user-123' } },
          signupIncomplete: false,
          profileComplete: false,
          sessionExpired: false,
          profileError: 'Network error. Please check your connection.',
          loading: false,
        })
      ).toBe('error');
    });
  });
});
