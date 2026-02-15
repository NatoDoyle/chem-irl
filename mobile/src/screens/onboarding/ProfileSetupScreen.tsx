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

  const handleContinue = async () => {
    const headlineTrimmed = headline.trim();
    const bioTrimmed = bio.trim();

    if (!headlineTrimmed || !bioTrimmed) {
      const { title, message } = getErrorAlert(
        'Please fill in both headline and bio',
        'Validation Error'
      );
      Alert.alert(title, message);
      return;
    }

    if (headlineTrimmed.length < 5) {
      const { title, message } = getErrorAlert(
        'Headline must be at least 5 characters',
        'Validation Error'
      );
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
      const sanitizedHeadline = sanitizeText(headlineTrimmed);
      const sanitizedBio = sanitizeMultilineText(bioTrimmed);

      // Upsert profile
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          headline: sanitizedHeadline,
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
        hasHeadline: sanitizedHeadline.length > 0,
        hasBio: sanitizedBio.length > 0,
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
        <Text style={styles.label}>Headline</Text>
        <TextInput
          style={styles.input}
          placeholder="A short, catchy headline"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={headline}
          onChangeText={setHeadline}
          maxLength={100}
          editable={!loading}
        />

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
            <ActivityIndicator color="#fff" />
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
    backgroundColor: '#fff',
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
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
