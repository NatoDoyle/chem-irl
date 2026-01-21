/**
 * Work & Education Screen - Phase 5, Step 19
 * OPTIONAL BUT ENFORCED - User must enter work/education or skip
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

export default function WorkEducationScreen() {
  const [jobTitle, setJobTitle] = useState('');
  const [education, setEducation] = useState('');
  const [jobSkipped, setJobSkipped] = useState(false);
  const [educationSkipped, setEducationSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingWorkEducation();
  }, []);

  const loadExistingWorkEducation = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('job_title, education')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        if (profile.job_title === 'prefer_not_to_say' || profile.job_title === '') {
          setJobSkipped(true);
        } else {
          setJobTitle(profile.job_title || '');
        }

        if (profile.education === 'prefer_not_to_say' || profile.education === '') {
          setEducationSkipped(true);
        } else {
          setEducation(profile.education || '');
        }
      }
    } catch (error) {
      console.error('Error loading work/education:', error);
    }
  };

  const handleSkipJob = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Job Title',
        'Are you sure you want to skip this? You can always add it later from your profile.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ success: false, error: 'Cancelled' }),
          },
          {
            text: 'Skip',
            onPress: () => {
              setJobSkipped(true);
              setJobTitle('');
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleSkipEducation = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Education',
        'Are you sure you want to skip this? You can always add it later from your profile.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ success: false, error: 'Cancelled' }),
          },
          {
            text: 'Skip',
            onPress: () => {
              setEducationSkipped(true);
              setEducation('');
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    // At least one field must be filled or skipped
    if (
      !jobSkipped &&
      jobTitle.trim().length === 0 &&
      !educationSkipped &&
      education.trim().length === 0
    ) {
      Alert.alert('Error', 'Please enter at least one field or skip both');
      return { success: false, error: 'No data' };
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          job_title: jobSkipped ? 'prefer_not_to_say' : jobTitle.trim() || null,
          education: educationSkipped ? 'prefer_not_to_say' : education.trim() || null,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save work/education');
        Alert.alert(title, message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const canContinue =
    jobSkipped || educationSkipped || jobTitle.trim().length > 0 || education.trim().length > 0;

  return (
    <BaseOnboardingScreen
      stepId="work_education"
      onContinue={handleContinue}
      canContinue={canContinue}
      loading={loading}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>Tell us about your work and education</Text>
        <Text style={styles.hint}>Optional - Share what you do or what you studied</Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Job Title</Text>
            <TouchableOpacity onPress={handleSkipJob}>
              <Text style={styles.skipLink}>Skip</Text>
            </TouchableOpacity>
          </View>
          {jobSkipped ? (
            <View style={styles.skippedIndicator}>
              <Text style={styles.skippedText}>Skipped</Text>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="e.g., Software Engineer, Teacher, Student"
              placeholderTextColor={BRAND_COLORS.text[600]}
              value={jobTitle}
              onChangeText={(text) => {
                setJobTitle(text);
                setJobSkipped(false);
              }}
              maxLength={100}
              editable={!loading}
            />
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>Education</Text>
            <TouchableOpacity onPress={handleSkipEducation}>
              <Text style={styles.skipLink}>Skip</Text>
            </TouchableOpacity>
          </View>
          {educationSkipped ? (
            <View style={styles.skippedIndicator}>
              <Text style={styles.skippedText}>Skipped</Text>
            </View>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="e.g., Bachelor's in Computer Science, High School Diploma"
              placeholderTextColor={BRAND_COLORS.text[600]}
              value={education}
              onChangeText={(text) => {
                setEducation(text);
                setEducationSkipped(false);
              }}
              maxLength={100}
              editable={!loading}
            />
          )}
        </View>
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
    paddingBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  skipLink: {
    fontSize: 14,
    color: BRAND_COLORS.primary,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'BRAND_COLORS.background[50]',
    color: BRAND_COLORS.text[900],
  },
  skippedIndicator: {
    backgroundColor: BRAND_COLORS.text[100],
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  skippedText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
  },
});
