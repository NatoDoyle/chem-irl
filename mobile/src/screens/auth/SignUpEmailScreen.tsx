import { useState } from 'react';
import { View, StyleSheet, TextInput, Alert, Text, TouchableOpacity, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendEmailOTP } from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import {
  BRAND,
  BRAND_COLORS,
  GOLDEN_HOUR,
  REFINED_WARMTH,
  TYPOGRAPHY,
  SPACING,
} from '../../config/brand';
import { sanitizeText } from '../../lib/sanitize';
import GHScreen from '../../components/ui/GHScreen';
import GHButton from '../../components/ui/GHButton';

type SignUpEmailScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUpEmail'>;

export default function SignUpEmailScreen() {
  const navigation = useNavigation<SignUpEmailScreenNavigationProp>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  // 18+ / Terms attestation. Required to continue; persisted to
  // profiles.terms_accepted(_at) by completeSignup() after OTP verify
  // (no authed session exists before then).
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const nameTrimmed = fullName.trim();
    const emailTrimmed = email.trim();

    if (!nameTrimmed || nameTrimmed.length < 2) {
      const { title, message } = getErrorAlert(
        new Error('Please enter your full name (at least 2 characters)'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    if (!emailTrimmed) {
      const { title, message } = getErrorAlert(
        new Error('Please enter your email address'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      const { title, message } = getErrorAlert(
        new Error('Please enter a valid email address'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    if (!termsAccepted) {
      const { title, message } = getErrorAlert(
        new Error('Please confirm you are 18 or older and accept the terms to continue'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    setLoading(true);
    try {
      const result = await sendEmailOTP(emailTrimmed, true);

      if (!result.success) {
        const { title, message } = getErrorAlert(
          new Error(result.error || 'Failed to send code'),
          'Error'
        );
        Alert.alert(title, message);
        return;
      }

      navigation.navigate('EmailCodeVerify', {
        email: emailTrimmed,
        fullName: sanitizeText(nameTrimmed),
        isSignup: true,
      });
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <GHScreen gradient>
      <View style={styles.content}>
        <Animated.Text
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance)}
          style={styles.title}
        >
          Sign up
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(100)}
          style={styles.subtitle}
        >
          Enter your name and email to get started
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(200)}
        >
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={BRAND_COLORS.text[500]}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={BRAND_COLORS.text[500]}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!loading}
          />

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setTermsAccepted((v) => !v)}
            disabled={loading}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: termsAccepted }}
          >
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Text style={styles.checkboxTick}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I confirm I am 18 or older and agree to the{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(`${BRAND.url}/terms`)}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL(`${BRAND.url}/privacy`)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </TouchableOpacity>

          <GHButton
            title="Continue"
            onPress={handleContinue}
            loading={loading}
            disabled={loading || !termsAccepted}
          />
        </Animated.View>
      </View>
    </GHScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingTop: SPACING['2xl'],
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: SPACING.xl,
  },
  input: {
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: REFINED_WARMTH.radius.lg,
    padding: SPACING.base,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.lg,
    backgroundColor: GOLDEN_HOUR.inputBg,
    color: BRAND_COLORS.text[900],
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
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
  termsText: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    lineHeight: 20,
  },
  termsLink: {
    color: BRAND_COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    textDecorationLine: 'underline',
  },
});
