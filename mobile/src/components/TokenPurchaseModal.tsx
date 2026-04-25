import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BRAND_COLORS, GOLD, MIDNIGHT, TYPOGRAPHY, SPACING } from '../config/brand';
import { getTokenBalance } from '../lib/tokens';
import { purchaseTokens, TOKEN_PRODUCTS, type TokenProductId } from '../lib/iap';

// --- Types ---

interface TokenPurchaseModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseComplete: () => void;
}

interface TokenPack {
  id: TokenProductId;
  tokens: number;
  price: string; // Placeholder until store products load
  label: string;
}

// --- Token pack options ---

const TOKEN_PACKS: TokenPack[] = [
  { id: TOKEN_PRODUCTS.small, tokens: 3, price: '$2.99', label: '3 Tokens' },
  { id: TOKEN_PRODUCTS.medium, tokens: 10, price: '$7.99', label: '10 Tokens' },
  { id: TOKEN_PRODUCTS.large, tokens: 25, price: '$14.99', label: '25 Tokens' },
];

// --- Component ---

export default function TokenPurchaseModal({
  visible,
  onClose,
  onPurchaseComplete,
}: TokenPurchaseModalProps) {
  const [balance, setBalance] = useState<number>(0);
  const [purchasing, setPurchasing] = useState<TokenProductId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch balance when modal opens
  useEffect(() => {
    if (visible) {
      setError(null);
      setSuccess(false);
      setPurchasing(null);
      getTokenBalance().then(setBalance);
    }
  }, [visible]);

  const handlePurchase = useCallback(
    async (pack: TokenPack) => {
      if (purchasing) return;
      setError(null);
      setSuccess(false);
      setPurchasing(pack.id);

      try {
        await purchaseTokens(pack.id);
        // The purchase listener (set up via setupPurchaseListener in the app root)
        // handles receipt validation. We optimistically show success here;
        // the listener will credit tokens server-side.
        const newBalance = await getTokenBalance();
        setBalance(newBalance);
        setSuccess(true);
        onPurchaseComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Purchase failed. Please try again.');
      } finally {
        setPurchasing(null);
      }
    },
    [purchasing, onPurchaseComplete]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <Text style={styles.title}>Get Tokens</Text>
          <Text style={styles.subtitle}>
            Use tokens to reactivate expired matches and get another chance.
          </Text>

          {/* Current balance */}
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Your balance</Text>
            <Text style={styles.balanceValue}>{balance}</Text>
          </View>

          {/* Token packs */}
          <View style={styles.packsContainer}>
            {TOKEN_PACKS.map((pack) => {
              const isActive = purchasing === pack.id;
              return (
                <TouchableOpacity
                  key={pack.id}
                  style={[styles.packCard, isActive && styles.packCardActive]}
                  onPress={() => handlePurchase(pack)}
                  disabled={purchasing !== null}
                  activeOpacity={0.7}
                >
                  <Text style={styles.packTokens}>{pack.tokens}</Text>
                  <Text style={styles.packLabel}>tokens</Text>
                  <View style={styles.packPriceRow}>
                    {isActive ? (
                      <ActivityIndicator size="small" color={GOLD[600]} />
                    ) : (
                      <Text style={styles.packPrice}>{pack.price}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Feedback */}
          {error && <Text style={styles.errorText}>{error}</Text>}
          {success && <Text style={styles.successText}>Tokens added!</Text>}

          {/* Close */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose} disabled={!!purchasing}>
            <Text style={styles.closeButtonText}>{success ? 'Done' : 'Not now'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modal: {
    ...MIDNIGHT.glassCard,
    backgroundColor: MIDNIGHT.surface,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...MIDNIGHT.shadow.warmLg,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
    borderRadius: MIDNIGHT.radius.md,
    backgroundColor: 'rgba(202, 138, 4, 0.08)',
    marginBottom: SPACING.lg,
  },
  balanceLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[700],
  },
  balanceValue: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize.xl,
    color: GOLD[600],
  },
  packsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    width: '100%',
  },
  packCard: {
    flex: 1,
    ...MIDNIGHT.glassCardSm,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packCardActive: {
    borderColor: GOLD[600],
  },
  packTokens: {
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    color: GOLD[600],
  },
  packLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.text[600],
    marginBottom: SPACING.sm,
  },
  packPriceRow: {
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  packPrice: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: BRAND_COLORS.text[900],
  },
  errorText: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.danger,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  successText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.success,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  closeButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  closeButtonText: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.base,
    color: BRAND_COLORS.text[600],
  },
});
