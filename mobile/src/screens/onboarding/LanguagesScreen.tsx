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
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type LanguagesScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'Languages'
>;

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Other',
];

export default function LanguagesScreen() {
  const navigation = useNavigation<LanguagesScreenNavigationProp>();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleLanguage = (language: string) => {
    if (selectedLanguages.includes(language)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== language));
    } else {
      setSelectedLanguages([...selectedLanguages, language]);
    }
  };

  const handleContinue = async () => {
    if (selectedLanguages.length === 0) {
      Alert.alert('Selection required', 'Please select at least one language');
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
            languages: selectedLanguages,
          },
        },
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save languages');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_languages_completed', {
        count: selectedLanguages.length,
      });

      // Navigate to next screen
      navigation.navigate('RelationshipIntent');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save languages');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>What languages do you speak?</Text>
      <Text style={styles.subtitle}>Select at least one language</Text>

      <View style={styles.form}>
        {LANGUAGE_OPTIONS.map((language) => {
          const isSelected = selectedLanguages.includes(language);
          return (
            <TouchableOpacity
              key={language}
              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
              onPress={() => toggleLanguage(language)}
              disabled={loading}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {language}
              </Text>
              {isSelected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[
            styles.button,
            (selectedLanguages.length === 0 || loading) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={selectedLanguages.length === 0 || loading}
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
    backgroundColor: GOLDEN_HOUR.bg,
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
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 16,
    backgroundColor: GOLDEN_HOUR.inputBg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  checkmark: {
    fontSize: 18,
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
  },
  button: {
    marginTop: 8,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
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
