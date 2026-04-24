import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { BRAND_COLORS } from '../../config/brand';
import { ORIENTATION_OPTIONS, type UserOrientation } from '../../config/profileOptions';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { onboardingStyles as styles } from './onboardingStyles';

type InterestedInScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'InterestedIn'
>;

export default function InterestedInScreen() {
  const navigation = useNavigation<InterestedInScreenNavigationProp>();
  const [selectedOrientation, setSelectedOrientation] = useState<UserOrientation | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedOrientation) {
      Alert.alert('Selection required', "Please select who you're interested in");
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
        .update({ orientation: selectedOrientation })
        .eq('user_id', user.id)
        .select('user_id')
        .single();

      if (error) {
        console.error('Error saving orientation:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const { title, message } = getErrorAlert(error, 'Failed to save preference');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_orientation_completed', {
        orientation: selectedOrientation,
      });

      // Navigate to next screen
      navigation.navigate('Height');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save preference');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Who are you interested in?</Text>
      <Text style={styles.subtitle}>This helps us show you relevant matches</Text>

      <View style={styles.form}>
        {ORIENTATION_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.optionButton,
              selectedOrientation === option.value && styles.optionButtonSelected,
            ]}
            onPress={() => setSelectedOrientation(option.value)}
            disabled={loading}
          >
            <Text
              style={[
                styles.optionText,
                selectedOrientation === option.value && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, (!selectedOrientation || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!selectedOrientation || loading}
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
