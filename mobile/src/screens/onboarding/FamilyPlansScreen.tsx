import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { BRAND_COLORS } from '../../config/brand';
import { FAMILY_PLANS_OPTIONS } from '../../config/profileOptions';
import { onboardingStyles as styles } from './onboardingStyles';
import { useOnboardingSave } from './useOnboardingSave';

export default function FamilyPlansScreen() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const { save, loading } = useOnboardingSave({
    fieldPath: 'demographics.family_plans',
    nextScreen: 'Pets',
    eventName: 'onboarding_family_plans_completed',
  });

  const handleContinue = async () => {
    if (!selectedPlan) {
      Alert.alert('Selection required', 'Please select your family plans preference');
      return;
    }
    await save(selectedPlan);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Family plans</Text>
      <Text style={styles.subtitle}>This helps us match you with compatible people</Text>

      <View style={styles.form}>
        {FAMILY_PLANS_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedPlan === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedPlan(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                selectedPlan === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, (!selectedPlan || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedPlan || loading}
        >
          {loading ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
