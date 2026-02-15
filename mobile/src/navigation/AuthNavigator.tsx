import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import AuthGateScreen from '../screens/auth/AuthGateScreen';
import SignUpEmailScreen from '../screens/auth/SignUpEmailScreen';
import LoginEmailScreen from '../screens/auth/LoginEmailScreen';
import EmailCodeVerifyScreen from '../screens/auth/EmailCodeVerifyScreen';
import { supabase } from '../lib/supabase/client';

export type AuthStackParamList = {
  AuthGate: undefined;
  SignUpEmail: undefined;
  LoginEmail: undefined;
  EmailCodeVerify: { email: string; fullName?: string; isSignup: boolean };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  // Check if user has session but signup is incomplete, route to SignUpEmail
  useEffect(() => {
    const checkSignupStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('signup_completed')
          .eq('id', session.user.id)
          .maybeSingle();

        // If user has session but signup not complete, route to signup
        if (profile && profile.signup_completed !== true) {
          navigation.navigate('SignUpEmail');
        }
      }
    };

    checkSignupStatus();
  }, [navigation]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName="AuthGate"
    >
      <Stack.Screen name="AuthGate" component={AuthGateScreen} />
      <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
      <Stack.Screen name="LoginEmail" component={LoginEmailScreen} />
      <Stack.Screen name="EmailCodeVerify" component={EmailCodeVerifyScreen} />
    </Stack.Navigator>
  );
}
