import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { useProfileRefresh } from '../../contexts/ProfileRefreshContext';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type ProfileReviewScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'ProfileReview'
>;

export default function ProfileReviewScreen() {
  const navigation = useNavigation<ProfileReviewScreenNavigationProp>();
  const refreshProfile = useProfileRefresh();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
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

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('photos, prompts, completion_pct')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to load profile');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      setProfile(profileData);
      setLoading(false);
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to load profile');
      Alert.alert(title, message);
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { title, message } = getErrorAlert('Not authenticated', 'Authentication Error');
        Alert.alert(title, message);
        setSaving(false);
        return;
      }

      // Mark profile as complete and signup as completed
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        completion_pct: 100,
        signup_completed: true,
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to complete profile');
        Alert.alert(title, message);
        setSaving(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_completed', {
        hasPhotos: (profile?.photos?.length || 0) >= 2,
        hasBio: !!profile?.prompts?.bio,
      });

      refreshProfile();
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to complete profile');
      Alert.alert(title, message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  const prompts = (profile?.prompts ?? {}) as Record<string, any>;
  const photos = (profile?.photos ?? []) as string[];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Review Your Profile</Text>
      <Text style={styles.subtitle}>Review your information before entering the app</Text>

      <View style={styles.sections}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos ({photos.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
            {photos.map((photo, index) => (
              <Image
                key={index}
                source={{ uri: photo }}
                style={styles.photoThumbnail}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <Text style={styles.sectionValue}>{prompts.bio || 'Not set'}</Text>
        </View>

        {prompts.demographics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferences</Text>
            {prompts.demographics.height_cm && (
              <Text style={styles.sectionValue}>Height: {prompts.demographics.height_cm} cm</Text>
            )}
            {prompts.demographics.relationship_intent && (
              <Text style={styles.sectionValue}>
                Looking for: {prompts.demographics.relationship_intent}
              </Text>
            )}
          </View>
        )}

        {prompts.preferences && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests & More</Text>
            {prompts.preferences.interests && (
              <Text style={styles.sectionValue}>
                Interests: {prompts.preferences.interests.join(', ')}
              </Text>
            )}
            {prompts.preferences.ideal_first_dates && (
              <Text style={styles.sectionValue}>
                Ideal dates: {prompts.preferences.ideal_first_dates.join(', ')}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.editButton, saving && styles.buttonDisabled]}
          onPress={() => {
            // Navigate back to ProfileSetup to edit
            navigation.navigate('ProfileSetup');
          }}
          disabled={saving}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleComplete}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>Complete & Enter App</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Optional Iris interview path. Existing Complete & Enter App above
          stays the canonical finishing flow; tapping below diverts to a
          skippable extra step. */}
      <TouchableOpacity
        style={styles.irisLink}
        onPress={() => navigation.navigate('IrisInterview')}
        disabled={saving}
      >
        <Text style={styles.irisLinkText}>Want a hand? Talk to Iris first →</Text>
      </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  sections: {
    gap: 24,
    marginBottom: 32,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
  },
  sectionValue: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    lineHeight: 24,
  },
  photosScroll: {
    marginTop: 8,
  },
  photoThumbnail: {
    width: 100,
    height: 100,
    borderRadius: GOLDEN_HOUR.radius.lg,
    marginRight: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
  },
  editButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  button: {
    flex: 2,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
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
  irisLink: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  irisLinkText: {
    color: BRAND_COLORS.aqua[300],
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
