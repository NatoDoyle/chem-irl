import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY, SPACING } from '../../config/brand';
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
  // Explicit, unbundled consent for processing sexual orientation (GDPR
  // Art. 9 special-category data). See docs/operations/DPIA.md GAP-1.
  // SCAFFOLDING: the wording below is PLACEHOLDER pending data-protection
  // sign-off — do not treat as final consent copy.
  const [consentGiven, setConsentGiven] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedOrientation) {
      Alert.alert('Selection required', "Please select who you're interested in");
      return;
    }
    if (!consentGiven) {
      Alert.alert(
        'Consent required',
        'Please confirm you consent to us using this information to show you matches.'
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

      // Update users table. The consent timestamp is written in the SAME
      // update as the special-category datum it covers, so the record and
      // the data can never drift apart.
      const { error } = await supabase
        .from('users')
        .update({
          orientation: selectedOrientation,
          special_category_consent_at: new Date().toISOString(),
        })
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
          style={localStyles.consentRow}
          onPress={() => setConsentGiven((v) => !v)}
          disabled={loading}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentGiven }}
        >
          <View style={[localStyles.checkbox, consentGiven && localStyles.checkboxChecked]}>
            {consentGiven && <Text style={localStyles.checkboxTick}>✓</Text>}
          </View>
          <Text style={localStyles.consentText}>
            I explicitly consent to Chem IRL using my sexual orientation to show me relevant
            matches. I can withdraw this in Settings at any time.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            (!selectedOrientation || !consentGiven || loading) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedOrientation || !consentGiven || loading}
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

const localStyles = StyleSheet.create({
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SPACING.lg,
    marginBottom: SPACING.base,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: GOLDEN_HOUR.borderDefault,
    backgroundColor: GOLDEN_HOUR.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  checkboxTick: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  consentText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    lineHeight: 20,
  },
});
