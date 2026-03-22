import {
  NavigationContainer,
  NavigationContainerRef,
  DefaultTheme,
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
import { isSessionExpiredError, getErrorAlert, isRecoverableError } from './src/lib/errors';
import { resolveProfileState } from './src/lib/profile';
import { addBreadcrumb, setUserContext, clearUserContext } from './src/lib/sentry';
import { identifyUser, resetUser } from './src/lib/analytics';
import { BRAND_COLORS, GOLDEN_HOUR } from './src/config/brand';
import {
  registerDeviceToken,
  unregisterDeviceToken,
  setupNotificationListeners,
  handleNotificationTap,
} from './src/lib/notifications';
import ProfileRefreshContext from './src/contexts/ProfileRefreshContext';

const Stack = createNativeStackNavigator();

const GoldenHourTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: GOLDEN_HOUR.bg,
    card: GOLDEN_HOUR.bg,
    border: GOLDEN_HOUR.borderDefault,
  },
};

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. When this is added, you will continue to receive
// `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
// if the user's session is terminated. This should only be registered once.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

const MAX_RETRY_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [signupIncomplete, setSignupIncomplete] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const screenOptions = useMemo(() => ({ headerShown: false }), []);

  // Retry logic with exponential backoff
  const checkSessionAndProfile = useCallback(async (attempt: number = 0): Promise<void> => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      // Check if session retrieval failed due to expiry
      if (sessionError && isSessionExpiredError(sessionError)) {
        setSessionExpired(true);
        setSession(null);
        setLoading(false);
        setProfileError(null);
        return;
      }

      if (session) {
        const state = await resolveProfileState(session.user.id);

        if (state.kind === 'session-expired') {
          setSessionExpired(true);
          setSession(null);
          setLoading(false);
          setProfileError(null);
          return;
        }

        if (state.kind === 'error') {
          // If recoverable error and retries left, retry with backoff
          if (isRecoverableError(new Error(state.message)) && attempt < MAX_RETRY_ATTEMPTS) {
            const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
            setRetryAttempts(attempt + 1);
            setTimeout(() => {
              checkSessionAndProfile(attempt + 1);
            }, delay);
            return;
          }

          const { message } = getErrorAlert(state.message, 'Failed to load profile');
          setProfileError(message);
          setLoading(false);
          setSession(session);
          setProfileComplete(false);
          return;
        }

        // Success - apply resolved state
        setProfileError(null);
        setRetryAttempts(0);
        setSession(session);
        setSessionExpired(false);
        setProfileComplete(state.kind === 'complete');
        setSignupIncomplete(state.kind === 'signup-incomplete');
        setLoading(false);
      } else {
        setSession(null);
        setSessionExpired(false);
        setSignupIncomplete(false);
        setProfileError(null);
        setRetryAttempts(0);
        setLoading(false);
      }
    } catch (error) {
      // If error indicates session expiry, handle it
      if (isSessionExpiredError(error)) {
        setSessionExpired(true);
        setSession(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      // If recoverable error and retries left, retry
      if (isRecoverableError(error) && attempt < MAX_RETRY_ATTEMPTS) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
        setRetryAttempts(attempt + 1);
        setTimeout(() => {
          checkSessionAndProfile(attempt + 1);
        }, delay);
        return;
      }

      // Non-recoverable or retries exhausted
      const { message } = getErrorAlert(error, 'Failed to initialize app');
      setProfileError(message);
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(() => {
    setLoading(true);
    checkSessionAndProfile();
  }, [checkSessionAndProfile]);

  useEffect(() => {
    checkSessionAndProfile();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Add breadcrumb for auth state change
      addBreadcrumb(`Auth state changed: ${event}`, 'auth', 'info');

      // TOKEN_REFRESHED means the session is still valid — just update the session object
      if (event === 'TOKEN_REFRESHED' && session) {
        setSession(session);
        return;
      }

      // Handle signed-out / no-session
      if (event === 'SIGNED_OUT' || !session) {
        clearUserContext();
        resetUser();
        unregisterDeviceToken().catch((err) => {
          console.error('Error unregistering device token:', err);
        });
        setSession(null);
        setProfileComplete(false);
        setSignupIncomplete(false);
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
          const state = await resolveProfileState(session.user.id);

          if (state.kind === 'session-expired') {
            setSessionExpired(true);
            setSession(null);
            setProfileComplete(false);
            return;
          }

          if (state.kind === 'error') {
            // On auth state change, don't retry — just log
            console.warn('[App] Profile resolve error on auth change:', state.message);
            return;
          }

          setSession(session);
          setSessionExpired(false);
          setProfileComplete(state.kind === 'complete');
          setSignupIncomplete(state.kind === 'signup-incomplete');
        } catch (error) {
          if (isSessionExpiredError(error)) {
            setSessionExpired(true);
            setSession(null);
            setProfileComplete(false);
          }
        }
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
  }, [checkSessionAndProfile]);

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
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
        {retryAttempts > 0 && (
          <Text style={styles.retryLoadingText}>
            Retrying... ({retryAttempts}/{MAX_RETRY_ATTEMPTS})
          </Text>
        )}
      </View>
    );
  }

  return (
    <ProfileRefreshContext.Provider value={refreshProfile}>
      <NavigationContainer ref={navigationRef} theme={GoldenHourTheme}>
        <Stack.Navigator screenOptions={screenOptions}>
          <Stack.Screen name="Root">
            {() => {
              if (!session || signupIncomplete) return <AuthNavigator />;
              if (!profileComplete) return <OnboardingNavigator />;
              return <MainNavigator />;
            }}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </ProfileRefreshContext.Provider>
  );
}

const styles = StyleSheet.create({
  expiredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: GOLDEN_HOUR.bg,
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
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: GOLDEN_HOUR.radius.lg,
    minWidth: 200,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
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
    backgroundColor: GOLDEN_HOUR.bg,
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
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: GOLDEN_HOUR.radius.lg,
    minWidth: 200,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
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
