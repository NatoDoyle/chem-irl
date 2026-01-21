/**
 * Enter App Screen - Phase 7, Step 26
 * NON-SKIPPABLE - Final step that marks onboarding complete
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { markStepResolved } from '../../lib/onboarding/flowGuard';
import { BRAND_COLORS } from '../../config/brand';

export default function EnterAppScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleEnterApp();
  }, []);

  const handleEnterApp = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      // Mark enter_app step as resolved
      const result = await markStepResolved('enter_app', 'completed');
      if (!result.success) {
        setError(result.error?.message || 'Failed to complete onboarding');
        setLoading(false);
        return;
      }

      // Ensure profile is marked as complete
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          signup_completed: true,
          completion_pct: 100,
        })
        .eq('id', user.id);

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      // Mark all onboarding steps as resolved
      // This ensures the FlowGuard will allow app access
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.onboarding) {
        // Mark all steps as completed
        const allStepsResolved = {
          account_creation: 'completed',
          terms_acceptance: 'completed',
          email_verification: 'completed',
          phone_verification: 'completed',
          date_of_birth: 'completed',
          gender_identity: 'completed',
          interested_in: 'completed',
          location_permission: 'completed',
          profile_photos: 'completed',
          height: 'completed',
          languages: 'completed',
          relationship_intent: 'completed',
          family_plans: 'completed',
          pets: 'completed',
          substances: 'completed',
          lifestyle_habits: 'completed',
          interests: 'completed',
          ideal_first_dates: 'completed',
          love_language: 'completed',
          personality_type: 'completed',
          astrology_sign: 'completed',
          work_education: 'completed',
          bio: 'completed',
          photo_verification: 'completed',
          profile_review: 'completed',
          enter_app: 'completed',
        };

        const { error: onboardingError } = await supabase
          .from('profiles')
          .update({
            onboarding: {
              currentStepId: null,
              resolvedSteps: allStepsResolved,
            },
          })
          .eq('id', user.id);

        if (onboardingError) {
          console.error('Error updating onboarding state:', onboardingError);
          // Non-fatal, continue
        }
      }

      // Navigation will be handled by FlowGuard detecting completion
      // The app will automatically show MainNavigator
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    // This screen auto-advances, but handleContinue is required
    if (error) {
      // Retry on error
      setLoading(true);
      setError(null);
      handleEnterApp();
    }
    return { success: !error };
  };

  return (
    <BaseOnboardingScreen
      stepId="enter_app"
      onContinue={handleContinue}
      canContinue={!loading && !error}
      loading={loading}
    >
      <View style={styles.content}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
            <Text style={styles.loadingText}>Completing onboarding...</Text>
          </>
        ) : error ? (
          <>
            <Text style={styles.errorText}>Error: {error}</Text>
            <Text style={styles.errorHint}>
              The app will automatically show your profile once onboarding is complete.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.successText}>✓</Text>
            <Text style={styles.title}>Welcome to Chem IRL!</Text>
            <Text style={styles.message}>
              Your profile is complete. You'll be taken to the main app shortly.
            </Text>
          </>
        )}
      </View>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    padding: 24,
  },
  loadingText: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginTop: 16,
  },
  successText: {
    fontSize: 64,
    color: BRAND_COLORS.success,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    lineHeight: 24,
  },
  errorText: {
    fontSize: 16,
    color: BRAND_COLORS.danger,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorHint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginTop: 8,
  },
});
