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
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { sanitizeText, sanitizeMultilineText } from '../../lib/sanitize';
import { trackEvent } from '../../lib/analytics';

type OnboardingStackParamList = {
  ProfileSetup: undefined;
  Photos: undefined;
  Preferences: undefined;
};

type ProfileSetupScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'ProfileSetup'
>;

export default function ProfileSetupScreen() {
  const navigation = useNavigation<ProfileSetupScreenNavigationProp>();
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);

  // Clamp bio to 200 characters
  const handleBioChange = (text: string) => {
    if (text.length <= 200) {
      setBio(text);
    } else {
      setBio(text.substring(0, 200));
    }
  };

  const handleContinue = async () => {
    const headlineTrimmed = headline.trim();
    const bioTrimmed = bio.trim();

    // Validate bio max length only (no min length, no required fields)
    if (bioTrimmed.length > 200) {
      const { title, message } = getErrorAlert(
        'Bio must be 200 characters or less',
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

      // Sanitize user inputs before storing (set to null if empty)
      const sanitizedHeadline = headlineTrimmed.length > 0 ? sanitizeText(headlineTrimmed) : null;
      const sanitizedBio = bioTrimmed.length > 0 ? sanitizeMultilineText(bioTrimmed) : null;

      // Build prompts payload (omit keys if null)
      const promptsUpdate = {
        ...(sanitizedHeadline !== null && { headline: sanitizedHeadline }),
        ...(sanitizedBio !== null && { bio: sanitizedBio }),
      };

      // Upsert profile
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: promptsUpdate,
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
        hasHeadline: !!sanitizedHeadline,
        hasBio: !!sanitizedBio,
      });

      // Navigate to photos screen
      navigation.navigate('Photos' as any);
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
        <Text style={styles.label}>Headline (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="A short, catchy headline"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={headline}
          onChangeText={setHeadline}
          maxLength={100}
          editable={!loading}
        />

        <View>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Bio (optional)</Text>
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell people about yourself..."
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={bio}
            onChangeText={handleBioChange}
            multiline
            numberOfLines={4}
            maxLength={200}
            editable={!loading}
          />
        </View>

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
    backgroundColor: BRAND_COLORS.surface,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  charCount: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'BRAND_COLORS.background[50]',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
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
