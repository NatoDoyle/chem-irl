import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import MagicLinkSentScreen from '../screens/auth/MagicLinkSentScreen';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  MagicLinkSent: { email: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="MagicLinkSent" component={MagicLinkSentScreen} />
    </Stack.Navigator>
  );
}

