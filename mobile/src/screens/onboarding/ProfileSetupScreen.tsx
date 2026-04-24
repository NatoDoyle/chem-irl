import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { sanitizeMultilineText } from '../../lib/sanitize';
import { trackEvent } from '../../lib/analytics';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type ProfileSetupScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'ProfileSetup'
>;

export default function ProfileSetupScreen() {
  const navigation = useNavigation<ProfileSetupScreenNavigationProp>();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const bioTrimmed = bio.trim();

    if (!bioTrimmed) {
      const { title, message } = getErrorAlert('Please fill in your bio', 'Validation Error');
      Alert.alert(title, message);
      return;
    }

    if (bioTrimmed.length < 20) {
      const { title, message } = getErrorAlert(
        'Bio must be at least 20 characters',
        'Validation Error'
      );
      Alert.alert(title, message);
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

      // Sanitize user inputs before storing
      const sanitizedBio = sanitizeMultilineText(bioTrimmed);

      // Upsert profile
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          bio: sanitizedBio,
        },
        completion_pct: 50, // Will be 100 after photos
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to create profile');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track profile setup completion
      trackEvent('profile_completed', {
        hasBio: sanitizedBio.length > 0,
      });

      // Navigate to photos screen
      navigation.navigate('Photos');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to create profile');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create Your Profile</Text>
      <Text style={styles.subtitle}>Tell people about yourself</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell people about yourself..."
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          maxLength={500}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 16,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    backgroundColor: GOLDEN_HOUR.inputBg,
    color: BRAND_COLORS.text[900],
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    marginTop: 8,
    ...GOLDEN_HOUR.shadow.warm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
