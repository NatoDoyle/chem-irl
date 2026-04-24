import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { BRAND_COLORS } from '../../config/brand';
import { INTENT_OPTIONS } from '../../config/profileOptions';
import { onboardingStyles as styles } from './onboardingStyles';
import { useOnboardingSave } from './useOnboardingSave';

export default function RelationshipIntentScreen() {
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const { save, loading } = useOnboardingSave({
    fieldPath: 'demographics.relationship_intent',
    nextScreen: 'FamilyPlans',
    eventName: 'onboarding_relationship_intent_completed',
  });

  const handleContinue = async () => {
    if (!selectedIntent) {
      Alert.alert('Selection required', 'Please select your relationship intent');
      return;
    }
    await save(selectedIntent);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>What are you looking for?</Text>
      <Text style={styles.subtitle}>This helps us match you with compatible people</Text>

      <View style={styles.form}>
        {INTENT_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedIntent === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedIntent(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                selectedIntent === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, (!selectedIntent || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedIntent || loading}
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
