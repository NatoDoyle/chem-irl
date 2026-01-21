import {
  NavigationContainer,
  NavigationContainerRef,
  CommonActions,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  ActivityIndicator,
  View,
  AppState,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
// Linking import removed - no longer using deep links for auth
import { supabase } from './src/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
// Magic link handling removed - using OTP code entry instead
import AuthNavigator from './src/navigation/AuthNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import FlowGuard from './src/components/onboarding/FlowGuard';
import { loadOnboardingState, isOnboardingComplete } from './src/lib/onboarding/flowGuard';
import { isSessionExpiredError, getErrorAlert, isRecoverableError } from './src/lib/errors';
import { addBreadcrumb, setUserContext, clearUserContext } from './src/lib/sentry';
import { identifyUser, resetUser } from './src/lib/analytics';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  setupNotificationListeners,
  handleNotificationTap,
} from './src/lib/notifications';
import { AppBootstrapContext } from './src/context/AppBootstrapContext';

const Stack = createNativeStackNavigator();

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Helper to compare sessions by user.id, access_token, and expires_at
function sameSession(a: Session | null, b: Session | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.user.id === b.user.id && a.access_token === b.access_token && a.expires_at === b.expires_at
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [profileComplete, setProfileComplete] = useState(false); // Kept for backward compatibility
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [signupIncomplete, setSignupIncomplete] = useState(false);
  const [navReady, setNavReady] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  // Setup AppState listener for auth token refresh
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Retry logic with exponential backoff
  const checkSessionAndProfile = useCallback(async (attempt: number = 0): Promise<void> => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // Check if session retrieval failed due to expiry
      if (sessionError && isSessionExpiredError(sessionError)) {
        setSessionExpired((prev) => (prev !== true ? true : prev));
        setSession((prev) => (prev !== null ? null : prev));
        setLoading((prev) => (prev !== false ? false : prev));
        setProfileError((prev) => (prev !== null ? null : prev));
        return;
      }

      if (session) {
        // Check if profile is complete and signup is completed
        const userId = session.user.id;
        if (__DEV__) {
          console.log(
            '[App.checkSessionAndProfile] Querying profile for user:',
            userId.substring(0, 8)
          );
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('completion_pct, signup_completed')
          .eq('id', userId)
          .maybeSingle();

        if (__DEV__ && profileError) {
          console.error('[App.checkSessionAndProfile] Profile query error:', {
            userId: userId.substring(0, 8),
            error: profileError.message,
            code: (profileError as any).code,
            details: (profileError as any).details,
            hint: (profileError as any).hint,
          });
        }

        // If profile fetch failed due to session expiry, handle it
        if (profileError && isSessionExpiredError(profileError)) {
          setSessionExpired((prev) => (prev !== true ? true : prev));
          setSession((prev) => (prev !== null ? null : prev));
          setLoading((prev) => (prev !== false ? false : prev));
          setProfileError((prev) => (prev !== null ? null : prev));
          return;
        }

        // If profile fetch failed with recoverable error, retry
        if (profileError && isRecoverableError(profileError) && attempt < MAX_RETRY_ATTEMPTS) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          setRetryAttempts((prev) => {
            const next = attempt + 1;
            return prev !== next ? next : prev;
          });
          setTimeout(() => {
            checkSessionAndProfile(attempt + 1);
          }, delay);
          return;
        }

        // If profile doesn't exist, create a minimal one
        if (!profile && !profileError) {
          console.log(
            '[App.checkSessionAndProfile] Profile not found, creating minimal profile for user:',
            userId.substring(0, 8)
          );
          const { error: upsertError } = await supabase.from('profiles').upsert({
            id: userId,
            completion_pct: 0,
            signup_completed: false,
            prompts: {},
            availability: {},
            photos: [],
          });

          if (upsertError) {
            console.error('Error creating profile:', upsertError);
            const { message } = getErrorAlert(upsertError, 'Failed to create profile');
            setProfileError((prev) => (prev !== message ? message : prev));
            setLoading((prev) => (prev !== false ? false : prev));
            setSession((prev) => (sameSession(prev, session) ? prev : session));
            setProfileComplete((prev) => (prev !== false ? false : prev));
            return;
          }

          // Profile created, treat as onboarding state
          setSession((prev) => (sameSession(prev, session) ? prev : session));
          setProfileComplete((prev) => (prev !== false ? false : prev));
          setSessionExpired((prev) => (prev !== false ? false : prev));
          setSignupIncomplete((prev) => (prev !== true ? true : prev));
          setLoading((prev) => (prev !== false ? false : prev));
          return;
        }

        // If profile fetch failed and retries exhausted or non-recoverable error
        if (profileError) {
          const { message } = getErrorAlert(profileError, 'Failed to load profile');
          setProfileError((prev) => (prev !== message ? message : prev));
          setLoading((prev) => (prev !== false ? false : prev));
          // Still set session so user can try to navigate (though may hit errors)
          setSession((prev) => (sameSession(prev, session) ? prev : session));
          setProfileComplete((prev) => (prev !== false ? false : prev));
          return;
        }

        // Success - profile loaded
        setProfileError((prev) => (prev !== null ? null : prev));
        setRetryAttempts((prev) => (prev !== 0 ? 0 : prev));
        // Check both signup_completed and profile completion
        const isSignupComplete = profile?.signup_completed === true;
        const isProfileComplete = profile?.completion_pct >= 100;

        if (isSignupComplete && isProfileComplete) {
          // Fully signed up and profile complete - show main app
          setSession((prev) => (sameSession(prev, session) ? prev : session));
          setProfileComplete((prev) => (prev !== true ? true : prev));
          setSessionExpired((prev) => (prev !== false ? false : prev));
          setSignupIncomplete((prev) => (prev !== false ? false : prev));
        } else if (isSignupComplete && !isProfileComplete) {
          // Signup complete but profile incomplete - show onboarding
          setSession((prev) => (sameSession(prev, session) ? prev : session));
          setProfileComplete((prev) => (prev !== false ? false : prev));
          setSessionExpired((prev) => (prev !== false ? false : prev));
          setSignupIncomplete((prev) => (prev !== false ? false : prev));
        } else {
          // Signup not complete - user must complete email verification and name entry
          setSession((prev) => (sameSession(prev, session) ? prev : session));
          setProfileComplete((prev) => (prev !== false ? false : prev));
          setSessionExpired((prev) => (prev !== false ? false : prev));
          setSignupIncomplete((prev) => (prev !== true ? true : prev));
        }
        setLoading((prev) => (prev !== false ? false : prev));
      } else {
        setSession((prev) => (prev !== null ? null : prev));
        setSessionExpired((prev) => (prev !== false ? false : prev));
        setProfileError((prev) => (prev !== null ? null : prev));
        setRetryAttempts((prev) => (prev !== 0 ? 0 : prev));
        setLoading((prev) => (prev !== false ? false : prev));
      }
    } catch (error) {
      // If error indicates session expiry, handle it
      if (isSessionExpiredError(error)) {
        setSessionExpired((prev) => (prev !== true ? true : prev));
        setSession((prev) => (prev !== null ? null : prev));
        setProfileError((prev) => (prev !== null ? null : prev));
        setLoading((prev) => (prev !== false ? false : prev));
        return;
      }

      // If recoverable error and retries left, retry
      if (isRecoverableError(error) && attempt < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        setRetryAttempts((prev) => {
          const next = attempt + 1;
          return prev !== next ? next : prev;
        });
        setTimeout(() => {
          checkSessionAndProfile(attempt + 1);
        }, delay);
        return;
      }

      // Non-recoverable or retries exhausted
      const { message } = getErrorAlert(error, 'Failed to initialize app');
      setProfileError((prev) => (prev !== message ? message : prev));
      setLoading((prev) => (prev !== false ? false : prev));
    }
  }, []);

  useEffect(() => {
    const isInitializingRef = { current: true };
    let isProcessingAuthChange = false;
    const lastProcessedEventRef = { current: { event: '', sessionId: '' } };

    // Initial session check
    checkSessionAndProfile().finally(() => {
      // Mark initialization complete after a brief delay to avoid race with INITIAL_SESSION event
      setTimeout(() => {
        isInitializingRef.current = false;
      }, 100);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Prevent concurrent executions of this callback
      if (isProcessingAuthChange) {
        console.log('Skipping concurrent auth state change:', event);
        return;
      }

      // Skip INITIAL_SESSION event if we just ran checkSessionAndProfile
      // This prevents duplicate state updates during initialization
      if (event === 'INITIAL_SESSION' && isInitializingRef.current) {
        return;
      }

      // Skip if we just processed the same event with the same session
      const sessionId = session?.user?.id || 'no-session';
      if (
        lastProcessedEventRef.current.event === event &&
        lastProcessedEventRef.current.sessionId === sessionId
      ) {
        console.log('Skipping duplicate auth state change:', event, sessionId);
        return;
      }

      isProcessingAuthChange = true;
      lastProcessedEventRef.current = { event, sessionId };

      try {
        // Temporary debug logging
        console.log('[App] auth event', event, 'session?', !!session);

        // Add breadcrumb for auth state change
        addBreadcrumb(`Auth state changed: ${event}`, 'auth', 'info');

        // Handle TOKEN_REFRESHED - update session without clearing state
        // Only update if session actually changed (token refresh changes access_token/expires_at)
        if (event === 'TOKEN_REFRESHED' && session) {
          setSession((prev) => {
            // For TOKEN_REFRESHED, we want to update even if user.id is same (token changed)
            if (prev === null) return session;
            if (prev.user.id !== session.user.id) return session;
            // Only skip update if token and expiry are identical
            if (
              prev.access_token === session.access_token &&
              prev.expires_at === session.expires_at
            ) {
              return prev;
            }
            return session;
          });
          return;
        }

        // Handle session expiry events (SIGNED_OUT or missing session)
        if (event === 'SIGNED_OUT' || !session) {
          clearUserContext();
          // Check if this is due to expiry or explicit sign out
          // Try to get session to check for expiry error
          try {
            const { error: sessionError } = await supabase.auth.getSession();

            if (sessionError && isSessionExpiredError(sessionError)) {
              setSessionExpired((prev) => (prev !== true ? true : prev));
            }
          } catch (error) {
            if (isSessionExpiredError(error)) {
              setSessionExpired((prev) => (prev !== true ? true : prev));
            }
          }
          clearUserContext();
          resetUser();
          unregisterDeviceToken().catch((error) => {
            console.error('Error unregistering device token:', error);
          });
          setSession((prev) => (prev !== null ? null : prev));
          setProfileComplete((prev) => (prev !== false ? false : prev));

          // Fallback: If navigation doesn't reroute automatically, reset to Auth screen
          // This ensures the app exits the authed state immediately
          // Note: App.tsx conditionally renders AuthNavigator when session is null,
          // so this reset is only needed if navigation state doesn't update automatically
          setTimeout(() => {
            if (navigationRef.current?.isReady()) {
              try {
                const currentState = navigationRef.current.getState();
                const routeNames = currentState?.routes?.map((r) => r.name) || [];
                const currentRoute = currentState?.routes?.[currentState.index];

                if (__DEV__) {
                  console.log(
                    '[App] SIGNED_OUT: current routes =',
                    routeNames,
                    'current route =',
                    currentRoute?.name
                  );
                }

                // Only reset if we're still on a non-auth screen
                // The route name "Auth" matches Stack.Screen name="Auth" in the same navigator
                if (currentRoute?.name !== 'Auth') {
                  if (__DEV__) {
                    console.log('[App] SIGNED_OUT: navigation fallback - resetting to Auth');
                  }
                  navigationRef.current?.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{ name: 'Auth' }],
                    })
                  );
                } else if (__DEV__) {
                  console.log('[App] SIGNED_OUT: already on Auth route, no reset needed');
                }
              } catch (error) {
                console.error('[App] SIGNED_OUT: error checking navigation state:', error);
                // Don't crash - navigation reset is a fallback, not critical
              }
            }
          }, 100);

          return;
        }

        if (session) {
          if (session.user) {
            setUserContext(session.user.id, session.user.email || undefined);
            identifyUser(session.user.id, {
              email: session.user.email || undefined,
            });
            // Register device for push notifications
            registerDeviceToken().catch((error) => {
              console.error('Error registering device token:', error);
            });
          }
          try {
            // Only check profile on INITIAL_SESSION or USER_UPDATED events, not on TOKEN_REFRESHED
            // TOKEN_REFRESHED only updates the session token, profile doesn't change
            if (event === 'TOKEN_REFRESHED') {
              // For TOKEN_REFRESHED, just update session if needed (already handled above)
              // This return prevents duplicate profile checks
              return;
            }

            // Check profile completion and signup status on auth change
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('completion_pct, signup_completed')
              .eq('user_id', session.user.id)
              .maybeSingle();

            // If profile fetch failed due to session expiry, handle it
            if (profileError && isSessionExpiredError(profileError)) {
              setSessionExpired((prev) => (prev !== true ? true : prev));
              setSession((prev) => (prev !== null ? null : prev));
              setProfileComplete((prev) => (prev !== false ? false : prev));
              return;
            }

            // If profile doesn't exist, create a minimal one
            if (!profile && !profileError) {
              console.log(
                'Profile not found on auth change, creating minimal profile for user:',
                session.user.id
              );
              const { error: upsertError } = await supabase.from('profiles').upsert({
                user_id: session.user.id,
                completion_pct: 0,
                signup_completed: false,
                prompts: {},
                availability: {},
                photos: [],
              });

              if (upsertError) {
                console.error('Error creating profile on auth change:', upsertError);
                // Continue with onboarding state even if upsert fails
              }

              // Profile created or failed, treat as onboarding state
              // Only update state if values are different
              setSession((prev) => (sameSession(prev, session) ? prev : session));
              setProfileComplete((prev) => (prev !== false ? false : prev));
              setSessionExpired((prev) => (prev !== false ? false : prev));
              setSignupIncomplete((prev) => (prev !== true ? true : prev));
              return;
            }

            const isSignupComplete = profile?.signup_completed === true;

            // Check onboarding completion using FlowGuard
            let isOnboardingDone = false;
            if (isSignupComplete) {
              try {
                const { profile: onboardingProfile, onboardingState } = await loadOnboardingState();
                if (onboardingProfile) {
                  isOnboardingDone = isOnboardingComplete(
                    onboardingProfile,
                    onboardingState || undefined
                  );
                }
              } catch (error) {
                console.error('Error checking onboarding status:', error);
                // Default to false if check fails
              }
            }

            // Only update state if values are different
            if (isSignupComplete && isOnboardingDone) {
              setSession((prev) => (sameSession(prev, session) ? prev : session));
              setProfileComplete((prev) => (prev !== true ? true : prev));
              setOnboardingComplete((prev) => (prev !== true ? true : prev));
              setSessionExpired((prev) => (prev !== false ? false : prev));
              setSignupIncomplete((prev) => (prev !== false ? false : prev));
            } else if (isSignupComplete && !isOnboardingDone) {
              setSession((prev) => (sameSession(prev, session) ? prev : session));
              setProfileComplete((prev) => (prev !== false ? false : prev));
              setOnboardingComplete((prev) => (prev !== false ? false : prev));
              setSessionExpired((prev) => (prev !== false ? false : prev));
              setSignupIncomplete((prev) => (prev !== false ? false : prev));
            } else {
              // Signup not complete - user must complete email verification and name entry
              setSession((prev) => (sameSession(prev, session) ? prev : session));
              setProfileComplete((prev) => (prev !== false ? false : prev));
              setOnboardingComplete((prev) => (prev !== false ? false : prev));
              setSessionExpired((prev) => (prev !== false ? false : prev));
              setSignupIncomplete((prev) => (prev !== true ? true : prev));
            }
          } catch (error) {
            if (isSessionExpiredError(error)) {
              setSessionExpired((prev) => (prev !== true ? true : prev));
              setSession((prev) => (prev !== null ? null : prev));
              setProfileComplete((prev) => (prev !== false ? false : prev));
            }
          }
        }
      } finally {
        isProcessingAuthChange = false;
      }
    });

    // Deep link handling removed - using OTP code entry instead of magic links

    // Setup notification listeners
    const notificationCleanup = setupNotificationListeners(
      (notification) => {
        // Notification received while app is foregrounded
        console.log('Notification received:', notification);
      },
      (notification) => {
        // Notification tapped - handle deep link with navigation ref
        handleNotificationTap(notification, navigationRef.current);
      }
    );

    return () => {
      subscription.unsubscribe();
      notificationCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - checkSessionAndProfile is stable

  // All hooks must be declared before any conditional returns
  const refreshSessionAndProfile = useCallback(() => {
    checkSessionAndProfile(0);
  }, [checkSessionAndProfile]);

  const completeOnboarding = useCallback(() => {
    // Idempotent: only update state if it actually needs to change
    setProfileComplete((prev) => (prev === true ? prev : true));
    setSignupIncomplete((prev) => (prev === false ? prev : false));
    setProfileError((prev) => (prev === null ? prev : null));
    setLoading((prev) => (prev === false ? prev : false));
  }, []);

  const contextValue = useMemo(
    () => ({ refreshSessionAndProfile, completeOnboarding }),
    [refreshSessionAndProfile, completeOnboarding]
  );

  // Handle session expiry - show clear message and allow re-auth
  if (sessionExpired) {
    return (
      <View style={styles.expiredContainer}>
        <Text style={styles.expiredTitle}>Session Expired</Text>
        <Text style={styles.expiredMessage}>
          Your session has expired. Please sign in again to continue.
        </Text>
        <TouchableOpacity
          style={styles.signInButton}
          onPress={() => {
            setSessionExpired(false);
            setSession(null);
          }}
        >
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Handle profile load error with retry
  if (profileError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Unable to Load Profile</Text>
        <Text style={styles.errorMessage}>{profileError}</Text>
        {retryAttempts > 0 && (
          <Text style={styles.retryInfo}>
            Retried {retryAttempts} time{retryAttempts > 1 ? 's' : ''}
          </Text>
        )}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setProfileError(null);
            setRetryAttempts(0);
            setLoading(true);
            checkSessionAndProfile(0);
          }}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1453FF" />
        {retryAttempts > 0 && (
          <Text style={styles.retryLoadingText}>
            Retrying... ({retryAttempts}/{MAX_RETRY_ATTEMPTS})
          </Text>
        )}
      </View>
    );
  }

  const screenOptions = { headerShown: false };

  return (
    <AppBootstrapContext.Provider value={contextValue}>
      <NavigationContainer
        ref={navigationRef}
        onReady={() => {
          setNavReady(true);
        }}
      >
        <Stack.Navigator screenOptions={screenOptions}>
          {!session || signupIncomplete ? (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          ) : !onboardingComplete ? (
            <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
          ) : (
            <Stack.Screen name="Main" component={MainNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {/* FlowGuard ensures users are routed to the correct onboarding step */}
      {session && !signupIncomplete && !onboardingComplete && (
        <FlowGuard
          navigationRef={navigationRef}
          session={session}
          navReady={navReady}
          onComplete={() => {
            // Re-check onboarding status and update state
            loadOnboardingState()
              .then(({ profile, onboardingState }) => {
                if (profile) {
                  const isComplete = isOnboardingComplete(profile, onboardingState || undefined);
                  if (isComplete) {
                    setOnboardingComplete(true);
                  }
                }
              })
              .catch((error) => {
                console.error('FlowGuard: Error re-checking onboarding status', error);
              });
          }}
        />
      )}
    </AppBootstrapContext.Provider>
  );
}

const styles = StyleSheet.create({
  expiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  expiredTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  expiredMessage: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  signInButton: {
    backgroundColor: '#1453FF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  retryInfo: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: '#1453FF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  retryLoadingText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
});
