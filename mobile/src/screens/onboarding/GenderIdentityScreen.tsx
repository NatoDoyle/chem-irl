import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY } from '../../config/brand';
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
  const [otherText, setOtherText] = useState('');
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

  const handleSkip = () => {
    navigation.navigate('InterestedIn');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 200 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>I identify as...</Text>
        <Text style={styles.subtitle}>
          Authenticity is the catalyst for real chemistry. Select the identity that fits you best.
        </Text>

        <View style={styles.form}>
          {GENDER_OPTIONS.map((option) => {
            const isSelected = selectedGender === option.value;
            const isOther = option.value === 'other';

            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                onPress={() => setSelectedGender(option.value)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <View style={localStyles.optionRow}>
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                  <View
                    style={[localStyles.radioOuter, isSelected && localStyles.radioOuterSelected]}
                  >
                    {isSelected && <View style={localStyles.radioInner} />}
                  </View>
                </View>

                {isOther && isSelected && (
                  <TextInput
                    style={localStyles.otherInput}
                    placeholder="Specify your identity"
                    placeholderTextColor={BRAND_COLORS.text[400]}
                    value={otherText}
                    onChangeText={setOtherText}
                    autoFocus
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <LinearGradient
        colors={['transparent', MIDNIGHT.bg, MIDNIGHT.bg]}
        locations={[0, 0.3, 1]}
        style={localStyles.footer}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={[
            styles.button,
            localStyles.footerButton,
            (!selectedGender || loading) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedGender || loading}
        >
          {loading ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={localStyles.footerButtonText}>CONTINUE</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSkip} disabled={loading}>
          <Text style={localStyles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const localStyles = StyleSheet.create({
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1a1f2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: BRAND_COLORS.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND_COLORS.primary,
  },
  otherInput: {
    marginTop: 16,
    backgroundColor: 'rgba(13, 15, 20, 0.5)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: BRAND_COLORS.text[900],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 24,
  },
  footerButton: {
    borderRadius: 14,
    marginTop: 0,
  },
  footerButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    textTransform: 'uppercase',
  },
  skipText: {
    color: BRAND_COLORS.text[500],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textAlign: 'center',
    marginTop: 24,
  },
});
