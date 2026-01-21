/**
 * Bio Screen - Phase 6, Step 23
 * NON-SKIPPABLE - User must accept, edit, or rewrite generated bio
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { generateBio, BioGeneratorInput } from '../../lib/onboarding/bioGenerator';
import { loadOnboardingState } from '../../lib/onboarding/flowGuard';
import { BRAND_COLORS } from '../../config/brand';

export default function BioScreen() {
  const [bio, setBio] = useState('');
  const [generatedBio, setGeneratedBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadExistingBio();
    generateSuggestedBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExistingBio = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('bio')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.bio) {
        setBio(profile.bio);
      }
    } catch (error) {
      console.error('Error loading bio:', error);
    }
  };

  const generateSuggestedBio = async () => {
    setGenerating(true);
    try {
      const { profile } = await loadOnboardingState();
      if (!profile) {
        return;
      }

      // Build input for bio generator
      const input: BioGeneratorInput = {
        interests: profile.interests || [],
        lifestyle: {
          activityLevel: profile.activity_level || undefined,
          diet: profile.diet || undefined,
        },
        intent: profile.relationship_intent || undefined,
        idealDates: profile.favourite_first_dates || [],
        loveLanguage: profile.love_language || undefined,
        personalityType: profile.personality_type || undefined,
        languages: profile.languages || [],
        pets: profile.pets || undefined,
        familyPlans: profile.family_plans || undefined,
      };

      const suggested = generateBio(input);
      setGeneratedBio(suggested);

      // If no existing bio, use generated one
      if (!bio) {
        setBio(suggested);
      }
    } catch (error) {
      console.error('Error generating bio:', error);
      // Fallback: use a simple bio
      const fallbackBio =
        "I'm looking to meet new people and see where things go. I enjoy good conversations and meaningful connections.";
      setGeneratedBio(fallbackBio);
      if (!bio) {
        setBio(fallbackBio);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptGenerated = () => {
    setBio(generatedBio);
  };

  const handleContinue = async () => {
    const trimmedBio = bio.trim();

    // Validate: minimum 20 characters
    if (trimmedBio.length < 20) {
      Alert.alert('Error', 'Bio must be at least 20 characters long');
      return { success: false, error: 'Bio too short' };
    }

    // Validate: maximum 500 characters (reasonable limit)
    if (trimmedBio.length > 500) {
      Alert.alert('Error', 'Bio must be 500 characters or less');
      return { success: false, error: 'Bio too long' };
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
        .update({ bio: trimmedBio })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save bio');
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

  const canContinue = bio.trim().length >= 20 && bio.trim().length <= 500;

  return (
    <BaseOnboardingScreen
      stepId="bio"
      onContinue={handleContinue}
      canContinue={canContinue}
      loading={loading}
    >
      <View style={styles.contentContainer}>
        {generating ? (
          <Text style={styles.loadingText}>Generating your bio...</Text>
        ) : (
          <>
            {generatedBio && (
              <View style={styles.suggestedContainer}>
                <Text style={styles.suggestedLabel}>Suggested bio:</Text>
                <Text style={styles.suggestedBio}>{generatedBio}</Text>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={handleAcceptGenerated}
                  disabled={bio === generatedBio}
                >
                  <Text style={styles.acceptButtonText}>Use This Bio</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Your Bio</Text>
              <Text style={styles.hint}>You can edit the suggested bio or write your own</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell people about yourself..."
                placeholderTextColor={BRAND_COLORS.text[600]}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={6}
                maxLength={500}
                editable={!loading}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>
                {bio.trim().length}/500 {bio.trim().length < 20 && '(min 20 characters)'}
              </Text>
            </View>
          </>
        )}
      </View>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    gap: 24,
  },
  loadingText: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    padding: 24,
  },
  suggestedContainer: {
    backgroundColor: BRAND_COLORS.primary + '10',
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  suggestedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  suggestedBio: {
    fontSize: 16,
    color: BRAND_COLORS.text[700],
    lineHeight: 24,
  },
  acceptButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  acceptButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  hint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'BRAND_COLORS.background[50]',
    minHeight: 150,
  },
  textArea: {
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: BRAND_COLORS.text[600],
    textAlign: 'right',
  },
});
