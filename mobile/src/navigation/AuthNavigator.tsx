import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthGateScreen from '../screens/auth/AuthGateScreen';
import SignUpEmailScreen from '../screens/auth/SignUpEmailScreen';
import LoginEmailScreen from '../screens/auth/LoginEmailScreen';
import EmailCodeVerifyScreen from '../screens/auth/EmailCodeVerifyScreen';

export type AuthStackParamList = {
  AuthGate: undefined;
  SignUpEmail: { prefillEmail?: string } | undefined;
  LoginEmail: { prefillEmail?: string } | undefined;
  EmailCodeVerify: { email: string; fullName?: string; isSignup: boolean };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  // Navigation is handled by App.tsx via conditional rendering based on session state
  // No imperative navigation needed here

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
