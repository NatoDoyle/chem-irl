import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
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
import { isSessionExpiredError } from './src/lib/errors';

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

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    // Check for existing session and profile completion
    const checkSessionAndProfile = async () => {
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
          return;
        }

        if (session) {
          // Check if profile is complete
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('completion_pct')
            .eq('user_id', session.user.id)
            .single();

          // If profile fetch failed, don't treat as session expiry
          // User can still navigate, profile will show error state
          if (profileError && isSessionExpiredError(profileError)) {
            setSessionExpired(true);
            setSession(null);
            setLoading(false);
            return;
          }

          // If profile is complete, user can access main app
          // Otherwise, they'll need to complete onboarding
          if (profile && profile.completion_pct >= 100) {
            setSession(session);
            setProfileComplete(true);
            setSessionExpired(false);
          } else {
            // Profile incomplete - will show onboarding
            setSession(session); // Still have session, but profile incomplete
            setProfileComplete(false);
            setSessionExpired(false);
          }
        } else {
          setSession(null);
          setSessionExpired(false);
        }
      } catch (error) {
        // If error indicates session expiry, handle it
        if (isSessionExpiredError(error)) {
          setSessionExpired(true);
          setSession(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkSessionAndProfile();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle session expiry events
      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || !session) {
        if (event === 'SIGNED_OUT' || !session) {
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
        setSession(null);
        setProfileComplete(false);
        return;
      }

      if (session) {
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
  }, []);

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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1453FF" />
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
});
