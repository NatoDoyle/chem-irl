import { StyleSheet } from 'react-native';
import { BRAND_COLORS, MIDNIGHT, SPACING, TYPOGRAPHY } from '../../config/brand';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },

  // Header (mirrors ProfileScreen header)
  header: {
    backgroundColor: MIDNIGHT.bg,
    borderBottomWidth: 1,
    borderBottomColor: MIDNIGHT.borderDefault,
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    textAlign: 'center',
    flex: 1,
  },

  // Body
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },

  // Section header
  sectionHeader: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  sectionHeaderText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[500],
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Section card (grouped rows)
  section: {
    backgroundColor: MIDNIGHT.surface,
    borderRadius: MIDNIGHT.radius.md,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    overflow: 'hidden',
  },

  // Row
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  rowLabel: {
    flex: 1,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[900],
  },
  rowLabelDestructive: {
    color: BRAND_COLORS.danger,
  },
  rowValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    maxWidth: '60%',
  },

  // Separator between rows in a section
  separator: {
    height: 1,
    backgroundColor: MIDNIGHT.borderDefault,
    marginLeft: SPACING.base,
  },

  // Delete confirmation modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.base,
  },
  modalCard: {
    backgroundColor: MIDNIGHT.bg,
    borderRadius: MIDNIGHT.radius.lg,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  modalBody: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[700],
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  modalInput: {
    backgroundColor: MIDNIGHT.inputBg,
    borderRadius: MIDNIGHT.radius.md,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[900],
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: MIDNIGHT.radius.md,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalCancelText: {
    color: BRAND_COLORS.text[700],
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  modalDeleteButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: MIDNIGHT.radius.md,
    backgroundColor: BRAND_COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalDeleteButtonDisabled: {
    opacity: 0.5,
  },
  modalDeleteText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});

export default styles;
