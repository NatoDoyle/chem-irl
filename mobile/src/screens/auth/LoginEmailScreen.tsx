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

type LoginEmailScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'LoginEmail'>;

type RouteParams = {
  prefillEmail?: string;
};

export default function LoginEmailScreen() {
  const navigation = useNavigation<LoginEmailScreenNavigationProp>();
  const route = useRoute();
  const { prefillEmail } = (route.params || {}) as RouteParams;
  const [email, setEmail] = useState(prefillEmail || '');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const emailTrimmed = email.trim();

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

    // Check if email exists before attempting to send OTP
    setLoading(true);
    try {
      const emailCheckResult = await emailExists(normalizedEmail);

      if (emailCheckResult.success && emailCheckResult.exists === false) {
        // Email doesn't exist, show friendly message
        setLoading(false);
        Alert.alert('Email not registered', "This email isn't registered yet. Please sign up.", [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign up',
            onPress: () => {
              navigation.navigate('SignUpEmail', { prefillEmail: normalizedEmail });
            },
          },
        ]);
        return;
      }

      // If emailExists check failed, proceed with sendEmailOTP (fallback)
      // If email exists, proceed with sendEmailOTP
      const result = await sendEmailOTP(normalizedEmail, false);

      if (!result.success) {
        // Check if error is "Signups not allowed for otp" (unregistered email)
        const errorMessage = result.error || '';
        const isSignupNotAllowed = errorMessage
          .toLowerCase()
          .includes('signups not allowed for otp');

        if (isSignupNotAllowed) {
          // Show friendly message for unregistered email
          Alert.alert('Email not registered', "This email isn't registered yet. Please sign up.", [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign up',
              onPress: () => {
                navigation.navigate('SignUpEmail', { prefillEmail: normalizedEmail });
              },
            },
          ]);
          return;
        }

        // Other errors
        const { title, message } = getErrorAlert(
          new Error(result.error || 'Failed to send code'),
          'Error'
        );
        Alert.alert(title, message);
        return;
      }

      navigation.navigate('EmailCodeVerify', {
        email: normalizedEmail,
        isSignup: false,
      });
    } catch (error: any) {
      // Check if error is "Signups not allowed for otp" (unregistered email)
      const errorMessage = error.message || '';
      const isSignupNotAllowed = errorMessage.toLowerCase().includes('signups not allowed for otp');

      if (isSignupNotAllowed) {
        // Show friendly message for unregistered email
        Alert.alert('Email not registered', "This email isn't registered yet. Please sign up.", [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign up',
            onPress: () => {
              navigation.navigate('SignUpEmail', { prefillEmail: normalizedEmail });
            },
          },
        ]);
      } else {
        const { title, message } = getErrorAlert(error, 'Error');
        Alert.alert(title, message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Log in</Text>
        <Text style={styles.subtitle}>Enter your email to receive a verification code</Text>

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
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
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
