/**
 * Profile Review Screen - Phase 7, Step 25
 * NON-SKIPPABLE - Final review before entering app
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { markStepResolved } from '../../lib/onboarding/flowGuard';
import { BRAND_COLORS } from '../../config/brand';

export default function ProfileReviewScreen() {
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load full profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      // Load user data
      const { data: userData } = await supabase
        .from('users')
        .select('dob, gender, orientation, email, phone')
        .eq('user_id', user.id)
        .maybeSingle();

      setProfileData({
        ...profile,
        ...userData,
        user,
      });
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob: string | null | undefined): number | null => {
    if (!dob) return null;
    try {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 18 ? age : null;
    } catch {
      return null;
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    try {
      // Mark review step as complete
      const result = await markStepResolved('profile_review', 'completed');
      if (!result.success) {
        return { success: false, error: result.error?.message || 'Failed to mark review complete' };
      }

      // Mark onboarding as complete by setting all steps as resolved
      // The FlowGuard will detect this and allow app access
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // Update profile to mark onboarding complete
      const { error } = await supabase
        .from('profiles')
        .update({
          signup_completed: true,
          completion_pct: 100,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to complete onboarding');
        Alert.alert(title, message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
      return { success: false, error: error.message };
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <BaseOnboardingScreen
        stepId="profile_review"
        onContinue={handleContinue}
        canContinue={false}
        loading={true}
      >
        <View style={styles.content}>
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </BaseOnboardingScreen>
    );
  }

  const age = calculateAge(profileData?.dob);
  const photos = (profileData?.photos as string[]) || [];
  const prompts = (profileData?.prompts as Record<string, string>) || {};

  return (
    <BaseOnboardingScreen
      stepId="profile_review"
      onContinue={handleContinue}
      canContinue={true}
      loading={saving}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.sectionTitle}>Review Your Profile</Text>
        <Text style={styles.subtitle}>
          Make sure everything looks good before you start matching
        </Text>

        {/* Photos */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos ({photos.length})</Text>
            <View style={styles.photosContainer}>
              {photos.slice(0, 3).map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  style={styles.photoPreview}
                  contentFit="cover"
                />
              ))}
            </View>
          </View>
        )}

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Basic Information</Text>
          {age && <Text style={styles.field}>Age: {age}</Text>}
          {profileData?.gender && <Text style={styles.field}>Gender: {profileData.gender}</Text>}
          {profileData?.interested_in && (
            <Text style={styles.field}>
              Interested In: {(profileData.interested_in as string[]).join(', ')}
            </Text>
          )}
        </View>

        {/* Bio */}
        {profileData?.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bio</Text>
            <Text style={styles.bioText}>{profileData.bio}</Text>
          </View>
        )}

        {/* Headline */}
        {prompts.headline && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Headline</Text>
            <Text style={styles.field}>{prompts.headline}</Text>
          </View>
        )}

        {/* Other fields */}
        {profileData?.favourite_first_dates &&
          (profileData.favourite_first_dates as string[]).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Ideal First Dates</Text>
              {(profileData.favourite_first_dates as string[]).map((date, index) => (
                <Text key={index} style={styles.field}>
                  • {date}
                </Text>
              ))}
            </View>
          )}

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => {
            // Navigate to edit - for now just show alert
            Alert.alert(
              'Edit Profile',
              'You can edit your profile from the Profile screen after entering the app.'
            );
          }}
        >
          <Text style={styles.editButtonText}>Edit Profile Later</Text>
        </TouchableOpacity>
      </ScrollView>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    gap: 24,
    paddingBottom: 32,
  },
  loadingText: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    padding: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 8,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 4,
  },
  photosContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  photoPreview: {
    width: 80,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  field: {
    fontSize: 16,
    color: BRAND_COLORS.text[700],
    lineHeight: 24,
  },
  bioText: {
    fontSize: 16,
    color: BRAND_COLORS.text[700],
    lineHeight: 24,
  },
  editButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_COLORS.primary,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  editButtonText: {
    color: BRAND_COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
