import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';

type OnboardingStackParamList = {
  Interests: undefined;
  IdealFirstDates: undefined;
  LoveLanguage: undefined;
  PersonalityType: undefined;
  Astrology: undefined;
  WorkEducation: undefined;
  ProfileSetup: undefined;
  Photos: undefined;
};

type PersonalityTypeScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'PersonalityType'
>;

const MBTI_OPTIONS = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

export default function PersonalityTypeScreen() {
  const navigation = useNavigation<PersonalityTypeScreenNavigationProp>();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customType, setCustomType] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const personalityType = selectedType || customType.trim() || null;

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

      // Get current profile to merge prompts
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          ...currentPrompts,
          preferences: {
            ...(currentPrompts.preferences || {}),
            personality_type: personalityType,
          },
        },
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save personality type');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_personality_type_completed', {
        hasSelection: !!personalityType,
      });

      // Navigate to next screen
      navigation.navigate('Astrology');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save personality type');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Immediately skip without confirmation
    setSelectedType(null);
    setCustomType('');
    await handleContinue();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Personality type</Text>
      <Text style={styles.subtitle}>Optional: Share your personality type (e.g., MBTI)</Text>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>MBTI Types</Text>
        <View style={styles.typesGrid}>
          {MBTI_OPTIONS.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeChip, selectedType === type && styles.typeChipSelected]}
              onPress={() => {
                setSelectedType(type);
                setCustomType('');
              }}
              disabled={loading}
            >
              <Text style={[styles.typeText, selectedType === type && styles.typeTextSelected]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Or enter custom</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter personality type"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={customType}
          onChangeText={(text) => {
            setCustomType(text);
            if (text.trim()) setSelectedType(null);
          }}
          editable={!loading}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.skipButton, loading && styles.buttonDisabled]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  typeChipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft || '#D1FFFB',
  },
  typeText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  typeTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
    color: BRAND_COLORS.text[900],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 18,
    fontWeight: '600',
  },
  button: {
    flex: 2,
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
