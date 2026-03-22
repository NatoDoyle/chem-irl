import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';
import { ASTROLOGY_SIGNS } from '../../config/profileOptions';
import { onboardingStyles as sharedStyles } from './onboardingStyles';
import { useOnboardingSave } from './useOnboardingSave';

export default function AstrologyScreen() {
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const { save, loading } = useOnboardingSave({
    fieldPath: 'preferences.astrology_sign',
    nextScreen: 'WorkEducation',
    eventName: 'onboarding_astrology_completed',
  });

  const handleContinue = async () => {
    await save(selectedSign);
  };

  const handleSkip = async () => {
    setSelectedSign(null);
    await save(null);
  };

  return (
    <ScrollView style={sharedStyles.container} contentContainerStyle={sharedStyles.content}>
      <Text style={sharedStyles.title}>Astrology sign</Text>
      <Text style={sharedStyles.subtitle}>Optional: Share your zodiac sign</Text>

      <View style={styles.form}>
        <View style={styles.signsGrid}>
          {ASTROLOGY_SIGNS.map((sign) => (
            <TouchableOpacity
              key={sign}
              style={[styles.signChip, selectedSign === sign && styles.signChipSelected]}
              onPress={() => setSelectedSign(sign)}
              disabled={loading}
            >
              <Text style={[styles.signText, selectedSign === sign && styles.signTextSelected]}>
                {sign}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={sharedStyles.buttonRow}>
          <TouchableOpacity
            style={[sharedStyles.skipButton, loading && sharedStyles.buttonDisabled]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={sharedStyles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              sharedStyles.button,
              styles.continueButton,
              loading && sharedStyles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={sharedStyles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  signsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signChip: {
    flex: 1,
    minWidth: '30%',
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 16,
    backgroundColor: GOLDEN_HOUR.inputBg,
    alignItems: 'center',
  },
  signChipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft || '#D1FFFB',
  },
  signText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  signTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },
  continueButton: {
    flex: 2,
    marginTop: 0,
  },
});
