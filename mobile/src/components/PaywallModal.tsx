import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../config/brand';
import {
  IRIS_NAME,
  PAYWALL_HEADLINE,
  PAYWALL_BODY,
  PAYWALL_TRIAL_CTA,
  PAYWALL_SUB_CTA,
  PAYWALL_DISMISS_CTA,
} from '../lib/iris/persona';
import { startTrial } from '../lib/subscription';
import { IAPUnavailableInExpoGoError, purchaseChemPlus } from '../lib/iap';
import { trackEvent } from '../lib/analytics';

export interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called when the user successfully starts a trial. The caller can then
   *  open the IrisChatModal directly without re-checking entitlement. */
  onTrialStarted?: () => void;
  /** Called after the IAP request returns successfully. Note that the actual
   *  subscription state lands when validate-subscription's webhook completes
   *  via the existing purchase listener — this callback fires earlier. */
  onSubscriptionRequested?: () => void;
  /** Where in the app this paywall was opened from. Tagged on every
   *  iris_paywall_* analytics event so funnel reports can attribute trial
   *  starts and subscriptions back to entry points (signup_pitch, profile,
   *  discover, match_header, …). */
  surface?: string;
}

type Pending = 'trial' | 'subscribe' | null;

export default function PaywallModal(props: PaywallModalProps) {
  const { visible, onClose, onTrialStarted, onSubscriptionRequested, surface = 'unknown' } = props;
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  // True when the user converted (trial or subscribe) inside this open
  // session. Used to suppress iris_paywall_dismissed when the modal closes
  // because the user actually took action.
  const convertedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      convertedRef.current = false;
      trackEvent('iris_paywall_shown', { surface });
    }
  }, [visible, surface]);

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
      trackEvent('iris_trial_started', { surface });
      onTrialStarted?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start trial.');
    } finally {
      setPending(null);
    }
  }, [pending, onTrialStarted, onClose, surface]);

  const handleSubscribe = useCallback(async () => {
    if (pending) return;
    setError(null);
    setPending('subscribe');
    try {
      await purchaseChemPlus();
      convertedRef.current = true;
      trackEvent('iris_subscription_purchased', { surface });
      onSubscriptionRequested?.();
      // The purchase listener (set up at app root) handles the receipt
      // validation + entitlement update on success. We close optimistically;
      // the parent screen should re-check entitlement when the user returns.
      onClose();
    } catch (err) {
      if (err instanceof IAPUnavailableInExpoGoError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Purchase did not start.');
      }
    } finally {
      setPending(null);
    }
  }, [pending, onSubscriptionRequested, onClose, surface]);

  const handleDismiss = useCallback(() => {
    if (!convertedRef.current) {
      trackEvent('iris_paywall_dismissed', { surface });
    }
    onClose();
  }, [onClose, surface]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.heroRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>I</Text>
            </View>
            <Text style={styles.heroLabel}>Meet {IRIS_NAME}</Text>
          </View>

          <Text style={styles.title}>{PAYWALL_HEADLINE}</Text>
          <Text style={styles.body}>{PAYWALL_BODY}</Text>

          <View style={styles.actions}>
            <Pressable
              style={[styles.primary, pending === 'trial' && styles.primaryActive]}
              onPress={handleStartTrial}
              disabled={pending !== null}
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
            hitSlop={12}
            style={styles.dismissRow}
          >
            <Text style={styles.dismissText}>{PAYWALL_DISMISS_CTA}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.base,
  },
  modal: {
    backgroundColor: MIDNIGHT.bg,
    borderRadius: MIDNIGHT.radius.lg,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
  },
  heroLabel: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  title: {
    color: BRAND_COLORS.text[900],
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    lineHeight: TYPOGRAPHY.fontSize['2xl'] * TYPOGRAPHY.lineHeight.tight,
  },
  body: {
    color: BRAND_COLORS.text[700],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
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
    paddingVertical: SPACING.sm,
  },
  dismissText: {
    color: BRAND_COLORS.text[500],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
