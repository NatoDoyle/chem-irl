import { StyleSheet } from 'react-native';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../../config/brand';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: MIDNIGHT.bg,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Header
  header: {
    backgroundColor: MIDNIGHT.bg,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
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

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },

  // Chem Plus upgrade card (between hero and About)
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
    borderRadius: MIDNIGHT.radius.lg,
    backgroundColor: 'rgba(10, 127, 116, 0.10)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.aqua[700],
    marginBottom: SPACING.xl,
  },
  upgradeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBody: {
    flex: 1,
  },
  upgradeTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[900],
  },
  upgradeSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  avatarRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 3,
    borderColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: MIDNIGHT.surface,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MIDNIGHT.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    color: BRAND_COLORS.text[900],
    textAlign: 'center',
    marginTop: 16,
  },
  heroTagline: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Glass Card
  glassCard: {
    ...MIDNIGHT.glassCard,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: BRAND_COLORS.text[900],
  },
  cardBody: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[600],
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
  viewAllText: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Photo Grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoGridItem: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1f2e',
  },
  photoGridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  addPhotoSlot: {
    borderRadius: 16,
    backgroundColor: '#1a1f2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
  },

  // Photo Overlays
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deletingText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    marginTop: SPACING.xs,
  },
  successOverlay: {
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
  },
  errorOverlay: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    flexDirection: 'column',
    gap: 8,
  },
  checkmark: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  errorIcon: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: MIDNIGHT.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: MIDNIGHT.radius.sm,
  },
  retryText: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  removePhotoText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },

  // Details Card
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[500],
  },
  detailValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[900],
  },
  detailValuePrimary: {
    color: BRAND_COLORS.primaryLight,
  },

  // Availability Chips
  availabilityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availChip: {
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availChipActive: {
    backgroundColor: 'rgba(10,127,116,0.2)',
    borderColor: 'rgba(10,127,116,0.3)',
  },
  availChipDay: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: BRAND_COLORS.text[600],
    textTransform: 'uppercase',
  },
  availChipDayActive: {
    color: BRAND_COLORS.primary,
  },
  availChipTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
  },
  availChipTimeActive: {
    color: BRAND_COLORS.primary,
  },
  availabilityHint: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontStyle: 'italic',
    color: BRAND_COLORS.text[500],
    marginTop: 16,
  },

  // Accordion Section Headers (inside glass cards)
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sectionHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  sectionSummary: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  sectionChevron: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.primary,
  },

  // Edit Section
  editSection: {
    gap: 12,
  },

  // Slots (availability edit mode)
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...MIDNIGHT.glassCardSm,
    padding: 12,
  },
  slotText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[900],
    flex: 1,
  },

  // Fields
  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[700],
  },
  fieldHint: {
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[500],
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    borderRadius: MIDNIGHT.radius.lg,
    padding: 14,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    backgroundColor: MIDNIGHT.inputBg,
    color: BRAND_COLORS.text[900],
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  clearLink: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.danger,
    marginTop: SPACING.xs,
  },

  // Chips / pickers
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: MIDNIGHT.radius.full,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    backgroundColor: MIDNIGHT.glassCard.backgroundColor,
  },
  chipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primary,
    ...MIDNIGHT.glow.selected,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[700],
  },
  chipTextSelected: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.onPrimary,
  },

  // Buttons
  saveButton: {
    marginTop: SPACING.lg,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.base,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
});
