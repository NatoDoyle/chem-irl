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
import { UserOrientation } from '../../lib/types';

type OnboardingStackParamList = {
  DateOfBirth: undefined;
  GenderIdentity: undefined;
  InterestedIn: undefined;
  LocationPermission: undefined;
  ProfileSetup: undefined;
  Photos: undefined;
};

type InterestedInScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'InterestedIn'
>;

const ORIENTATION_OPTIONS: { value: UserOrientation; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bisexual', label: 'Bisexual' },
  { value: 'pansexual', label: 'Pansexual' },
  { value: 'asexual', label: 'Asexual' },
  { value: 'other', label: 'Other' },
];

export default function InterestedInScreen() {
  const navigation = useNavigation<InterestedInScreenNavigationProp>();
  const [selectedOrientation, setSelectedOrientation] = useState<UserOrientation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedOrientation) {
      Alert.alert('Selection required', "Please select who you're interested in");
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

      // Update users table
      const { error } = await supabase
        .from('users')
        .update({ orientation: selectedOrientation })
        .eq('user_id', user.id)
        .select('user_id')
        .single();

      if (error) {
        console.error('Error saving orientation:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const { title, message } = getErrorAlert(error, 'Failed to save preference');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_orientation_completed', {
        orientation: selectedOrientation,
      });

      // Navigate to next screen
      navigation.navigate('LocationPermission');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save preference');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Who are you interested in?</Text>
      <Text style={styles.subtitle}>This helps us show you relevant matches</Text>

      <View style={styles.form}>
        {ORIENTATION_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedOrientation === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedOrientation(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                selectedOrientation === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, (!selectedOrientation || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedOrientation || loading}
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
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
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
