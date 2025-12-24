import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { enableScreens } from 'react-native-screens';
import { supabase } from './src/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { handleMagicLink } from './src/lib/auth';
import AuthNavigator from './src/navigation/AuthNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import MainNavigator from './src/navigation/MainNavigator';

// Enable native screens with proper configuration for new architecture
enableScreens(true);

const Stack = createNativeStackNavigator();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profileComplete, setProfileComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session and profile completion
    const checkSessionAndProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Check if profile is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('completion_pct')
          .eq('user_id', session.user.id)
          .single();

        // If profile is complete, user can access main app
        // Otherwise, they'll need to complete onboarding
        if (profile && profile.completion_pct >= 100) {
          setSession(session);
          setProfileComplete(true);
        } else {
          // Profile incomplete - will show onboarding
          setSession(session); // Still have session, but profile incomplete
          setProfileComplete(false);
        }
      } else {
        setSession(null);
      }
      
      setLoading(false);
    };

    checkSessionAndProfile();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        // Check profile completion on auth change
        const { data: profile } = await supabase
          .from('profiles')
          .select('completion_pct')
          .eq('user_id', session.user.id)
          .single();

        if (profile && profile.completion_pct >= 100) {
          setSession(session);
          setProfileComplete(true);
        } else {
          setSession(session);
          setProfileComplete(false);
        }
      } else {
        setSession(null);
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

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#1453FF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
