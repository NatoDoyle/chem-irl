/**
 * Languages Screen - Phase 4, Step 11
 * MANDATORY OR EXPLICIT SKIP - At least 1 language required
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

// Common languages - can be expanded
const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Chinese (Mandarin)',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Russian',
  'Dutch',
  'Polish',
  'Turkish',
  'Vietnamese',
  'Thai',
  'Swedish',
  'Norwegian',
  'Danish',
  'Finnish',
  'Greek',
  'Hebrew',
  'Czech',
  'Romanian',
  'Hungarian',
  'Tagalog',
  'Indonesian',
  'Malay',
  'Other',
];

export default function LanguagesScreen() {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingLanguages();
  }, []);

  const loadExistingLanguages = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('languages')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.languages && Array.isArray(profile.languages)) {
        setSelectedLanguages(profile.languages);
      }
    } catch (error) {
      console.error('Error loading languages:', error);
    }
  };

  const toggleLanguage = (language: string) => {
    if (selectedLanguages.includes(language)) {
      setSelectedLanguages(selectedLanguages.filter((l) => l !== language));
    } else {
      setSelectedLanguages([...selectedLanguages, language]);
    }
  };

  const handleContinue = async () => {
    if (selectedLanguages.length === 0) {
      Alert.alert('Error', 'Please select at least one language');
      return { success: false, error: 'No language selected' };
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({ languages: selectedLanguages })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save languages');
        Alert.alert(title, message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const canContinue = selectedLanguages.length > 0;

  return (
    <BaseOnboardingScreen
      stepId="languages"
      onContinue={handleContinue}
      canContinue={canContinue}
      loading={loading}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>Select all languages you speak. Choose at least one.</Text>

        <View style={styles.optionsContainer}>
          {LANGUAGE_OPTIONS.map((language) => {
            const isSelected = selectedLanguages.includes(language);
            return (
              <TouchableOpacity
                key={language}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleLanguage(language)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {language}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    gap: 16,
    paddingBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginBottom: 8,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'BRAND_COLORS.background[50]',
  },
  optionSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primary + '20',
  },
  optionText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
  },
  optionTextSelected: {
    fontWeight: '600',
    color: BRAND_COLORS.primary,
  },
  checkmark: {
    fontSize: 20,
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
  },
});
