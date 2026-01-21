/**
 * Interested In Screen - Phase 2, Step 7
 * NON-SKIPPABLE - Multi-select, at least 1 required
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const INTERESTED_IN_OPTIONS = [
  'men',
  'women',
  'non_binary',
  'transgender',
  'genderqueer',
  'agender',
  'bigender',
  'genderfluid',
  'two_spirit',
  'all',
  'other',
];

export default function InterestedInScreen() {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingSelections();
  }, []);

  const loadExistingSelections = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('interested_in')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.interested_in) {
        const selections = Array.isArray(profile.interested_in)
          ? profile.interested_in
          : [profile.interested_in];
        setSelectedOptions(selections);
      } else {
        // Fallback: check users.orientation
        const { data: userData } = await supabase
          .from('users')
          .select('orientation')
          .eq('user_id', user.id)
          .maybeSingle();

        if (userData?.orientation) {
          setSelectedOptions([userData.orientation]);
        }
      }
    } catch (error) {
      console.error('Error loading interested in selections:', error);
    }
  };

  const toggleOption = (option: string) => {
    if (option === 'all') {
      // If "all" is selected, clear other selections
      setSelectedOptions(['all']);
    } else {
      // Remove "all" if present, then toggle the option
      const withoutAll = selectedOptions.filter((o) => o !== 'all');
      if (withoutAll.includes(option)) {
        setSelectedOptions(withoutAll.filter((o) => o !== option));
      } else {
        setSelectedOptions([...withoutAll, option]);
      }
    }
  };

  const handleContinue = async () => {
    if (selectedOptions.length === 0) {
      Alert.alert('Error', 'Please select at least one option');
      return { success: false, error: 'No option selected' };
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Update profiles.interested_in (array)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ interested_in: selectedOptions })
        .eq('id', user.id);

      if (profileError) {
        const { title, message } = getErrorAlert(profileError, 'Failed to save preferences');
        Alert.alert(title, message);
        return { success: false, error: profileError.message };
      }

      // Also update users.orientation (for compatibility, use first selected)
      // Never write 'all' to users.orientation enum - map to valid enum value
      if (selectedOptions.length > 0 && !selectedOptions.includes('all')) {
        // Map first selected option to valid enum value
        // Valid enum values: 'straight', 'gay', 'lesbian', 'bisexual', 'pansexual', 'asexual', 'other'
        const firstOption = selectedOptions[0];
        const validEnumValue = [
          'straight',
          'gay',
          'lesbian',
          'bisexual',
          'pansexual',
          'asexual',
          'other',
        ].includes(firstOption)
          ? firstOption
          : 'other';

        const { error: userError } = await supabase
          .from('users')
          .update({ orientation: validEnumValue as any })
          .eq('user_id', user.id);

        if (userError) {
          console.error('[InterestedInScreen] Failed to update users.orientation:', {
            userId: user.id.substring(0, 8),
            error: userError.message,
            code: (userError as any).code,
            details: (userError as any).details,
            hint: (userError as any).hint,
          });
          // Non-fatal, continue
        }
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

  const formatOptionLabel = (option: string): string => {
    if (option === 'all') {
      return 'Open to all';
    }
    return option
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <BaseOnboardingScreen
      stepId="interested_in"
      onContinue={handleContinue}
      canContinue={selectedOptions.length > 0}
      loading={loading}
    >
      <View style={styles.content}>
        <Text style={styles.instruction}>
          Who are you interested in matching with? Select all that apply.
        </Text>
        <View style={styles.optionsContainer}>
          {INTERESTED_IN_OPTIONS.map((option) => {
            const isSelected = selectedOptions.includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleOption(option)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {formatOptionLabel(option)}
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
