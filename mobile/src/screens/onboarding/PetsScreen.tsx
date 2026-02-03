import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';

type OnboardingStackParamList = {
  Height: undefined;
  Languages: undefined;
  RelationshipIntent: undefined;
  FamilyPlans: undefined;
  Pets: undefined;
  Lifestyle: undefined;
  ProfileSetup: undefined;
  Photos: undefined;
};

type PetsScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Pets'>;

const PETS_OPTIONS = [
  { value: 'has_pets', label: 'Has pets' },
  { value: 'wants_pets', label: 'Wants pets' },
  { value: 'allergic', label: "Allergic / doesn't want" },
  { value: 'no_preference', label: 'No preference' },
];

export default function PetsScreen() {
  const navigation = useNavigation<PetsScreenNavigationProp>();
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedPet) {
      Alert.alert('Selection required', 'Please select your pets preference');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { title, message } = getErrorAlert('Not authenticated', 'Authentication Error');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Get current profile to merge prompts
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          ...currentPrompts,
          demographics: {
            ...(currentPrompts.demographics || {}),
            pets: selectedPet,
          },
        },
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save pets preference');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_pets_completed', {
        preference: selectedPet,
      });

      // Navigate to next screen
      navigation.navigate('Lifestyle');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save pets preference');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pets</Text>
      <Text style={styles.subtitle}>This helps us match you with compatible people</Text>

      <View style={styles.form}>
        {PETS_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedPet === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedPet(option.value)}
            disabled={loading}
          >
            <Text
              style={[styles.optionText, selectedPet === option.value && styles.optionTextSelected]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, (!selectedPet || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedPet || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
  },
  form: {
    gap: 12,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  optionButtonSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft || '#D1FFFB',
  },
  optionText: {
    fontSize: 18,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  optionTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },
  button: {
    marginTop: 8,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
