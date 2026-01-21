/**
 * Lifestyle Habits Screen - Phase 4, Step 16
 * MANDATORY OR EXPLICIT SKIP - Activity level (required), Diet (optional with skip)
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const ACTIVITY_LEVEL_OPTIONS = [
  { value: 'very_active', label: 'Very active (exercise daily)' },
  { value: 'active', label: 'Active (exercise 3-5 times/week)' },
  { value: 'moderate', label: 'Moderate (exercise 1-2 times/week)' },
  { value: 'low', label: 'Low (exercise rarely)' },
];

const DIET_OPTIONS = [
  { value: 'omnivore', label: 'Omnivore (eat everything)' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'keto', label: 'Keto' },
  { value: 'paleo', label: 'Paleo' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'other', label: 'Other' },
];

export default function LifestyleHabitsScreen() {
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [diet, setDiet] = useState<string | null>(null);
  const [dietSkipped, setDietSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingHabits();
  }, []);

  const loadExistingHabits = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('activity_level, diet')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setActivityLevel(profile.activity_level || null);
        if (profile.diet === 'prefer_not_to_say' || profile.diet === '') {
          setDietSkipped(true);
        } else {
          setDiet(profile.diet || null);
        }
      }
    } catch (error) {
      console.error('Error loading lifestyle habits:', error);
    }
  };

  const handleSelectActivityLevel = (value: string) => {
    setActivityLevel(value);
  };

  const handleSelectDiet = (value: string) => {
    setDiet(value);
    setDietSkipped(false);
  };

  const handleSkipDiet = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Diet',
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
              setDietSkipped(true);
              setDiet(null);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (!activityLevel) {
      Alert.alert('Error', 'Please select your activity level');
      return { success: false, error: 'Activity level required' };
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
          activity_level: activityLevel,
          diet: dietSkipped ? 'prefer_not_to_say' : diet,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save lifestyle habits');
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

  const canContinue = activityLevel !== null;

  return (
    <BaseOnboardingScreen
      stepId="lifestyle_habits"
      onContinue={handleContinue}
      canContinue={canContinue}
      loading={loading}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>Tell us about your lifestyle</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Activity Level *</Text>
          <Text style={styles.requiredNote}>Required</Text>
          <View style={styles.optionsContainer}>
            {ACTIVITY_LEVEL_OPTIONS.map((option) => {
              const isSelected = activityLevel === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelectActivityLevel(option.value)}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Diet</Text>
          <Text style={styles.optionalNote}>Optional</Text>
          <View style={styles.optionsContainer}>
            {DIET_OPTIONS.map((option) => {
              const isSelected = diet === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelectDiet(option.value)}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.skipDietButton} onPress={handleSkipDiet}>
            <Text style={styles.skipDietText}>Skip diet</Text>
          </TouchableOpacity>
          {dietSkipped && (
            <View style={styles.skippedIndicator}>
              <Text style={styles.skippedText}>Diet skipped - You can add this later</Text>
            </View>
          )}
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
    gap: 32,
    paddingBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginBottom: 8,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  requiredNote: {
    fontSize: 14,
    color: BRAND_COLORS.danger,
    fontWeight: '500',
  },
  optionalNote: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
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
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: BRAND_COLORS.primary,
  },
  checkmark: {
    fontSize: 20,
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  skipDietButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_COLORS.text[400],
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  skipDietText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontWeight: '500',
  },
  skippedIndicator: {
    backgroundColor: BRAND_COLORS.text[100],
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  skippedText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
  },
});
