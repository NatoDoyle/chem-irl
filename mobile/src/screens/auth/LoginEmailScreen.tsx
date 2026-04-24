import { useState } from 'react';
import { View, StyleSheet, TextInput, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { sendEmailOTP } from '../../lib/auth';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS, GOLDEN_HOUR, REFINED_WARMTH, TYPOGRAPHY, SPACING } from '../../config/brand';
import GHScreen from '../../components/ui/GHScreen';
import GHButton from '../../components/ui/GHButton';

type LoginEmailScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'LoginEmail'>;

export default function LoginEmailScreen() {
  const navigation = useNavigation<LoginEmailScreenNavigationProp>();
  const [email, setEmail] = useState('');
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
      const result = await sendEmailOTP(emailTrimmed, false);

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
        isSignup: false,
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
          Log in
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(100)}
          style={styles.subtitle}
        >
          Enter your email to receive a verification code
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.duration(REFINED_WARMTH.animation.duration.entrance).delay(200)}
        >
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

          <GHButton
            title="Continue"
            onPress={handleContinue}
            loading={loading}
            disabled={loading}
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
});
