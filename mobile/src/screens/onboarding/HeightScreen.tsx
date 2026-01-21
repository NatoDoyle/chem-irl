/**
 * Height Screen - Phase 4, Step 10
 * MANDATORY OR EXPLICIT SKIP - User must select height or choose "Prefer not to say"
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

// Height options in cm (approximate conversions from feet/inches)
const HEIGHT_OPTIONS = [
  { cm: 150, label: '4\'11" (150 cm)' },
  { cm: 152, label: '5\'0" (152 cm)' },
  { cm: 155, label: '5\'1" (155 cm)' },
  { cm: 157, label: '5\'2" (157 cm)' },
  { cm: 160, label: '5\'3" (160 cm)' },
  { cm: 163, label: '5\'4" (163 cm)' },
  { cm: 165, label: '5\'5" (165 cm)' },
  { cm: 168, label: '5\'6" (168 cm)' },
  { cm: 170, label: '5\'7" (170 cm)' },
  { cm: 173, label: '5\'8" (173 cm)' },
  { cm: 175, label: '5\'9" (175 cm)' },
  { cm: 178, label: '5\'10" (178 cm)' },
  { cm: 180, label: '5\'11" (180 cm)' },
  { cm: 183, label: '6\'0" (183 cm)' },
  { cm: 185, label: '6\'1" (185 cm)' },
  { cm: 188, label: '6\'2" (188 cm)' },
  { cm: 190, label: '6\'3" (190 cm)' },
  { cm: 193, label: '6\'4" (193 cm)' },
  { cm: 195, label: '6\'5" (195 cm)' },
  { cm: 198, label: '6\'6" (198 cm)' },
];

export default function HeightScreen() {
  const [selectedHeight, setSelectedHeight] = useState<number | null>(null);
  const [preferNotToSay, setPreferNotToSay] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingHeight();
  }, []);

  const loadExistingHeight = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('height_cm, height_prefer_not_say')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.height_prefer_not_say) {
          setPreferNotToSay(true);
        } else if (profile.height_cm) {
          setSelectedHeight(profile.height_cm);
        }
      }
    } catch (error) {
      console.error('Error loading height:', error);
    }
  };

  const handleSelectHeight = (cm: number) => {
    setSelectedHeight(cm);
    setPreferNotToSay(false);
  };

  const handlePreferNotToSay = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Height',
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
              setPreferNotToSay(true);
              setSelectedHeight(null);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (!selectedHeight && !preferNotToSay) {
      Alert.alert('Error', 'Please select your height or choose "Prefer not to say"');
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
          height_cm: preferNotToSay ? null : selectedHeight,
          height_prefer_not_say: preferNotToSay,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save height');
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

  const canContinue = selectedHeight !== null || preferNotToSay;

  return (
    <BaseOnboardingScreen
      stepId="height"
      onContinue={handleContinue}
      onSkip={handlePreferNotToSay}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>Select your height</Text>

        <View style={styles.optionsContainer}>
          {HEIGHT_OPTIONS.map((option) => {
            const isSelected = selectedHeight === option.cm;
            return (
              <TouchableOpacity
                key={option.cm}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelectHeight(option.cm)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option.label}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.skipButton, preferNotToSay && styles.skipButtonSelected]}
          onPress={handlePreferNotToSay}
        >
          <Text style={[styles.skipButtonText, preferNotToSay && styles.skipButtonTextSelected]}>
            Prefer not to say
          </Text>
          {preferNotToSay && <Text style={styles.checkmark}>✓</Text>}
        </TouchableOpacity>
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
  skipButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: 'BRAND_COLORS.background[50]',
    marginTop: 8,
  },
  skipButtonSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primary + '20',
  },
  skipButtonText: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
  },
  skipButtonTextSelected: {
    fontWeight: '600',
    color: BRAND_COLORS.primary,
  },
});
