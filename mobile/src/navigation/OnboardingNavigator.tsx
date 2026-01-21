/**
 * Onboarding Navigator - Handles all 26 onboarding steps
 * Routes are defined but some screens are placeholders that need implementation
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Phase 1: Account, Safety & Legal
// Note: account_creation, terms_acceptance, email_verification, phone_verification
// are handled in AuthNavigator - they're included here for completeness but
// the actual screens are in the auth flow

// Phase 2: Core Eligibility & Matching
import DateOfBirthScreen from '../screens/onboarding/DateOfBirthScreen';
import GenderIdentityScreen from '../screens/onboarding/GenderIdentityScreen';
import InterestedInScreen from '../screens/onboarding/InterestedInScreen';
import LocationPermissionScreen from '../screens/onboarding/LocationPermissionScreen';

// Phase 3: Visual Identity & Trust
import PhotosScreen from '../screens/onboarding/PhotosScreen';

// Phase 4: High-Signal Profile Data
import HeightScreen from '../screens/onboarding/HeightScreen';
import LanguagesScreen from '../screens/onboarding/LanguagesScreen';
import RelationshipIntentScreen from '../screens/onboarding/RelationshipIntentScreen';
import FamilyPlansScreen from '../screens/onboarding/FamilyPlansScreen';
import PetsScreen from '../screens/onboarding/PetsScreen';
import SubstancesScreen from '../screens/onboarding/SubstancesScreen';
import LifestyleHabitsScreen from '../screens/onboarding/LifestyleHabitsScreen';

// Phase 5: Personality & Social Context
import InterestsScreen from '../screens/onboarding/InterestsScreen';
import IdealFirstDatesScreen from '../screens/onboarding/IdealFirstDatesScreen';
import LoveLanguageScreen from '../screens/onboarding/LoveLanguageScreen';
import PersonalityTypeScreen from '../screens/onboarding/PersonalityTypeScreen';
import AstrologySignScreen from '../screens/onboarding/AstrologySignScreen';
import WorkEducationScreen from '../screens/onboarding/WorkEducationScreen';

// Phase 6: Bio Generation & Verification
import BioScreen from '../screens/onboarding/BioScreen';
import PhotoVerificationScreen from '../screens/onboarding/PhotoVerificationScreen';

// Phase 7: Final Review & Entry
import ProfileReviewScreen from '../screens/onboarding/ProfileReviewScreen';
import EnterAppScreen from '../screens/onboarding/EnterAppScreen';

export type OnboardingStackParamList = {
  // Phase 1 (handled in auth, but listed for completeness)
  AccountCreation: undefined;
  TermsAcceptance: undefined;
  EmailVerification: undefined;
  PhoneVerification: undefined;
  // Phase 2
  DateOfBirth: undefined;
  GenderIdentity: undefined;
  InterestedIn: undefined;
  LocationPermission: undefined;
  // Phase 3
  ProfilePhotos: undefined;
  // Phase 4
  Height: undefined;
  Languages: undefined;
  RelationshipIntent: undefined;
  FamilyPlans: undefined;
  Pets: undefined;
  Substances: undefined;
  LifestyleHabits: undefined;
  // Phase 5
  Interests: undefined;
  IdealFirstDates: undefined;
  LoveLanguage: undefined;
  PersonalityType: undefined;
  AstrologySign: undefined;
  WorkEducation: undefined;
  // Phase 6
  Bio: undefined;
  PhotoVerification: undefined;
  // Phase 7
  ProfileReview: undefined;
  EnterApp: undefined;
};

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export default function OnboardingNavigator({ route }: any) {
  // Get initial step from route params if provided
  const initialStep = route?.params?.initialStep || 'date_of_birth';

  // Map step IDs to screen names
  const stepToScreen: Record<string, keyof OnboardingStackParamList> = {
    date_of_birth: 'DateOfBirth',
    gender_identity: 'GenderIdentity',
    interested_in: 'InterestedIn',
    location_permission: 'LocationPermission',
    profile_photos: 'ProfilePhotos',
    height: 'Height',
    languages: 'Languages',
    relationship_intent: 'RelationshipIntent',
    family_plans: 'FamilyPlans',
    pets: 'Pets',
    substances: 'Substances',
    lifestyle_habits: 'LifestyleHabits',
    interests: 'Interests',
    ideal_first_dates: 'IdealFirstDates',
    love_language: 'LoveLanguage',
    personality_type: 'PersonalityType',
    astrology_sign: 'AstrologySign',
    work_education: 'WorkEducation',
    bio: 'Bio',
    photo_verification: 'PhotoVerification',
    profile_review: 'ProfileReview',
    enter_app: 'EnterApp',
  };

  const initialRouteName = stepToScreen[initialStep] || 'DateOfBirth';

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
      initialRouteName={initialRouteName}
    >
      {/* Phase 2: Core Eligibility & Matching */}
      <Stack.Screen
        name="DateOfBirth"
        component={DateOfBirthScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="GenderIdentity"
        component={GenderIdentityScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="InterestedIn"
        component={InterestedInScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="LocationPermission"
        component={LocationPermissionScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      {/* Phase 3: Visual Identity & Trust */}
      <Stack.Screen
        name="ProfilePhotos"
        component={PhotosScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      {/* Phase 4: High-Signal Profile Data */}
      <Stack.Screen name="Height" component={HeightScreen} />
      <Stack.Screen
        name="Languages"
        component={LanguagesScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen name="RelationshipIntent" component={RelationshipIntentScreen} />
      <Stack.Screen name="FamilyPlans" component={FamilyPlansScreen} />
      <Stack.Screen name="Pets" component={PetsScreen} />
      <Stack.Screen name="Substances" component={SubstancesScreen} />
      <Stack.Screen name="LifestyleHabits" component={LifestyleHabitsScreen} />

      {/* Phase 5: Personality & Social Context */}
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="IdealFirstDates" component={IdealFirstDatesScreen} />
      <Stack.Screen name="LoveLanguage" component={LoveLanguageScreen} />
      <Stack.Screen name="PersonalityType" component={PersonalityTypeScreen} />
      <Stack.Screen name="AstrologySign" component={AstrologySignScreen} />
      <Stack.Screen name="WorkEducation" component={WorkEducationScreen} />

      {/* Phase 6: Bio Generation & Verification */}
      <Stack.Screen
        name="Bio"
        component={BioScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="PhotoVerification"
        component={PhotoVerificationScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      {/* Phase 7: Final Review & Entry */}
      <Stack.Screen
        name="ProfileReview"
        component={ProfileReviewScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="EnterApp"
        component={EnterAppScreen}
        options={{
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}
