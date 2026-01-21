/**
 * Love Language Screen - Phase 5, Step 20
 * OPTIONAL BUT ENFORCED - User must select love language or skip
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const LOVE_LANGUAGE_OPTIONS = [
  {
    value: 'words_of_affirmation',
    label: 'Words of Affirmation',
    description: 'You value verbal acknowledgments of affection',
  },
  {
    value: 'acts_of_service',
    label: 'Acts of Service',
    description: 'You feel loved when someone helps you with tasks',
  },
  {
    value: 'receiving_gifts',
    label: 'Receiving Gifts',
    description: 'You appreciate thoughtful gestures and presents',
  },
  {
    value: 'quality_time',
    label: 'Quality Time',
    description: 'You value undivided attention and meaningful conversations',
  },
  {
    value: 'physical_touch',
    label: 'Physical Touch',
    description: 'You feel loved through physical closeness and affection',
  },
];

export default function LoveLanguageScreen() {
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingLanguage();
  }, []);

  const loadExistingLanguage = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('love_language')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.love_language) {
        if (profile.love_language === 'prefer_not_to_say' || profile.love_language === '') {
          setSkipped(true);
        } else {
          setSelectedLanguage(profile.love_language);
        }
      }
    } catch (error) {
      console.error('Error loading love language:', error);
    }
  };

  const handleSelectLanguage = (value: string) => {
    setSelectedLanguage(value);
    setSkipped(false);
  };

  const handleSkip = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Love Language',
        'Are you sure you want to skip this? You can always add it later from your profile.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ success: false, error: 'Cancelled' }),
          },
          {
            text: 'Skip',
            onPress: () => {
              setSkipped(true);
              setSelectedLanguage(null);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (!selectedLanguage && !skipped) {
      Alert.alert('Error', 'Please select an option or skip');
      return { success: false, error: 'No selection' };
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
        .update({
          love_language: skipped ? 'prefer_not_to_say' : selectedLanguage,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save love language');
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

  const canContinue = selectedLanguage !== null || skipped;

  return (
    <BaseOnboardingScreen
      stepId="love_language"
      onContinue={handleContinue}
      onSkip={handleSkip}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>
          What's your love language? This helps others understand how you express and receive love.
        </Text>

        <View style={styles.optionsContainer}>
          {LOVE_LANGUAGE_OPTIONS.map((option) => {
            const isSelected = selectedLanguage === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelectLanguage(option.value)}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {skipped && (
          <View style={styles.skippedIndicator}>
            <Text style={styles.skippedText}>Skipped - You can add this later</Text>
          </View>
        )}
      </ScrollView>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    gap: 24,
    paddingBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    lineHeight: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  optionContent: {
    flex: 1,
    gap: 4,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  optionLabelSelected: {
    color: BRAND_COLORS.primary,
  },
  optionDescription: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    lineHeight: 20,
  },
  checkmark: {
    fontSize: 20,
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  skippedIndicator: {
    backgroundColor: BRAND_COLORS.text[100],
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  skippedText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
  },
});
