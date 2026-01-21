import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  verifyEmailOTP,
  sendEmailOTP,
  completeSignup,
  normalizeEmail,
  normalizeOtpToken,
} from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

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
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showResendMessage, setShowResendMessage] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const resendCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      // Focus last filled input or submit
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

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
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
    const rawToken = token || code.join('');
    const normalizedToken = normalizeOtpToken(rawToken);

    if (normalizedToken.length !== 6) {
      const { title, message } = getErrorAlert(
        new Error('Please enter the 6-digit code'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    const normalizedEmail = normalizeEmail(email);

    setLoading(true);
    try {
      const result = await verifyEmailOTP(normalizedEmail, normalizedToken, isSignup);

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
        // Complete signup: update profile with full_name and signup_completed
        const signupResult = await completeSignup(fullName);
        if (!signupResult.success) {
          const { title, message } = getErrorAlert(
            new Error(signupResult.error || 'Failed to complete signup'),
            'Error'
          );
          Alert.alert(title, message);
          return;
        }
        // Navigation will be handled by App.tsx based on signup_completed flag
      } else {
        // Email login complete - navigation will be handled by App.tsx
        // based on signup_completed and profile completion
      }
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) {
      return;
    }

    // Guard: Clear any existing timers before starting new ones
    if (resendCooldownRef.current) {
      clearInterval(resendCooldownRef.current);
      resendCooldownRef.current = null;
    }
    if (hideMessageTimeoutRef.current) {
      clearTimeout(hideMessageTimeoutRef.current);
      hideMessageTimeoutRef.current = null;
    }

    setResending(true);
    try {
      const normalizedEmail = normalizeEmail(email);
      const result = await sendEmailOTP(normalizedEmail, isSignup);

      if (!result.success) {
        // Handle rate limit errors (429)
        if (result.isRateLimit) {
          // Extend cooldown to 120 seconds for rate limit
          const extendedCooldown = 120;
          setResendCooldown(extendedCooldown);
          let remaining = extendedCooldown;

          resendCooldownRef.current = setInterval(() => {
            remaining -= 1;
            setResendCooldown(remaining);
            if (remaining <= 0) {
              if (resendCooldownRef.current) {
                clearInterval(resendCooldownRef.current);
                resendCooldownRef.current = null;
              }
            }
          }, 1000);

          const { title, message } = getErrorAlert(
            new Error('Too many requests. Please wait before requesting another code.'),
            'Rate Limit'
          );
          Alert.alert(title, message);
        } else {
          const { title, message } = getErrorAlert(
            new Error(result.error || 'Failed to resend code'),
            'Error'
          );
          Alert.alert(title, message);
        }
        return;
      }

      // Clear code input and show message
      setCode(['', '', '', '', '', '']);
      setShowResendMessage(true);
      inputRefs.current[0]?.focus();

      // Start 60-second cooldown
      setResendCooldown(60);
      let remaining = 60;
      resendCooldownRef.current = setInterval(() => {
        remaining -= 1;
        setResendCooldown(remaining);
        if (remaining <= 0) {
          if (resendCooldownRef.current) {
            clearInterval(resendCooldownRef.current);
            resendCooldownRef.current = null;
          }
        }
      }, 1000);

      // Hide message after 5 seconds
      hideMessageTimeoutRef.current = setTimeout(() => {
        setShowResendMessage(false);
        hideMessageTimeoutRef.current = null;
      }, 5000);
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup: Clear both interval and timeout on unmount
      if (resendCooldownRef.current) {
        clearInterval(resendCooldownRef.current);
        resendCooldownRef.current = null;
      }
      if (hideMessageTimeoutRef.current) {
        clearTimeout(hideMessageTimeoutRef.current);
        hideMessageTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {email}. Enter it below to verify your email.
        </Text>

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

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading || code.some((c) => !c)}
        >
          {loading ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>

        {showResendMessage && (
          <Text style={styles.resendMessage}>
            Use the most recent code; older codes won't work.
          </Text>
        )}

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResend}
          disabled={resending || resendCooldown > 0}
        >
          <Text style={styles.resendText}>
            {resending
              ? 'Resending...'
              : resendCooldown > 0
                ? `Resend code (${resendCooldown}s)`
                : "Didn't receive code? Resend"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.surface,
    padding: 24,
    paddingTop: 80,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    gap: 8,
  },
  codeInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 24,
    textAlign: 'center',
    backgroundColor: 'BRAND_COLORS.background[50]',
    fontWeight: '600',
  },
  codeInputFilled: {
    borderColor: BRAND_COLORS.primary,
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  resendMessage: {
    color: BRAND_COLORS.text[600],
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    color: BRAND_COLORS.primary,
    fontSize: 16,
  },
});
