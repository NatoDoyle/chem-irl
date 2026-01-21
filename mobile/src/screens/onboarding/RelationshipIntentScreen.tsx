/**
 * Relationship Intent Screen - Phase 4, Step 12
 * MANDATORY OR EXPLICIT SKIP - User must select intent or skip
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

const INTENT_OPTIONS = [
  { value: 'long_term', label: 'Looking for a long-term relationship' },
  { value: 'short_term', label: 'Looking for something casual' },
  { value: 'friends', label: 'Just looking for friends' },
  { value: 'open', label: 'Open to anything' },
  { value: 'not_sure', label: 'Not sure yet' },
];

export default function RelationshipIntentScreen() {
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingIntent();
  }, []);

  const loadExistingIntent = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('relationship_intent')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.relationship_intent) {
        // Check if it's a skip marker (e.g., empty string or special value)
        if (
          profile.relationship_intent === 'prefer_not_to_say' ||
          profile.relationship_intent === ''
        ) {
          setSkipped(true);
        } else {
          setSelectedIntent(profile.relationship_intent);
        }
      }
    } catch (error) {
      console.error('Error loading relationship intent:', error);
    }
  };

  const handleSelectIntent = (value: string) => {
    setSelectedIntent(value);
    setSkipped(false);
  };

  const handleSkip = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Relationship Intent',
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
              setSelectedIntent(null);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (!selectedIntent && !skipped) {
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
          relationship_intent: skipped ? 'prefer_not_to_say' : selectedIntent,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save relationship intent');
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

  const canContinue = selectedIntent !== null || skipped;

  return (
    <BaseOnboardingScreen
      stepId="relationship_intent"
      onContinue={handleContinue}
      onSkip={handleSkip}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <View style={styles.content}>
        <Text style={styles.instruction}>What are you looking for?</Text>

        <View style={styles.optionsContainer}>
          {INTENT_OPTIONS.map((option) => {
            const isSelected = selectedIntent === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelectIntent(option.value)}
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
