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
  Interests: undefined;
  IdealFirstDates: undefined;
  LoveLanguage: undefined;
  PersonalityType: undefined;
  Astrology: undefined;
  WorkEducation: undefined;
  ProfileSetup: undefined;
  Photos: undefined;
};

type LoveLanguageScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'LoveLanguage'
>;

const LOVE_LANGUAGE_OPTIONS = [
  { value: 'words', label: 'Words of Affirmation' },
  { value: 'acts', label: 'Acts of Service' },
  { value: 'gifts', label: 'Receiving Gifts' },
  { value: 'time', label: 'Quality Time' },
  { value: 'touch', label: 'Physical Touch' },
];

export default function LoveLanguageScreen() {
  const navigation = useNavigation<LoveLanguageScreenNavigationProp>();
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
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
          preferences: {
            ...(currentPrompts.preferences || {}),
            love_language: selectedLanguage,
          },
        },
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save love language');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_love_language_completed', {
        hasSelection: !!selectedLanguage,
      });

      // Navigate to next screen
      navigation.navigate('PersonalityType');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save love language');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Immediately skip without confirmation
    setSelectedLanguage(null);
    await handleContinue();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Love language</Text>
      <Text style={styles.subtitle}>How do you prefer to give and receive love?</Text>

      <View style={styles.form}>
        {LOVE_LANGUAGE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedLanguage === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedLanguage(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                selectedLanguage === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.skipButton, loading && styles.buttonDisabled]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
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
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    flex: 2,
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
