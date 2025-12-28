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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendEmailOTP } from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';
import { sanitizeText } from '../../lib/sanitize';

type SignUpEmailScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignUpEmail'>;

export default function SignUpEmailScreen() {
  const navigation = useNavigation<SignUpEmailScreenNavigationProp>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
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

      // Store name in route params to pass through flow
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
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
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
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    backgroundColor: '#F8FAFC',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
