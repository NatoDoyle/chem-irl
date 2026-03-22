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
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type HeightScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Height'>;

const HEIGHT_MIN = 50;
const HEIGHT_MAX = 250;

export default function HeightScreen() {
  const navigation = useNavigation<HeightScreenNavigationProp>();
  const [heightCm, setHeightCm] = useState('');
  const [preferNotToSay, setPreferNotToSay] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async (skipWithPreferNotToSay = false) => {
    const isSkipping = skipWithPreferNotToSay || preferNotToSay;
    if (!isSkipping && !heightCm.trim()) {
      Alert.alert('Selection required', 'Please enter your height or select "Prefer not to say"');
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

      let heightValue: number | null = null;
      if (!isSkipping && heightCm.trim()) {
        const parsed = parseInt(heightCm.trim(), 10);
        if (isNaN(parsed)) {
          Alert.alert('Invalid height', 'Please enter a valid number');
          setLoading(false);
          return;
        }
        if (parsed < HEIGHT_MIN || parsed > HEIGHT_MAX) {
          Alert.alert(
            'Invalid height',
            `Height must be between ${HEIGHT_MIN} and ${HEIGHT_MAX} cm`
          );
          setLoading(false);
          return;
        }
        heightValue = parsed;
      }

      // Get current profile to merge prompts
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts, height_cm')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;

      // Store in both height_cm column (if supported) and prompts.demographics for compatibility
      const upsertPayload: any = {
        id: user.id,
        prompts: {
          ...currentPrompts,
          demographics: {
            ...(currentPrompts.demographics || {}),
            height_cm: heightValue,
          },
        },
      };

      // Try to set height_cm column if it exists (will fail gracefully if column doesn't exist)
      if (heightValue !== null) {
        upsertPayload.height_cm = heightValue;
      } else {
        upsertPayload.height_cm = null;
      }

      const { error } = await supabase.from('profiles').upsert(upsertPayload);

      if (error) {
        // If height_cm column doesn't exist, retry without it
        if (
          error.code === '42703' ||
          error.message.includes('column') ||
          error.message.includes('does not exist')
        ) {
          const { error: retryError } = await supabase.from('profiles').upsert({
            id: user.id,
            prompts: upsertPayload.prompts,
          });
          if (retryError) {
            const { title, message } = getErrorAlert(retryError, 'Failed to save height');
            Alert.alert(title, message);
            setLoading(false);
            return;
          }
        } else {
          const { title, message } = getErrorAlert(error, 'Failed to save height');
          Alert.alert(title, message);
          setLoading(false);
          return;
        }
      }

      // Track completion
      trackEvent('onboarding_height_completed', {
        hasHeight: heightValue !== null,
        preferNotToSay: isSkipping,
      });

      // Navigate to next screen
      navigation.navigate('Languages');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save height');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Immediately skip without confirmation
    setPreferNotToSay(true);
    await handleContinue(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>How tall are you?</Text>
      <Text style={styles.subtitle}>This helps us show you better matches</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Enter height in cm (e.g., 175)"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={heightCm}
          onChangeText={setHeightCm}
          keyboardType="numeric"
          editable={!preferNotToSay && !loading}
          maxLength={3}
        />
        <Text style={styles.hint}>
          Height range: {HEIGHT_MIN}-{HEIGHT_MAX} cm
        </Text>

        <TouchableOpacity
          style={[styles.optionButton, preferNotToSay && styles.optionButtonSelected]}
          onPress={() => {
            setPreferNotToSay(!preferNotToSay);
            if (!preferNotToSay) {
              setHeightCm('');
            }
          }}
          disabled={loading}
        >
          <Text style={[styles.optionText, preferNotToSay && styles.optionTextSelected]}>
            Prefer not to say
          </Text>
        </TouchableOpacity>

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
    backgroundColor: GOLDEN_HOUR.bg,
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
  input: {
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 16,
    fontSize: 18,
    backgroundColor: GOLDEN_HOUR.inputBg,
    color: BRAND_COLORS.text[900],
  },
  hint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginTop: -8,
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
    backgroundColor: BRAND_COLORS.primarySoft || '#D1FFFB',
  },
  optionText: {
    fontSize: 18,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  optionTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
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
    fontWeight: '600',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
