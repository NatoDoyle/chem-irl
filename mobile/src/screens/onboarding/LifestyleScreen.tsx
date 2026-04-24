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
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { FREQUENCY_OPTIONS, ACTIVITY_OPTIONS } from '../../config/profileOptions';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type LifestyleScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'Lifestyle'
>;

export default function LifestyleScreen() {
  const navigation = useNavigation<LifestyleScreenNavigationProp>();
  const [drinking, setDrinking] = useState<string | null>(null);
  const [smoking, setSmoking] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<string | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [diet, setDiet] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async (skipWithDefault = false) => {
    const effectiveActivityLevel = skipWithDefault ? 'moderate' : activityLevel;
    // Activity level is required, others can be skipped
    if (!effectiveActivityLevel) {
      Alert.alert('Selection required', 'Please select your activity level');
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

      const demographics: Record<string, any> = {
        ...(currentPrompts.demographics || {}),
        activity_level: effectiveActivityLevel,
      };

      if (drinking) demographics.drinking = drinking;
      if (smoking) demographics.smoking = smoking;
      if (drugs) demographics.drugs = drugs;
      if (diet.trim()) demographics.diet = diet.trim();

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          ...currentPrompts,
          demographics,
        },
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save lifestyle preferences');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_lifestyle_completed', {
        hasActivityLevel: !!effectiveActivityLevel,
        hasDrinking: !!drinking,
        hasSmoking: !!smoking,
        hasDrugs: !!drugs,
        hasDiet: !!diet.trim(),
      });

      // Navigate to next screen (Phase 5 starts here)
      navigation.navigate('Interests');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save lifestyle preferences');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Immediately skip without confirmation - use default activity level
    setActivityLevel('moderate');
    await handleContinue(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lifestyle</Text>
      <Text style={styles.subtitle}>Tell us about your lifestyle preferences</Text>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Drinking</Text>
        <View style={styles.optionsRow}>
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.smallOptionButton,
                drinking === option.value && styles.smallOptionButtonSelected,
              ]}
              onPress={() => setDrinking(option.value)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.smallOptionText,
                  drinking === option.value && styles.smallOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Smoking</Text>
        <View style={styles.optionsRow}>
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.smallOptionButton,
                smoking === option.value && styles.smallOptionButtonSelected,
              ]}
              onPress={() => setSmoking(option.value)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.smallOptionText,
                  smoking === option.value && styles.smallOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Drugs</Text>
        <View style={styles.optionsRow}>
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.smallOptionButton,
                drugs === option.value && styles.smallOptionButtonSelected,
              ]}
              onPress={() => setDrugs(option.value)}
              disabled={loading}
            >
              <Text
                style={[
                  styles.smallOptionText,
                  drugs === option.value && styles.smallOptionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Activity Level *</Text>
        {ACTIVITY_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              activityLevel === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setActivityLevel(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                activityLevel === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Diet (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Vegetarian, Vegan, Keto, etc."
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={diet}
          onChangeText={setDiet}
          editable={!loading}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.skipButton, loading && styles.buttonDisabled]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, (!activityLevel || loading) && styles.buttonDisabled]}
            onPress={() => handleContinue()}
            disabled={!activityLevel || loading}
          >
            {loading ? (
              <ActivityIndicator color={BRAND_COLORS.onPrimary} />
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
    backgroundColor: GOLDEN_HOUR.bg,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
  },
  form: {
    gap: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallOptionButton: {
    flex: 1,
    minWidth: '45%',
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 12,
    backgroundColor: GOLDEN_HOUR.inputBg,
    alignItems: 'center',
  },
  smallOptionButtonSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  smallOptionText: {
    fontSize: 14,
    color: BRAND_COLORS.text[900],
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  smallOptionTextSelected: {
    color: BRAND_COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 16,
    backgroundColor: GOLDEN_HOUR.inputBg,
  },
  optionButtonSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  optionText: {
    fontSize: 18,
    color: BRAND_COLORS.text[900],
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  optionTextSelected: {
    color: BRAND_COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  input: {
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 16,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    backgroundColor: GOLDEN_HOUR.inputBg,
    color: BRAND_COLORS.text[900],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
  },
  skipButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  button: {
    flex: 2,
    backgroundColor: BRAND_COLORS.primary,
    ...GOLDEN_HOUR.shadow.warm,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
