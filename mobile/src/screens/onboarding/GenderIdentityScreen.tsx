import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { GENDER_OPTIONS, type UserGender } from '../../config/profileOptions';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { onboardingStyles as styles } from './onboardingStyles';

type GenderIdentityScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'GenderIdentity'
>;

export default function GenderIdentityScreen() {
  const navigation = useNavigation<GenderIdentityScreenNavigationProp>();
  const [selectedGender, setSelectedGender] = useState<UserGender | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedGender) {
      Alert.alert('Selection required', 'Please select your gender identity');
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

      // Update users table
      const { error } = await supabase
        .from('users')
        .update({ gender: selectedGender })
        .eq('user_id', user.id)
        .select('user_id')
        .single();

      if (error) {
        console.error('Error saving gender:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const { title, message } = getErrorAlert(error, 'Failed to save gender');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_gender_completed', {
        gender: selectedGender,
      });

      // Navigate to next screen
      navigation.navigate('InterestedIn');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save gender');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>What's your gender identity?</Text>
      <Text style={styles.subtitle}>This helps us show you relevant matches</Text>

      <View style={styles.form}>
        {GENDER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedGender === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedGender(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                selectedGender === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, (!selectedGender || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedGender || loading}
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
