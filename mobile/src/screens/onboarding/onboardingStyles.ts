import { StyleSheet } from 'react-native';
import {
  BRAND_COLORS,
  GOLDEN_HOUR,
  MIDNIGHT,
  REFINED_WARMTH,
  TYPOGRAPHY,
  SPACING,
} from '../../config/brand';

export const onboardingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['4xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: SPACING.xl,
  },
  form: {
    gap: SPACING.md,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    borderRadius: 14,
    padding: 20,
    backgroundColor: MIDNIGHT.glassCard.backgroundColor,
  },
  optionButtonSelected: {
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
    backgroundColor: 'rgba(10, 127, 116, 0.15)',
    ...MIDNIGHT.glow.selected,
  },
  optionText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[900],
  },
  optionTextSelected: {
    color: BRAND_COLORS.primary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.base,
    borderRadius: REFINED_WARMTH.radius.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...MIDNIGHT.glow.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: MIDNIGHT.borderDefault,
    paddingVertical: SPACING.base,
    borderRadius: REFINED_WARMTH.radius.lg,
    alignItems: 'center',
  },
  skipButtonText: {
    color: BRAND_COLORS.text[600],
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
