import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../config/brand';
import { IRIS_NAME } from '../lib/iris/persona';
import { getEntitlement } from '../lib/subscription';
import type {
  IrisSurface,
  ProposeBioDraftInput,
  ProposeReplyDraftInput,
  ProposeTimeWindowInput,
} from '../lib/iris/types';
import IrisChatModal from './IrisChatModal';
import PaywallModal from './PaywallModal';

export interface IrisLaunchButtonProps {
  surface: IrisSurface;
  matchId?: string;
  /** Override the default "Ask Iris" label. */
  label?: string;
  /** Optional initial assistant turn shown before the user types. */
  initialGreeting?: string;
  /** True for surfaces (interview) where leaving the modal should run the
   *  extraction pass. */
  finalizeOnClose?: boolean;
  /** Tool-result handlers — passed straight through to IrisChatModal. */
  onBioDraft?: (input: ProposeBioDraftInput) => void;
  onTimeWindow?: (input: ProposeTimeWindowInput) => void;
  onReplyDraft?: (input: ProposeReplyDraftInput) => void;
  /** Render variant. Default 'inline' renders a small chip; 'block' renders
   *  a full-width pill suitable for the bottom of a profile section. */
  variant?: 'inline' | 'block';
}

export default function IrisLaunchButton(props: IrisLaunchButtonProps): JSX.Element {
  const {
    surface,
    matchId,
    label,
    initialGreeting,
    finalizeOnClose,
    onBioDraft,
    onTimeWindow,
    onReplyDraft,
    variant = 'inline',
  } = props;

  const [paywallVisible, setPaywallVisible] = useState(false);
  const [chatVisible, setChatVisible] = useState(false);
  const [resolving, setResolving] = useState(false);

  const handlePress = useCallback(async () => {
    if (resolving) return;
    setResolving(true);
    try {
      const entitlement = await getEntitlement();
      if (entitlement.allowed) {
        setChatVisible(true);
      } else {
        setPaywallVisible(true);
      }
    } finally {
      setResolving(false);
    }
  }, [resolving]);

  return (
    <View>
      <Pressable
        onPress={handlePress}
        disabled={resolving}
        accessibilityRole="button"
        accessibilityLabel={label ?? `Ask ${IRIS_NAME}`}
        style={({ pressed }) => [
          variant === 'block' ? styles.block : styles.inline,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.dot} />
        {resolving ? (
          <ActivityIndicator size="small" color={BRAND_COLORS.aqua[300]} />
        ) : (
          <Text style={variant === 'block' ? styles.blockText : styles.inlineText}>
            {label ?? `Ask ${IRIS_NAME}`}
          </Text>
        )}
      </Pressable>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        onTrialStarted={() => {
          setPaywallVisible(false);
          setChatVisible(true);
        }}
      />
      <IrisChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        surface={surface}
        matchId={matchId}
        initialGreeting={initialGreeting}
        finalizeOnClose={finalizeOnClose}
        onBioDraft={onBioDraft}
        onTimeWindow={onTimeWindow}
        onReplyDraft={onReplyDraft}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BRAND_COLORS.aqua[600],
    borderRadius: MIDNIGHT.radius.full,
    alignSelf: 'flex-start',
  },
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BRAND_COLORS.aqua[600],
    borderRadius: MIDNIGHT.radius.md,
  },
  pressed: {
    backgroundColor: BRAND_COLORS.primarySoft,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.aqua[400],
  },
  inlineText: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  blockText: {
    color: BRAND_COLORS.aqua[300],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
