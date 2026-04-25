import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY } from '../../config/brand';
import { MBTI_OPTIONS } from '../../config/profileOptions';
import { onboardingStyles as sharedStyles } from './onboardingStyles';
import { useOnboardingSave } from './useOnboardingSave';

export default function PersonalityTypeScreen() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customType, setCustomType] = useState('');
  const { save, loading } = useOnboardingSave({
    fieldPath: 'preferences.personality_type',
    nextScreen: 'Astrology',
    eventName: 'onboarding_personality_type_completed',
  });

  const handleContinue = async () => {
    const personalityType = selectedType || customType.trim() || null;
    await save(personalityType);
  };

  const handleSkip = async () => {
    setSelectedType(null);
    setCustomType('');
    await save(null);
  };

  return (
    <ScrollView style={sharedStyles.container} contentContainerStyle={sharedStyles.content}>
      <Text style={sharedStyles.title}>Personality type</Text>
      <Text style={sharedStyles.subtitle}>Optional: Share your personality type (e.g., MBTI)</Text>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>MBTI Types</Text>
        <View style={styles.typesGrid}>
          {MBTI_OPTIONS.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, selectedType === type && styles.typeChipSelected]}
              onPress={() => {
                setSelectedType(type);
                setCustomType('');
              }}
              disabled={loading}
            >
              <Text style={[styles.typeText, selectedType === type && styles.typeTextSelected]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Or enter custom</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter personality type"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={customType}
          onChangeText={(text) => {
            setCustomType(text);
            if (text.trim()) setSelectedType(null);
          }}
          editable={!loading}
        />

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
              <ActivityIndicator color={BRAND_COLORS.onPrimary} />
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
  sectionTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: GOLDEN_HOUR.inputBg,
  },
  typeChipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  typeText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  typeTextSelected: {
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
  continueButton: {
    flex: 2,
    marginTop: 0,
  },
});
