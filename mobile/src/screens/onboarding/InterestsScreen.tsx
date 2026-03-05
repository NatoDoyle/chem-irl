import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type InterestsScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'Interests'
>;

const PRESET_INTERESTS = [
  'Travel',
  'Music',
  'Movies',
  'Sports',
  'Cooking',
  'Reading',
  'Photography',
  'Art',
  'Dancing',
  'Gaming',
  'Hiking',
  'Yoga',
  'Fitness',
  'Writing',
  'Technology',
  'Fashion',
  'Food',
  'Wine',
  'Coffee',
  'Pets',
  'Volunteering',
  'Comedy',
  'Theater',
  'Concerts',
];

const MIN_INTERESTS = 3;

export default function InterestsScreen() {
  const navigation = useNavigation<InterestsScreenNavigationProp>();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const addCustomInterest = () => {
    const trimmed = customInterest.trim();
    if (trimmed && !selectedInterests.includes(trimmed)) {
      setSelectedInterests([...selectedInterests, trimmed]);
      setCustomInterest('');
    }
  };

  const handleContinue = async (skipWithDefaults = false) => {
    const effectiveInterests = skipWithDefaults ? ['Travel', 'Music', 'Food'] : selectedInterests;

    if (effectiveInterests.length < MIN_INTERESTS) {
      Alert.alert(
        'More interests needed',
        `Please select at least ${MIN_INTERESTS} interests or explicitly skip this step`
      );
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { title, message } = getErrorAlert('Not authenticated', 'Authentication Error');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Get current profile to merge prompts
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          ...currentPrompts,
          preferences: {
            ...(currentPrompts.preferences || {}),
            interests: effectiveInterests,
          },
        },
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save interests');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_interests_completed', {
        count: effectiveInterests.length,
      });

      // Navigate to next screen
      navigation.navigate('LoveLanguage');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save interests');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Immediately skip without confirmation - use default interests
    setSelectedInterests(['Travel', 'Music', 'Food']);
    await handleContinue(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>What are your interests?</Text>
      <Text style={styles.subtitle}>Select at least {MIN_INTERESTS} interests</Text>

      <View style={styles.form}>
        <View style={styles.interestsGrid}>
          {PRESET_INTERESTS.map((interest) => {
            const isSelected = selectedInterests.includes(interest);
            return (
              <TouchableOpacity
                key={interest}
                style={[styles.interestChip, isSelected && styles.interestChipSelected]}
                onPress={() => toggleInterest(interest)}
                disabled={loading}
              >
                <Text style={[styles.interestText, isSelected && styles.interestTextSelected]}>
                  {interest}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.customSection}>
          <Text style={styles.sectionTitle}>Add custom interest</Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.customInput}
              placeholder="Enter interest"
              placeholderTextColor={BRAND_COLORS.text[600]}
              value={customInterest}
              onChangeText={setCustomInterest}
              editable={!loading}
              onSubmitEditing={addCustomInterest}
            />
            <TouchableOpacity
              style={[styles.addButton, !customInterest.trim() && styles.addButtonDisabled]}
              onPress={addCustomInterest}
              disabled={!customInterest.trim() || loading}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.counter}>
          {selectedInterests.length} / {MIN_INTERESTS} minimum
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.skipButton, loading && styles.buttonDisabled]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              (selectedInterests.length < MIN_INTERESTS || loading) && styles.buttonDisabled,
            ]}
            onPress={() => handleContinue()}
            disabled={selectedInterests.length < MIN_INTERESTS || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  interestChipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft || '#D1FFFB',
  },
  interestText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  interestTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },
  customSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  customInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    color: BRAND_COLORS.text[900],
  },
  addButton: {
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: BRAND_COLORS.primary,
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  counter: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    flex: 2,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
