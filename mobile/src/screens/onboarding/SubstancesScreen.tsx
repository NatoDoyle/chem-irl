/**
 * Substances Screen - Phase 4, Step 15
 * MANDATORY OR EXPLICIT SKIP - User must answer about drinking, smoking, and drugs
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const DRINKING_OPTIONS = [
  { value: 'frequently', label: 'Frequently' },
  { value: 'socially', label: 'Socially' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'never', label: 'Never' },
];

const SMOKING_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'socially', label: 'Socially' },
  { value: 'no', label: 'No' },
];

const DRUGS_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'occasionally', label: 'Occasionally' },
  { value: 'never', label: 'Never' },
];

export default function SubstancesScreen() {
  const [drinking, setDrinking] = useState<string | null>(null);
  const [smoking, setSmoking] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingSubstances();
  }, []);

  const loadExistingSubstances = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('drinking, smoking, drugs')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (
          profile.drinking === 'prefer_not_to_say' &&
          profile.smoking === 'prefer_not_to_say' &&
          profile.drugs === 'prefer_not_to_say'
        ) {
          setSkipped(true);
        } else {
          setDrinking(profile.drinking || null);
          setSmoking(profile.smoking || null);
          setDrugs(profile.drugs || null);
        }
      }
    } catch (error) {
      console.error('Error loading substances:', error);
    }
  };

  const handleSelectDrinking = (value: string) => {
    setDrinking(value);
    setSkipped(false);
  };

  const handleSelectSmoking = (value: string) => {
    setSmoking(value);
    setSkipped(false);
  };

  const handleSelectDrugs = (value: string) => {
    setDrugs(value);
    setSkipped(false);
  };

  const handleSkip = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Substances',
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
              setDrinking(null);
              setSmoking(null);
              setDrugs(null);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (!skipped && (!drinking || !smoking || !drugs)) {
      Alert.alert('Error', 'Please answer all questions or skip this step');
      return { success: false, error: 'Incomplete' };
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
          drinking: skipped ? 'prefer_not_to_say' : drinking,
          smoking: skipped ? 'prefer_not_to_say' : smoking,
          drugs: skipped ? 'prefer_not_to_say' : drugs,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save substances');
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

  const canContinue = skipped || (drinking !== null && smoking !== null && drugs !== null);

  return (
    <BaseOnboardingScreen
      stepId="substances"
      onContinue={handleContinue}
      onSkip={handleSkip}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>How often do you drink, smoke, or use drugs?</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Drinking</Text>
          <View style={styles.optionsContainer}>
            {DRINKING_OPTIONS.map((option) => {
              const isSelected = drinking === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelectDrinking(option.value)}
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
          <Text style={styles.sectionLabel}>Smoking</Text>
          <View style={styles.optionsContainer}>
            {SMOKING_OPTIONS.map((option) => {
              const isSelected = smoking === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelectSmoking(option.value)}
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
          <Text style={styles.sectionLabel}>Drugs</Text>
          <View style={styles.optionsContainer}>
            {DRUGS_OPTIONS.map((option) => {
              const isSelected = drugs === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, isSelected && styles.optionSelected]}
                  onPress={() => handleSelectDrugs(option.value)}
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
    marginBottom: 8,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 4,
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
