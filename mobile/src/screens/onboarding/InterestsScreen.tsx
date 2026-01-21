/**
 * Interests Screen - Phase 5, Step 17
 * OPTIONAL BUT ENFORCED - Min 3 interests or explicit skip
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

// Common interests - can be expanded
const INTEREST_OPTIONS = [
  'Travel',
  'Music',
  'Cooking',
  'Fitness',
  'Reading',
  'Movies',
  'Art',
  'Photography',
  'Gaming',
  'Sports',
  'Dancing',
  'Hiking',
  'Yoga',
  'Meditation',
  'Writing',
  'Coffee',
  'Wine',
  'Foodie',
  'Beach',
  'Mountains',
  'Concerts',
  'Theater',
  'Comedy',
  'Science',
  'Technology',
  'Fashion',
  'Gardening',
  'Pets',
  'Volunteering',
  'Learning Languages',
];

export default function InterestsScreen() {
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingInterests();
  }, []);

  const loadExistingInterests = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('interests, interests_skipped')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.interests_skipped === true) {
          setSkipped(true);
        } else if (profile.interests && Array.isArray(profile.interests)) {
          setSelectedInterests(profile.interests);
        }
      }
    } catch (error) {
      console.error('Error loading interests:', error);
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
    setSkipped(false); // Clear skip when selecting interests
  };

  const handleSkip = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Interests',
        'Are you sure you want to skip adding interests? This helps others learn about you.',
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
              setSelectedInterests([]);
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    if (selectedInterests.length > 0 && selectedInterests.length < 3) {
      Alert.alert('Error', 'Please select at least 3 interests, or skip this step');
      return { success: false, error: 'Not enough interests' };
    }

    if (!skipped && selectedInterests.length === 0) {
      Alert.alert('Error', 'Please select at least 3 interests, or skip this step');
      return { success: false, error: 'No interests selected' };
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
          interests: skipped ? [] : selectedInterests,
          interests_skipped: skipped,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save interests');
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

  const canContinue = selectedInterests.length >= 3 || skipped;

  return (
    <BaseOnboardingScreen
      stepId="interests"
      onContinue={handleContinue}
      onSkip={handleSkip}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>
          Select at least 3 interests that describe you, or skip this step
        </Text>
        {selectedInterests.length > 0 && selectedInterests.length < 3 && (
          <Text style={styles.requirementText}>
            Select {3 - selectedInterests.length} more interest
            {3 - selectedInterests.length > 1 ? 's' : ''}
          </Text>
        )}

        <View style={styles.optionsContainer}>
          {INTEREST_OPTIONS.map((interest) => {
            const isSelected = selectedInterests.includes(interest);
            return (
              <TouchableOpacity
                key={interest}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleInterest(interest)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {interest}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {skipped && (
          <View style={styles.skippedIndicator}>
            <Text style={styles.skippedText}>Skipped - You can add interests later</Text>
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
    gap: 16,
    paddingBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: BRAND_COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'BRAND_COLORS.background[50]',
    minWidth: 100,
  },
  optionSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primary + '20',
  },
  optionText: {
    fontSize: 14,
    color: BRAND_COLORS.text[900],
    marginRight: 8,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: BRAND_COLORS.primary,
  },
  checkmark: {
    fontSize: 16,
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
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
