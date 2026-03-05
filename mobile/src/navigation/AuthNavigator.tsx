import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthGateScreen from '../screens/auth/AuthGateScreen';
import SignUpEmailScreen from '../screens/auth/SignUpEmailScreen';
import LoginEmailScreen from '../screens/auth/LoginEmailScreen';
import EmailCodeVerifyScreen from '../screens/auth/EmailCodeVerifyScreen';

export type AuthStackParamList = {
  AuthGate: undefined;
  SignUpEmail: undefined;
  LoginEmail: undefined;
  EmailCodeVerify: { email: string; fullName?: string; isSignup: boolean };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const screenOptions = { headerShown: false };

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName="AuthGate">
      <Stack.Screen name="AuthGate" component={AuthGateScreen} />
      <Stack.Screen name="SignUpEmail" component={SignUpEmailScreen} />
      <Stack.Screen name="LoginEmail" component={LoginEmailScreen} />
      <Stack.Screen name="EmailCodeVerify" component={EmailCodeVerifyScreen} />
    </Stack.Navigator>
  );
}
