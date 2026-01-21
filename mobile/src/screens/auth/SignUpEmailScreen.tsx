import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendEmailOTP, normalizeEmail, emailExists } from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';
import { sanitizeText } from '../../lib/sanitize';

type SignUpEmailScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUpEmail'>;

type RouteParams = {
  prefillEmail?: string;
};

export default function SignUpEmailScreen() {
  const navigation = useNavigation<SignUpEmailScreenNavigationProp>();
  const route = useRoute();
  const { prefillEmail } = (route.params || {}) as RouteParams;
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(prefillEmail || '');
  const [loading, setLoading] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

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

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      const { title, message } = getErrorAlert(
        new Error('Please enter a valid email address'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    const normalizedEmail = normalizeEmail(emailTrimmed);

    // Check if email already exists before proceeding with signup
    setCheckingEmail(true);
    try {
      const emailCheckResult = await emailExists(normalizedEmail);

      if (!emailCheckResult.success) {
        // If check fails (network/RPC error), allow continuing with signup but log error
        console.log(
          `[auth] emailExists check failed: ${emailCheckResult.error}, allowing signup to proceed`
        );
        // Continue with signup flow (fallback behavior)
      } else if (emailCheckResult.exists === true) {
        // Email already exists, redirect to sign in
        Alert.alert('Account already exists', 'Please sign in instead.', [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('LoginEmail', { prefillEmail: normalizedEmail });
            },
          },
        ]);
        setCheckingEmail(false);
        return;
      }
      // Email doesn't exist, proceed with signup
    } catch (error: any) {
      // If check throws, allow continuing with signup (fallback behavior)
      console.log(`[auth] emailExists check error: ${error.message}, allowing signup to proceed`);
    } finally {
      setCheckingEmail(false);
    }

    setLoading(true);
    try {
      const result = await sendEmailOTP(normalizedEmail, true);

      if (!result.success) {
        const { title, message } = getErrorAlert(
          new Error(result.error || 'Failed to send code'),
          'Error'
        );
        Alert.alert(title, message);
        return;
      }

      // Store name in route params to pass through flow
      navigation.navigate('EmailCodeVerify', {
        email: normalizedEmail,
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
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Sign up</Text>
        <Text style={styles.subtitle}>Enter your name and email to get started</Text>

        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          autoComplete="name"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, (loading || checkingEmail) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading || checkingEmail}
        >
          {loading || checkingEmail ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
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
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: 'BRAND_COLORS.background[50]',
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
});
