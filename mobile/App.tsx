import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  AppState,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from './src/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { handleMagicLink } from './src/lib/auth';
import AuthNavigator from './src/navigation/AuthNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import MainNavigator from './src/navigation/MainNavigator';
import { isSessionExpiredError, getErrorAlert, isRecoverableError } from './src/lib/errors';
import { addBreadcrumb, setUserContext, clearUserContext } from './src/lib/sentry';

const Stack = createNativeStackNavigator();

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
        // Check if profile is complete
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('completion_pct')
          .eq('user_id', session.user.id)
          .single();

        // If profile fetch failed due to session expiry, handle it
        if (profileError && isSessionExpiredError(profileError)) {
          setSessionExpired(true);
          setSession(null);
          setLoading(false);
          setProfileError(null);
          return;
        }

        // If profile fetch failed with recoverable error, retry
        if (profileError && isRecoverableError(profileError) && attempt < MAX_RETRY_ATTEMPTS) {
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
          setRetryAttempts(attempt + 1);
          setTimeout(() => {
            checkSessionAndProfile(attempt + 1);
          }, delay);
          return;
        }

        // If profile fetch failed and retries exhausted or non-recoverable error
        if (profileError) {
          const { message } = getErrorAlert(profileError, 'Failed to load profile');
          setProfileError(message);
          setLoading(false);
          // Still set session so user can try to navigate (though may hit errors)
          setSession(session);
          setProfileComplete(false);
          return;
        }

        // Success - profile loaded
        setProfileError(null);
        setRetryAttempts(0);
        if (profile && profile.completion_pct >= 100) {
          setSession(session);
          setProfileComplete(true);
          setSessionExpired(false);
        } else {
          // Profile incomplete - will show onboarding
          setSession(session);
          setProfileComplete(false);
          setSessionExpired(false);
        }
        setLoading(false);
      } else {
        setSession(null);
        setSessionExpired(false);
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

  useEffect(() => {
    checkSessionAndProfile();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Add breadcrumb for auth state change
      addBreadcrumb(`Auth state changed: ${event}`, 'auth', 'info');

      // Handle session expiry events
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || !session) {
        if (event === 'SIGNED_OUT' || !session) {
          clearUserContext();
          // Check if this is due to expiry or explicit sign out
          // Try to get session to check for expiry error
          try {
            const { error: sessionError } = await supabase.auth.getSession();

            if (sessionError && isSessionExpiredError(sessionError)) {
              setSessionExpired(true);
            }
          } catch (error) {
            if (isSessionExpiredError(error)) {
              setSessionExpired(true);
            }
          }
        }
        clearUserContext();
        setSession(null);
        setProfileComplete(false);
        return;
      }

      if (session) {
        if (session.user) {
          setUserContext(session.user.id, session.user.email || undefined);
        }
        try {
          // Check profile completion on auth change
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('completion_pct')
            .eq('user_id', session.user.id)
            .single();

          // If profile fetch failed due to session expiry, handle it
          if (profileError && isSessionExpiredError(profileError)) {
            setSessionExpired(true);
            setSession(null);
            setProfileComplete(false);
            return;
          }

          if (profile && profile.completion_pct >= 100) {
            setSession(session);
            setProfileComplete(true);
            setSessionExpired(false);
          } else {
            setSession(session);
            setProfileComplete(false);
            setSessionExpired(false);
          }
        } catch (error) {
          if (isSessionExpiredError(error)) {
            setSessionExpired(true);
            setSession(null);
            setProfileComplete(false);
          }
        }
      }
    });

    // Handle deep links (magic links)
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && initialUrl.includes('access_token')) {
        await handleMagicLink(initialUrl);
      }
    };

    handleInitialURL();

    // Listen for deep links while app is running
    const linkingSubscription = Linking.addEventListener('url', async (event) => {
      if (event.url.includes('access_token')) {
        await handleMagicLink(event.url);
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription.remove();
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
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !profileComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
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
