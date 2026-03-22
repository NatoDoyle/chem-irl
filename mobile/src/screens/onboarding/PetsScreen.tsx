import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { PETS_OPTIONS } from '../../config/profileOptions';
import { onboardingStyles as styles } from './onboardingStyles';
import { useOnboardingSave } from './useOnboardingSave';

export default function PetsScreen() {
  const [selectedPet, setSelectedPet] = useState<string | null>(null);
  const { save, loading } = useOnboardingSave({
    fieldPath: 'demographics.pets',
    nextScreen: 'Lifestyle',
    eventName: 'onboarding_pets_completed',
  });

  const handleContinue = async () => {
    if (!selectedPet) {
      Alert.alert('Selection required', 'Please select your pets preference');
      return;
    }
    await save(selectedPet);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pets</Text>
      <Text style={styles.subtitle}>This helps us match you with compatible people</Text>

      <View style={styles.form}>
        {PETS_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedPet === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedPet(option.value)}
            disabled={loading}
          >
            <Text
              style={[styles.optionText, selectedPet === option.value && styles.optionTextSelected]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, (!selectedPet || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedPet || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
