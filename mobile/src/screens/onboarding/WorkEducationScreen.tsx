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
import { sanitizeText } from '../../lib/sanitize';
import { trackEvent } from '../../lib/analytics';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type WorkEducationScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'WorkEducation'
>;

export default function WorkEducationScreen() {
  const navigation = useNavigation<WorkEducationScreenNavigationProp>();
  const [jobTitle, setJobTitle] = useState('');
  const [education, setEducation] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async (isSkipping = false) => {
    // At least one field should be filled, or explicitly skip
    if (!isSkipping && !jobTitle.trim() && !education.trim()) {
      Alert.alert(
        'Information needed',
        'Please fill in at least one field (job title or education) or skip this step'
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

      const preferences: Record<string, any> = {
        ...(currentPrompts.preferences || {}),
      };

      if (jobTitle.trim()) {
        preferences.job_title = sanitizeText(jobTitle.trim());
      }
      if (education.trim()) {
        preferences.education = sanitizeText(education.trim());
      }

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          ...currentPrompts,
          preferences,
        },
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save work & education');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_work_education_completed', {
        hasJobTitle: !!jobTitle.trim(),
        hasEducation: !!education.trim(),
      });

      // Navigate to next screen (Phase 6: Bio)
      navigation.navigate('ProfileSetup');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save work & education');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Immediately skip without confirmation
    setJobTitle('');
    setEducation('');
    await handleContinue(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Work & Education</Text>
      <Text style={styles.subtitle}>Tell us about your career and education (optional)</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Job Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Software Engineer, Teacher, etc."
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={jobTitle}
          onChangeText={setJobTitle}
          editable={!loading}
        />

        <Text style={styles.label}>Education</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., University of Dublin, High School, etc."
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={education}
          onChangeText={setEducation}
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
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => handleContinue()}
            disabled={loading}
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
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
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
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
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
