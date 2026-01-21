/**
 * Family Plans Screen - Phase 4, Step 13
 * MANDATORY OR EXPLICIT SKIP - User must select family plans or skip
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const FAMILY_PLANS_OPTIONS = [
  { value: 'want_children', label: 'Want children' },
  { value: 'have_children', label: 'Have children' },
  { value: 'dont_want_children', label: "Don't want children" },
  { value: 'open_to_children', label: 'Open to children' },
  { value: 'not_sure', label: 'Not sure yet' },
];

export default function FamilyPlansScreen() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingPlan();
  }, []);

  const loadExistingPlan = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('family_plans')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.family_plans) {
        if (profile.family_plans === 'prefer_not_to_say' || profile.family_plans === '') {
          setSkipped(true);
        } else {
          setSelectedPlan(profile.family_plans);
        }
      }
    } catch (error) {
      console.error('Error loading family plans:', error);
    }
  };

  const handleSelectPlan = (value: string) => {
    setSelectedPlan(value);
    setSkipped(false);
  };

  const handleSkip = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Family Plans',
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
              setSelectedPlan(null);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (!selectedPlan && !skipped) {
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
          family_plans: skipped ? 'prefer_not_to_say' : selectedPlan,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save family plans');
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

  const canContinue = selectedPlan !== null || skipped;

  return (
    <BaseOnboardingScreen
      stepId="family_plans"
      onContinue={handleContinue}
      onSkip={handleSkip}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <View style={styles.content}>
        <Text style={styles.instruction}>What are your family plans?</Text>

        <View style={styles.optionsContainer}>
          {FAMILY_PLANS_OPTIONS.map((option) => {
            const isSelected = selectedPlan === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelectPlan(option.value)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
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
      </View>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
  },
  instruction: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
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
  },
  skippedText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
  },
});
