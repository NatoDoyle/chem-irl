/**
 * Personality Type Screen - Phase 5, Step 21
 * OPTIONAL BUT ENFORCED - User must select personality type or skip
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const PERSONALITY_TYPES = [
  { value: 'INTJ', label: 'INTJ - The Architect' },
  { value: 'INTP', label: 'INTP - The Thinker' },
  { value: 'ENTJ', label: 'ENTJ - The Commander' },
  { value: 'ENTP', label: 'ENTP - The Debater' },
  { value: 'INFJ', label: 'INFJ - The Advocate' },
  { value: 'INFP', label: 'INFP - The Mediator' },
  { value: 'ENFJ', label: 'ENFJ - The Protagonist' },
  { value: 'ENFP', label: 'ENFP - The Campaigner' },
  { value: 'ISTJ', label: 'ISTJ - The Logistician' },
  { value: 'ISFJ', label: 'ISFJ - The Protector' },
  { value: 'ESTJ', label: 'ESTJ - The Executive' },
  { value: 'ESFJ', label: 'ESFJ - The Consul' },
  { value: 'ISTP', label: 'ISTP - The Virtuoso' },
  { value: 'ISFP', label: 'ISFP - The Adventurer' },
  { value: 'ESTP', label: 'ESTP - The Entrepreneur' },
  { value: 'ESFP', label: 'ESFP - The Entertainer' },
];

export default function PersonalityTypeScreen() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingType();
  }, []);

  const loadExistingType = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('personality_type')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.personality_type) {
        if (profile.personality_type === 'prefer_not_to_say' || profile.personality_type === '') {
          setSkipped(true);
        } else {
          setSelectedType(profile.personality_type);
        }
      }
    } catch (error) {
      console.error('Error loading personality type:', error);
    }
  };

  const handleSelectType = (value: string) => {
    setSelectedType(value);
    setSkipped(false);
  };

  const handleSkip = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Personality Type',
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
              setSelectedType(null);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (!selectedType && !skipped) {
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
          personality_type: skipped ? 'prefer_not_to_say' : selectedType,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save personality type');
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

  const canContinue = selectedType !== null || skipped;

  return (
    <BaseOnboardingScreen
      stepId="personality_type"
      onContinue={handleContinue}
      onSkip={handleSkip}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>What's your Myers-Briggs personality type?</Text>
        <Text style={styles.hint}>Optional - This helps others understand your personality</Text>

        <View style={styles.optionsContainer}>
          {PERSONALITY_TYPES.map((type) => {
            const isSelected = selectedType === type.value;
            return (
              <TouchableOpacity
                key={type.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelectType(type.value)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {type.label}
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
  },
  hint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
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
