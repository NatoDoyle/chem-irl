import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LOVE_LANGUAGE_OPTIONS } from '../../config/profileOptions';
import { onboardingStyles as sharedStyles } from './onboardingStyles';
import { useOnboardingSave } from './useOnboardingSave';

export default function LoveLanguageScreen() {
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const { save, loading } = useOnboardingSave({
    fieldPath: 'preferences.love_language',
    nextScreen: 'PersonalityType',
    eventName: 'onboarding_love_language_completed',
  });

  const handleContinue = async () => {
    await save(selectedLanguage);
  };

  const handleSkip = async () => {
    setSelectedLanguage(null);
    await save(null);
  };

  return (
    <ScrollView style={sharedStyles.container} contentContainerStyle={sharedStyles.content}>
      <Text style={sharedStyles.title}>Love language</Text>
      <Text style={sharedStyles.subtitle}>How do you prefer to give and receive love?</Text>

      <View style={sharedStyles.form}>
        {LOVE_LANGUAGE_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              sharedStyles.optionButton,
              selectedLanguage === option.value && sharedStyles.optionButtonSelected,
            ]}
            onPress={() => setSelectedLanguage(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                sharedStyles.optionText,
                selectedLanguage === option.value && sharedStyles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

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
  continueButton: {
    flex: 2,
    marginTop: 0,
  },
});
