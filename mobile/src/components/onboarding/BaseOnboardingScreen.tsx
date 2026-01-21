/**
 * Base Onboarding Screen - Shared layout and logic for all onboarding steps
 */

import { ReactNode } from 'react';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  BackHandler,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect, StackActions } from '@react-navigation/native';
import { OnboardingStepId, STEP_CONFIGS } from '../../lib/onboarding/constants';
import {
  markStepResolved,
  getNextUnresolvedStepId,
  loadOnboardingState,
  isOnboardingComplete,
  stepIdToScreenName,
} from '../../lib/onboarding/flowGuard';
import { BRAND_COLORS } from '../../config/brand';

interface BaseOnboardingScreenProps {
  stepId: OnboardingStepId;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  onContinue: () => Promise<void | boolean | { success: boolean; error?: string }>;
  onSkip?: () => Promise<void | boolean | { success: boolean; error?: string }>;
  canContinue: boolean;
  loading?: boolean;
  showSkip?: boolean;
}

export default function BaseOnboardingScreen({
  stepId,
  title,
  subtitle,
  children,
  onContinue,
  onSkip,
  canContinue,
  loading = false,
  showSkip = false,
}: BaseOnboardingScreenProps) {
  const navigation = useNavigation();
  const stepConfig = STEP_CONFIGS[stepId];
  const displayTitle = title || stepConfig.title;
  const displaySubtitle = subtitle || stepConfig.subtitle;

  /**
   * Normalize onContinue/onSkip return values to a consistent format
   * - void/undefined/null => {success: true}
   * - boolean => {success: boolean}
   * - {success, error} => as-is
   */
  const normalizeResult = (
    result: void | boolean | { success: boolean; error?: string } | null | undefined
  ): { success: boolean; error?: string } => {
    if (result === null || result === undefined) {
      return { success: true };
    }
    if (typeof result === 'boolean') {
      return { success: result };
    }
    return result;
  };

  // Block hardware back button on non-skippable screens (Android)
  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android' && !stepConfig.skippable) {
        const onBackPress = () => {
          // Prevent back navigation on non-skippable screens
          return true; // Return true to prevent default back behavior
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

        return () => subscription.remove();
      }
    }, [stepConfig.skippable])
  );

  const handleContinue = async () => {
    const rawResult = await onContinue();
    const normalized = normalizeResult(rawResult);
    if (__DEV__) {
      console.log('[BaseOnboardingScreen.handleContinue] onContinue raw result:', rawResult);
      console.log('[BaseOnboardingScreen.handleContinue] onContinue normalized result:', {
        success: normalized.success,
        error: normalized.error,
      });
    }
    if (!normalized.success) {
      const errorMsg = normalized.error || 'Operation failed';
      console.error('[BaseOnboardingScreen.handleContinue] onContinue failed:', errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }
    const markResult = await markStepResolved(stepId, 'completed');
    if (__DEV__) {
      console.log('[BaseOnboardingScreen.handleContinue] markStepResolved result:', {
        success: markResult.success,
        error: markResult.error?.message,
      });
    }
    if (!markResult.success && markResult.error) {
      console.error('[BaseOnboardingScreen] Failed to mark step resolved:', markResult.error);
      Alert.alert('Error', `Failed to save progress: ${markResult.error.message}`);
      return;
    }

    // After marking step resolved, check onboarding state and navigate to next step
    await navigateToNextStep();
  };

  const handleSkip = async () => {
    if (!onSkip) return;
    const rawResult = await onSkip();
    const normalized = normalizeResult(rawResult);
    if (__DEV__) {
      console.log('[BaseOnboardingScreen.handleSkip] onSkip raw result:', rawResult);
      console.log('[BaseOnboardingScreen.handleSkip] onSkip normalized result:', {
        success: normalized.success,
        error: normalized.error,
      });
    }
    if (!normalized.success) {
      const errorMsg = normalized.error || 'Operation failed';
      console.error('[BaseOnboardingScreen.handleSkip] onSkip failed:', errorMsg);
      Alert.alert('Error', errorMsg);
      return;
    }
    const markResult = await markStepResolved(stepId, 'skipped');
    if (__DEV__) {
      console.log('[BaseOnboardingScreen.handleSkip] markStepResolved result:', {
        success: markResult.success,
        error: markResult.error?.message,
      });
    }
    if (!markResult.success && markResult.error) {
      console.error('[BaseOnboardingScreen] Failed to mark step resolved:', markResult.error);
      Alert.alert('Error', `Failed to save progress: ${markResult.error.message}`);
      return;
    }

    // After marking step resolved, check onboarding state and navigate to next step
    await navigateToNextStep();
  };

  const navigateToNextStep = async () => {
    try {
      const { profile, onboardingState, error: loadError } = await loadOnboardingState();

      if (loadError || !profile) {
        console.error('[BaseOnboardingScreen] Failed to load onboarding state:', {
          loadError: loadError?.message,
          hasProfile: !!profile,
        });
        return;
      }

      // Check if onboarding is complete
      const isComplete = isOnboardingComplete(profile, onboardingState || undefined);
      if (isComplete) {
        if (__DEV__) {
          console.log('[BaseOnboardingScreen.navigateToNextStep] Onboarding complete');
        }
        // Navigation to main app will be handled by FlowGuard/App.tsx
        return;
      }

      const unresolvedStep = getNextUnresolvedStepId(profile, onboardingState || undefined);
      if (__DEV__) {
        console.log(
          '[BaseOnboardingScreen.navigateToNextStep] Next unresolved stepId:',
          unresolvedStep
        );
      }
      if (!unresolvedStep) {
        if (__DEV__) {
          console.log('[BaseOnboardingScreen.navigateToNextStep] No unresolved step found');
        }
        return;
      }

      const screenName = stepIdToScreenName(unresolvedStep);
      if (__DEV__) {
        console.log('[BaseOnboardingScreen.navigateToNextStep] Resolved screenName:', screenName);
      }
      if (!screenName) {
        const errorMsg = `No screen for stepId: ${unresolvedStep}`;
        console.error('[BaseOnboardingScreen]', errorMsg);
        if (__DEV__) {
          Alert.alert('Navigation Error', errorMsg);
        }
        return;
      }

      // Navigate forward within the onboarding stack using replace
      if (__DEV__) {
        console.log(
          '[BaseOnboardingScreen.navigateToNextStep] Dispatching StackActions.replace:',
          screenName
        );
      }
      navigation.dispatch(StackActions.replace(screenName as never));
    } catch (err) {
      console.error('[BaseOnboardingScreen] Error navigating to next step:', err);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{displayTitle}</Text>
        {displaySubtitle && <Text style={styles.subtitle}>{displaySubtitle}</Text>}
        <Text style={styles.phaseText}>
          Phase {stepConfig.phase}: {stepConfig.phaseName}
        </Text>
      </View>

      <View style={styles.body}>{children}</View>

      <View style={styles.footer}>
        {showSkip && stepConfig.skippable && onSkip && (
          <TouchableOpacity
            style={[styles.skipButton, loading && styles.buttonDisabled]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.continueButton, (!canContinue || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!canContinue || loading}
        >
          {loading ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
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
  header: {
    marginBottom: 32,
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
    marginBottom: 8,
  },
  phaseText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
  },
  body: {
    flex: 1,
    marginBottom: 32,
  },
  footer: {
    gap: 12,
  },
  continueButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  continueButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: BRAND_COLORS.text[600],
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
