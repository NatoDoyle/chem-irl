import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { MIN_AGE, isAtLeastAge, latestEligibleDob, toDateOnlyISO } from '../../lib/age';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY } from '../../config/brand';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { onboardingStyles as styles } from './onboardingStyles';

type AgeDobScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'AgeDob'>;

// Sanity floor for the picker — not a legal boundary (the DB CHECK only
// enforces the 18+ side).
const EARLIEST_DOB = new Date(new Date().getFullYear() - 100, 0, 1);

export default function AgeDobScreen() {
  const navigation = useNavigation<AgeDobScreenNavigationProp>();
  const [dob, setDob] = useState<Date | null>(null);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const maxDob = latestEligibleDob();

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowAndroidPicker(false);
      if (event.type !== 'set' || !selected) return;
    }
    if (!selected) return;
    setDob(selected);
  };

  const underageHardStop = () => {
    Alert.alert(
      `You must be ${MIN_AGE} or older`,
      'Chem IRL is for adults only, so we have to sign you out.',
      [
        {
          text: 'OK',
          onPress: () => {
            supabase.auth.signOut().catch(() => {
              // App.tsx's auth listener handles the transition either way.
            });
          },
        },
      ]
    );
  };

  const handleContinue = async () => {
    if (!dob) {
      Alert.alert('Date of birth required', 'Please select your date of birth.');
      return;
    }

    const dobISO = toDateOnlyISO(dob);
    if (!isAtLeastAge(dobISO)) {
      underageHardStop();
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

      const { error } = await supabase
        .from('users')
        .update({ dob: dobISO })
        .eq('user_id', user.id)
        .select('user_id')
        .single();

      if (error) {
        // users_dob_18_plus CHECK — the server-side twin of the client
        // validation, in case a wrong device clock (or tampered client)
        // got past isAtLeastAge.
        if (error.message?.includes('users_dob_18_plus')) {
          underageHardStop();
          setLoading(false);
          return;
        }
        console.error('Error saving date of birth:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const { title, message } = getErrorAlert(error, 'Failed to save date of birth');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      trackEvent('onboarding_age_completed');
      navigation.navigate('GenderIdentity');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save date of birth');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.content, localStyles.body]}>
        <Text style={styles.title}>When were you born?</Text>
        <Text style={styles.subtitle}>
          Chem IRL is for adults only — you must be {MIN_AGE} or older. Your date of birth is used
          to confirm your age and is never shown on your profile.
        </Text>

        {Platform.OS === 'android' ? (
          <>
            <TouchableOpacity
              style={[styles.optionButton, dob != null && styles.optionButtonSelected]}
              onPress={() => setShowAndroidPicker(true)}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, dob != null && styles.optionTextSelected]}>
                {dob ? dob.toLocaleDateString() : 'Select your date of birth'}
              </Text>
            </TouchableOpacity>
            {showAndroidPicker && (
              <DateTimePicker
                value={dob ?? maxDob}
                mode="date"
                maximumDate={maxDob}
                minimumDate={EARLIEST_DOB}
                onChange={handleChange}
              />
            )}
          </>
        ) : (
          <View style={localStyles.pickerWrap}>
            <DateTimePicker
              value={dob ?? maxDob}
              mode="date"
              display="spinner"
              maximumDate={maxDob}
              minimumDate={EARLIEST_DOB}
              onChange={handleChange}
              themeVariant="dark"
            />
          </View>
        )}
      </View>

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
            (!dob || loading) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!dob || loading}
        >
          {loading ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={localStyles.footerButtonText}>CONTINUE</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const localStyles = StyleSheet.create({
  body: {
    paddingBottom: 160,
  },
  pickerWrap: {
    alignItems: 'center',
    marginTop: 24,
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
});
