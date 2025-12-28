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
import { sendPhoneOTP } from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';
import { isValidE164Phone, formatToE164 } from '../../lib/phoneValidation';

type LoginPhoneScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'LoginPhone'>;

export default function LoginPhoneScreen() {
  const navigation = useNavigation<LoginPhoneScreenNavigationProp>();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const phoneTrimmed = phone.trim();

    if (!phoneTrimmed || !isValidE164Phone(phoneTrimmed)) {
      const { title, message } = getErrorAlert(
        new Error('Please enter a valid phone number in international format (e.g., +1234567890)'),
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneOTP(phoneTrimmed, false);

      if (!result.success) {
        const { title, message } = getErrorAlert(
          new Error(result.error || 'Failed to send code'),
          'Error'
        );
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      navigation.navigate('LoginPhoneVerify', { phone: phoneTrimmed });
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
        <Text style={styles.title}>Log in</Text>
        <Text style={styles.subtitle}>Enter your phone number to receive a verification code</Text>

        <TextInput
          style={styles.input}
          placeholder="+1234567890"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={phone}
          onChangeText={(text) => setPhone(formatToE164(text))}
          keyboardType="phone-pad"
          autoComplete="tel"
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
