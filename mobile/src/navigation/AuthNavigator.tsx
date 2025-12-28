import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import AuthGateScreen from '../screens/auth/AuthGateScreen';
import SignUpEmailScreen from '../screens/auth/SignUpEmailScreen';
import EmailCodeVerifyScreen from '../screens/auth/EmailCodeVerifyScreen';
import PhoneEnterScreen from '../screens/auth/PhoneEnterScreen';
import PhoneCodeVerifyScreen from '../screens/auth/PhoneCodeVerifyScreen';
import LoginPhoneScreen from '../screens/auth/LoginPhoneScreen';
import LoginPhoneVerifyScreen from '../screens/auth/LoginPhoneVerifyScreen';
import NameEnterScreen from '../screens/auth/NameEnterScreen';
import { supabase } from '../lib/supabase/client';

export type AuthStackParamList = {
  AuthGate: undefined;
  SignUpEmail: undefined;
  EmailCodeVerify: { email: string; fullName: string; isSignup: boolean };
  PhoneEnter: { email?: string; fullName?: string };
  PhoneCodeVerify: { phone: string; type: 'sms' | 'phone_change'; fullName?: string };
  NameEnter: undefined;
  LoginPhone: undefined;
  LoginPhoneVerify: { phone: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();

  // Check if user has session but signup is incomplete, route to PhoneEnter
  useEffect(() => {
    const checkSignupStatus = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('signup_completed')
          .eq('user_id', session.user.id)
          .single();

        // If user has session but signup not complete, route to phone verification
        if (profile && profile.signup_completed !== true) {
          const email = session.user.email || '';
          // Navigate to PhoneEnter to complete signup
          navigation.navigate('PhoneEnter', { email });
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
      <Stack.Screen name="EmailCodeVerify" component={EmailCodeVerifyScreen} />
      <Stack.Screen name="PhoneEnter" component={PhoneEnterScreen} />
      <Stack.Screen name="PhoneCodeVerify" component={PhoneCodeVerifyScreen} />
      <Stack.Screen name="NameEnter" component={NameEnterScreen} />
      <Stack.Screen name="LoginPhone" component={LoginPhoneScreen} />
      <Stack.Screen name="LoginPhoneVerify" component={LoginPhoneVerifyScreen} />
    </Stack.Navigator>
  );
}
