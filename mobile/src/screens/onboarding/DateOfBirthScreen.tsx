/**
 * Date of Birth Screen - Phase 2, Step 5
 * NON-SKIPPABLE - Must be 18+
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

export default function DateOfBirthScreen() {
  const [dob, setDob] = useState<Date>(new Date(2000, 0, 1));
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingDob();
  }, []);

  const loadExistingDob = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const userId = user.id;
      if (__DEV__) {
        console.log(
          '[DateOfBirthScreen.loadExistingDob] Querying users table for user_id:',
          userId.substring(0, 8)
        );
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('dob')
        .eq('user_id', userId)
        .maybeSingle();

      if (__DEV__ && error) {
        console.error('[DateOfBirthScreen.loadExistingDob] Supabase error:', {
          userId: userId.substring(0, 8),
          error: error.message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        });
      }

      if (userData?.dob) {
        setDob(new Date(userData.dob));
      }
    } catch (error) {
      console.error('[DateOfBirthScreen.loadExistingDob] Error loading DOB:', error);
    }
  };

  const calculateAge = (date: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age;
  };

  const handleContinue = async () => {
    const age = calculateAge(dob);
    if (age < 18) {
      Alert.alert('Error', 'You must be 18 or older to use this app');
      return { success: false, error: 'Age requirement not met' };
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const userId = user.id;
      // Format as local YYYY-MM-DD (not UTC from toISOString)
      const year = dob.getFullYear();
      const month = String(dob.getMonth() + 1).padStart(2, '0');
      const day = String(dob.getDate()).padStart(2, '0');
      const dobString = `${year}-${month}-${day}`;

      if (__DEV__) {
        console.log('[DateOfBirthScreen.handleContinue] Saving DOB:', {
          userId: userId.substring(0, 8),
          dob: dobString,
          localDate: dob.toLocaleDateString(),
        });
      }

      // Users row should always exist (created by handle_new_user trigger)
      // RLS only allows UPDATE, not INSERT, so use UPDATE only
      // Use .select().single() to verify the update succeeded
      const { data, error } = await supabase
        .from('users')
        .update({ dob: dobString })
        .eq('user_id', userId)
        .select('user_id')
        .single();

      if (error) {
        console.error('[DateOfBirthScreen.handleContinue] Supabase error saving DOB:', {
          userId: userId.substring(0, 8),
          dob: dobString,
          error: error.message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        });

        // If row doesn't exist (shouldn't happen if trigger works), show clear error
        if ((error as any).code === 'PGRST116') {
          const errorMsg =
            'public.users row missing; run backfill script. Please contact support if this persists.';
          console.error('[DateOfBirthScreen.handleContinue]', errorMsg, {
            userId: userId.substring(0, 8),
            errorCode: (error as any).code,
            errorDetails: (error as any).details,
            errorHint: (error as any).hint,
          });
          Alert.alert('Error', errorMsg);
          return { success: false, error: errorMsg };
        }

        const { title, message } = getErrorAlert(error, 'Failed to save date of birth');
        Alert.alert(title, message);
        return { success: false, error: error.message };
      }

      if (!data) {
        const errorMsg =
          'Update succeeded but no data returned. This may indicate a permissions issue.';
        console.error('[DateOfBirthScreen.handleContinue]', errorMsg);
        Alert.alert('Error', errorMsg);
        return { success: false, error: errorMsg };
      }

      if (__DEV__) {
        console.log(
          '[DateOfBirthScreen.handleContinue] DOB saved successfully:',
          userId.substring(0, 8)
        );
      }

      return { success: true };
    } catch (error: any) {
      console.error('[DateOfBirthScreen.handleContinue] Unexpected error:', {
        error: error.message,
        stack: error.stack,
      });
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const age = calculateAge(dob);
  const canContinue = age >= 18;

  return (
    <BaseOnboardingScreen
      stepId="date_of_birth"
      onContinue={handleContinue}
      canContinue={canContinue}
      loading={loading}
    >
      <View style={styles.content}>
        <Text style={styles.ageText}>Age: {age} years old</Text>
        {age < 18 && <Text style={styles.errorText}>You must be 18 or older</Text>}

        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={dob}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            minimumDate={new Date(1950, 0, 1)}
            onChange={(event, selectedDate) => {
              if (selectedDate) {
                setDob(selectedDate);
              }
            }}
            style={styles.picker}
          />
        ) : (
          <View>
            {showPicker && (
              <DateTimePicker
                value={dob}
                mode="date"
                display="default"
                maximumDate={new Date()}
                minimumDate={new Date(1950, 0, 1)}
                onChange={(event, selectedDate) => {
                  setShowPicker(false);
                  if (selectedDate) {
                    setDob(selectedDate);
                  }
                }}
              />
            )}
            {!showPicker && (
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
                <Text style={styles.dateButtonText}>{dob.toLocaleDateString()}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
  },
  ageText: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: BRAND_COLORS.danger,
    textAlign: 'center',
  },
  picker: {
    width: '100%',
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: BRAND_COLORS.background[50],
  },
  dateButtonText: {
    fontSize: 18,
    textAlign: 'center',
  },
});
