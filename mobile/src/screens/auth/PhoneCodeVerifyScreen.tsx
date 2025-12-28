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
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { verifyPhoneOTP, sendPhoneOTP, completeSignup } from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

type RouteParams = {
  phone: string;
  type: 'sms' | 'phone_change';
  fullName?: string;
};

type PhoneCodeVerifyScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'PhoneCodeVerify'
>;

export default function PhoneCodeVerifyScreen() {
  const navigation = useNavigation<PhoneCodeVerifyScreenNavigationProp>();
  const route = useRoute();
  const { phone, type, fullName } = route.params as RouteParams;
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
      const result = await verifyPhoneOTP(phone, tokenToVerify, type);

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

      // If this is a signup flow (type === 'sms' and we just verified phone), complete signup
      if (type === 'sms' && result.session) {
        if (fullName) {
          // Complete signup with name collected earlier in flow
          const completeResult = await completeSignup(fullName);
          if (!completeResult.success) {
            const { title, message } = getErrorAlert(
              new Error(completeResult.error || 'Failed to complete signup'),
              'Error'
            );
            Alert.alert(title, message);
            setLoading(false);
            return;
          }
          // Signup complete - App.tsx will handle routing
        } else {
          // Name not passed through - navigate to name collection
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (navigation as any).navigate('NameEnter');
        }
      }

      // Navigation will be handled by App.tsx based on signup_completed status
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
      const result = await sendPhoneOTP(phone, type === 'sms');
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
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to {phone}</Text>

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
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendButton} onPress={handleResend} disabled={resending}>
          <Text style={styles.resendText}>
            {resending ? 'Resending...' : "Didn't receive code? Resend"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    backgroundColor: '#F8FAFC',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
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
