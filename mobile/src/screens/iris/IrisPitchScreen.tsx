// Post-signup pitch for Iris (the AI concierge bundled with Chem Plus).
//
// Renders as the first screen of OnboardingNavigator immediately after
// signup_completed flips to true (i.e. after the email OTP is verified
// in EmailCodeVerifyScreen). Off-track — not in SCREEN_ORDER, so the
// step counter on subsequent question screens still reads "1 of 18".
//
// Whichever of the three actions the user takes (start trial, subscribe,
// dismiss), we record the pitch as seen via markPitchSeen() and replace
// the current route with AgeDob so the back button doesn't bring
// the user back to the pitch.
//
// Skipped entirely (resolved upstream in OnboardingNavigator) when the
// user already has an active entitlement, or when this device has
// already recorded a pitch-seen flag for this user.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../../config/brand';
import {
  IRIS_NAME,
  PAYWALL_HEADLINE,
  PAYWALL_BODY,
  PAYWALL_TRIAL_CTA,
  PAYWALL_SUB_CTA,
  PAYWALL_DISMISS_CTA,
} from '../../lib/iris/persona';
import { startTrial } from '../../lib/subscription';
import { IAPUnavailableInExpoGoError, purchaseChemPlus } from '../../lib/iap';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase/client';
import { markPitchSeen } from '../../lib/iris/pitchSeen';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

const SURFACE = 'signup_pitch';

type IrisPitchNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'IrisPitch'>;

type Pending = 'trial' | 'subscribe' | null;

export default function IrisPitchScreen() {
  const navigation = useNavigation<IrisPitchNavigationProp>();
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  // True when the user took action (trial or subscribe) — used to
  // suppress the dismiss event on the conversion path so the funnel
  // doesn't double-count.
  const convertedRef = useRef(false);

  useEffect(() => {
    trackEvent('iris_paywall_shown', { surface: SURFACE });
  }, []);

  const goToFirstQuestion = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await markPitchSeen(user.id);
      }
    } finally {
      navigation.replace('AgeDob');
    }
  }, [navigation]);

  const handleStartTrial = useCallback(async () => {
    if (pending) return;
    setError(null);
    setPending('trial');
    try {
      const result = await startTrial();
      if (!result.success) {
        setError('Could not start trial. Try again or subscribe directly.');
        return;
      }
      convertedRef.current = true;
      trackEvent('iris_trial_started', { surface: SURFACE });
      await goToFirstQuestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start trial.');
    } finally {
      setPending(null);
    }
  }, [pending, goToFirstQuestion]);

  const handleSubscribe = useCallback(async () => {
    if (pending) return;
    setError(null);
    setPending('subscribe');
    try {
      await purchaseChemPlus();
      convertedRef.current = true;
      trackEvent('iris_subscription_purchased', { surface: SURFACE });
      // The IAP receipt is validated by the existing purchase listener
      // set up at app root. We optimistically advance to onboarding;
      // entitlement will reflect the subscription on the next read.
      await goToFirstQuestion();
    } catch (err) {
      if (err instanceof IAPUnavailableInExpoGoError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Purchase did not start.');
      }
    } finally {
      setPending(null);
    }
  }, [pending, goToFirstQuestion]);

  const handleDismiss = useCallback(async () => {
    if (pending) return;
    if (!convertedRef.current) {
      trackEvent('iris_paywall_dismissed', { surface: SURFACE });
    }
    await goToFirstQuestion();
  }, [pending, goToFirstQuestion]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroBlock}>
        <View style={[styles.avatar, MIDNIGHT.glow.primary]}>
          <Text style={styles.avatarLetter}>I</Text>
        </View>
        <Text style={styles.eyebrow}>Meet {IRIS_NAME}</Text>
      </View>

      <Text style={styles.title}>{PAYWALL_HEADLINE}</Text>
      <Text style={styles.body}>{PAYWALL_BODY}</Text>

      <View style={styles.actions}>
        <Pressable
          style={[styles.primary, pending === 'trial' && styles.primaryActive]}
          onPress={handleStartTrial}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel={PAYWALL_TRIAL_CTA}
        >
          {pending === 'trial' ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.primaryText}>{PAYWALL_TRIAL_CTA}</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.secondary}
          onPress={handleSubscribe}
          disabled={pending !== null}
          accessibilityRole="button"
          accessibilityLabel={PAYWALL_SUB_CTA}
        >
          {pending === 'subscribe' ? (
            <ActivityIndicator color={BRAND_COLORS.aqua[300]} />
          ) : (
            <Text style={styles.secondaryText}>{PAYWALL_SUB_CTA}</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        onPress={handleDismiss}
        disabled={pending !== null}
        style={styles.dismissRow}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={PAYWALL_DISMISS_CTA}
      >
        <Text style={styles.dismissText}>{PAYWALL_DISMISS_CTA}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING['3xl'],
    gap: SPACING.md,
  },
  heroBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
  },
  eyebrow: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  title: {
    color: BRAND_COLORS.text[900],
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    lineHeight: TYPOGRAPHY.fontSize['3xl'] * TYPOGRAPHY.lineHeight.tight,
  },
  body: {
    color: BRAND_COLORS.text[700],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
    marginBottom: SPACING.md,
  },
  actions: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  primary: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: MIDNIGHT.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryActive: {
    backgroundColor: BRAND_COLORS.primaryPressed,
  },
  primaryText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  secondary: {
    backgroundColor: 'transparent',
    paddingVertical: SPACING.md,
    borderRadius: MIDNIGHT.radius.md,
    borderWidth: 1,
    borderColor: BRAND_COLORS.aqua[600],
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  secondaryText: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  error: {
    color: BRAND_COLORS.danger,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  dismissRow: {
    alignSelf: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  dismissText: {
    color: BRAND_COLORS.text[500],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
