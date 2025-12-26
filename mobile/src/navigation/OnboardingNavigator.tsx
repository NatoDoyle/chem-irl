import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import PhotosScreen from '../screens/onboarding/PhotosScreen';

export type OnboardingStackParamList = {
  ProfileSetup: undefined;
  Photos: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Photos" component={PhotosScreen} />
    </Stack.Navigator>
  );
}
