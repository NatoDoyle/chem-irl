import { useEffect, useState } from 'react';
import { createNativeStackNavigator, NativeStackHeaderProps } from '@react-navigation/native-stack';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProgressBar from '../components/ui/ProgressBar';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY } from '../config/brand';
import { supabase } from '../lib/supabase/client';
import { getEntitlement } from '../lib/subscription';
import { hasSeenPitch } from '../lib/iris/pitchSeen';
import GenderIdentityScreen from '../screens/onboarding/GenderIdentityScreen';
import InterestedInScreen from '../screens/onboarding/InterestedInScreen';
import HeightScreen from '../screens/onboarding/HeightScreen';
import LanguagesScreen from '../screens/onboarding/LanguagesScreen';
import RelationshipIntentScreen from '../screens/onboarding/RelationshipIntentScreen';
import FamilyPlansScreen from '../screens/onboarding/FamilyPlansScreen';
import PetsScreen from '../screens/onboarding/PetsScreen';
import LifestyleScreen from '../screens/onboarding/LifestyleScreen';
import InterestsScreen from '../screens/onboarding/InterestsScreen';
import LoveLanguageScreen from '../screens/onboarding/LoveLanguageScreen';
import PersonalityTypeScreen from '../screens/onboarding/PersonalityTypeScreen';
import AstrologyScreen from '../screens/onboarding/AstrologyScreen';
import WorkEducationScreen from '../screens/onboarding/WorkEducationScreen';
import ProfileSetupScreen from '../screens/onboarding/ProfileSetupScreen';
import PhotosScreen from '../screens/onboarding/PhotosScreen';
import LocationPermissionScreen from '../screens/onboarding/LocationPermissionScreen';
import ProfileReviewScreen from '../screens/onboarding/ProfileReviewScreen';
import IrisInterviewScreen from '../screens/iris/IrisInterviewScreen';
import IrisPitchScreen from '../screens/iris/IrisPitchScreen';

export type OnboardingStackParamList = {
  GenderIdentity: undefined;
  InterestedIn: undefined;
  Height: undefined;
  Languages: undefined;
  RelationshipIntent: undefined;
  FamilyPlans: undefined;
  Pets: undefined;
  Lifestyle: undefined;
  Interests: undefined;
  LoveLanguage: undefined;
  PersonalityType: undefined;
  Astrology: undefined;
  WorkEducation: undefined;
  ProfileSetup: undefined;
  Photos: undefined;
  LocationPermission: undefined;
  ProfileReview: undefined;
  // Iris screens are off-track optional surfaces. Deliberately not in
  // SCREEN_ORDER so the step counter on the question screens stays at
  // "X of 17".
  // - IrisPitch: post-signup paywall pitch, shown once per user-device
  //   pair before GenderIdentity. See useInitialOnboardingRoute below.
  // - IrisInterview: bio-writing helper reachable from ProfileReview.
  IrisPitch: undefined;
  IrisInterview: undefined;
};

const SCREEN_ORDER: (keyof OnboardingStackParamList)[] = [
  'GenderIdentity',
  'InterestedIn',
  'Height',
  'Languages',
  'RelationshipIntent',
  'FamilyPlans',
  'Pets',
  'Lifestyle',
  'Interests',
  'LoveLanguage',
  'PersonalityType',
  'Astrology',
  'WorkEducation',
  'ProfileSetup',
  'Photos',
  'LocationPermission',
  'ProfileReview',
];

const TOTAL_STEPS = SCREEN_ORDER.length;

// Resolve the first screen the user should see when OnboardingNavigator
// mounts. Returns null while still resolving so callers can render a
// loader instead of flashing a question screen first.
//
// Order of preference:
//   1. Already entitled (active trial/subscription) → skip pitch.
//   2. Already saw the pitch on this device → skip pitch.
//   3. Otherwise → show IrisPitch.
//
// On any failure we fall back to GenderIdentity rather than blocking
// onboarding behind an entitlement check.
function useInitialOnboardingRoute(): keyof OnboardingStackParamList | null {
  const [route, setRoute] = useState<keyof OnboardingStackParamList | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setRoute('GenderIdentity');
          return;
        }
        const entitlement = await getEntitlement();
        if (cancelled) return;
        if (entitlement.allowed) {
          setRoute('GenderIdentity');
          return;
        }
        const seen = await hasSeenPitch(user.id);
        if (cancelled) return;
        setRoute(seen ? 'GenderIdentity' : 'IrisPitch');
      } catch {
        if (!cancelled) setRoute('GenderIdentity');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return route;
}

function OnboardingHeader({ route }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const step = SCREEN_ORDER.indexOf(route.name as keyof OnboardingStackParamList) + 1;
  const pct = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <Text style={styles.brandName}>Chem IRL</Text>
      <View style={styles.stepRow}>
        <Text style={styles.stepText}>
          STEP {step} OF {TOTAL_STEPS}
        </Text>
        <Text style={styles.stepText}>{pct}% Complete</Text>
      </View>
      <ProgressBar current={step} total={TOTAL_STEPS} />
    </View>
  );
}

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator() {
  const initialRoute = useInitialOnboardingRoute();

  if (!initialRoute) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={BRAND_COLORS.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: true,
        header: (props) => <OnboardingHeader {...props} />,
        contentStyle: { backgroundColor: MIDNIGHT.bg },
      }}
    >
      <Stack.Screen name="IrisPitch" component={IrisPitchScreen} options={{ headerShown: false }} />
      <Stack.Screen name="GenderIdentity" component={GenderIdentityScreen} />
      <Stack.Screen name="InterestedIn" component={InterestedInScreen} />
      <Stack.Screen name="Height" component={HeightScreen} />
      <Stack.Screen name="Languages" component={LanguagesScreen} />
      <Stack.Screen name="RelationshipIntent" component={RelationshipIntentScreen} />
      <Stack.Screen name="FamilyPlans" component={FamilyPlansScreen} />
      <Stack.Screen name="Pets" component={PetsScreen} />
      <Stack.Screen name="Lifestyle" component={LifestyleScreen} />
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="LoveLanguage" component={LoveLanguageScreen} />
      <Stack.Screen name="PersonalityType" component={PersonalityTypeScreen} />
      <Stack.Screen name="Astrology" component={AstrologyScreen} />
      <Stack.Screen name="WorkEducation" component={WorkEducationScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="Photos" component={PhotosScreen} />
      <Stack.Screen name="LocationPermission" component={LocationPermissionScreen} />
      <Stack.Screen name="ProfileReview" component={ProfileReviewScreen} />
      <Stack.Screen
        name="IrisInterview"
        component={IrisInterviewScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: MIDNIGHT.bg,
    paddingHorizontal: 16,
  },
  brandName: {
    fontFamily: TYPOGRAPHY.fontFamily.serifItalic,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: BRAND_COLORS.primary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  stepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.text[600],
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
