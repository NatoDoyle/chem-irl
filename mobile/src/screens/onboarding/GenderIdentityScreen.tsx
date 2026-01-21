/**
 * Gender Identity Screen - Phase 2, Step 6
 * NON-SKIPPABLE - Multi-select, at least 1 required
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const GENDER_OPTIONS = [
  'male',
  'female',
  'non_binary',
  'transgender',
  'genderqueer',
  'agender',
  'bigender',
  'genderfluid',
  'two_spirit',
  'other',
  'prefer_not_to_say',
];

export default function GenderIdentityScreen() {
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingGenders();
  }, []);

  const loadExistingGenders = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('gender')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userData?.gender) {
        // If single gender, convert to array; if already array, use it
        const genders = Array.isArray(userData.gender) ? userData.gender : [userData.gender];
        setSelectedGenders(genders);
      }
    } catch (error) {
      console.error('Error loading genders:', error);
    }
  };

  const toggleGender = (gender: string) => {
    if (selectedGenders.includes(gender)) {
      setSelectedGenders(selectedGenders.filter((g) => g !== gender));
    } else {
      setSelectedGenders([...selectedGenders, gender]);
    }
  };

  const handleContinue = async () => {
    if (selectedGenders.length === 0) {
      Alert.alert('Error', 'Please select at least one gender identity');
      return { success: false, error: 'No gender selected' };
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Update profiles.gender_identity (array)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ gender_identity: selectedGenders })
        .eq('id', user.id);

      if (profileError) {
        const { title, message } = getErrorAlert(profileError, 'Failed to save gender identity');
        Alert.alert(title, message);
        return { success: false, error: profileError.message };
      }

      // Also update users.gender (for compatibility, use first selected)
      const { error: userError } = await supabase
        .from('users')
        .update({ gender: selectedGenders[0] as any })
        .eq('user_id', user.id);

      if (userError) {
        console.warn('Failed to update users.gender:', userError);
        // Non-fatal, continue
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

  const formatGenderLabel = (gender: string): string => {
    return gender
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <BaseOnboardingScreen
      stepId="gender_identity"
      onContinue={handleContinue}
      canContinue={selectedGenders.length > 0}
      loading={loading}
    >
      <View style={styles.content}>
        <Text style={styles.instruction}>
          Select all that apply. You can choose multiple options.
        </Text>
        <View style={styles.optionsContainer}>
          {GENDER_OPTIONS.map((gender) => {
            const isSelected = selectedGenders.includes(gender);
            return (
              <TouchableOpacity
                key={gender}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleGender(gender)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {formatGenderLabel(gender)}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
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
