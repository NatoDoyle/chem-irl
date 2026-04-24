import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { verifyEmailOTP, sendEmailOTP, completeSignup } from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS, GOLDEN_HOUR, REFINED_WARMTH, TYPOGRAPHY, SPACING } from '../../config/brand';
import GHScreen from '../../components/ui/GHScreen';
import GHButton from '../../components/ui/GHButton';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

type RouteParams = {
  email: string;
  fullName?: string;
  isSignup: boolean;
};

export default function EmailCodeVerifyScreen() {
  const route = useRoute();
  const { email, fullName, isSignup } = route.params as RouteParams;
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      const lastIndex = Math.min(index + pastedCode.length - 1, 5);
      inputRefs.current[lastIndex]?.focus();
      if (newCode.every((c) => c !== '')) {
        handleVerify(newCode.join(''));
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newCode.every((c) => c !== '') && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (token?: string) => {
    const tokenToVerify = token || code.join('');
    if (tokenToVerify.length !== 6) {
      const { title, message } = getErrorAlert(
        new Error('Please enter the 6-digit code'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    setLoading(true);
    try {
      const result = await verifyEmailOTP(email, tokenToVerify, isSignup);

      if (!result.success) {
        const { title, message } = getErrorAlert(
          new Error(result.error || 'Invalid code'),
          'Error'
        );
        Alert.alert(title, message);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      if (isSignup && fullName) {
        const signupResult = await completeSignup(fullName);
        if (!signupResult.success) {
          const { title, message } = getErrorAlert(
            new Error(signupResult.error || 'Failed to complete signup'),
            'Error'
          );
          Alert.alert(title, message);
          return;
        }
      }
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const result = await sendEmailOTP(email, isSignup);
      if (!result.success) {
        const { title, message } = getErrorAlert(
          new Error(result.error || 'Failed to resend code'),
          'Error'
        );
        Alert.alert(title, message);
      }
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
    } finally {
      setResending(false);
    }
  };

  return (
    <GHScreen gradient>
      <View style={styles.content}>
        <Animated.Text
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance)}
          style={styles.title}
        >
          Enter verification code
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(100)}
          style={styles.subtitle}
        >
          We sent a 6-digit code to {email}. Enter it below to verify your email.
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(200)}
        >
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[styles.codeInput, digit && styles.codeInputFilled]}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="number-pad"
                maxLength={6}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>

          <GHButton
            title="Verify"
            onPress={() => handleVerify()}
            loading={loading}
            disabled={loading || code.some((c) => !c)}
          />

          <AnimatedPressable
            onPress={handleResend}
            disabled={resending}
            style={styles.resendButton}
            haptic={false}
          >
            <Text style={styles.resendText}>
              {resending ? 'Resending...' : "Didn't receive code? Resend"}
            </Text>
          </AnimatedPressable>
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  codeInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: REFINED_WARMTH.radius.md,
    padding: SPACING.base,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    textAlign: 'center',
    backgroundColor: GOLDEN_HOUR.inputBg,
    color: BRAND_COLORS.text[900],
  },
  codeInputFilled: {
    borderColor: BRAND_COLORS.primary,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.base,
  },
  resendText: {
    color: BRAND_COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
