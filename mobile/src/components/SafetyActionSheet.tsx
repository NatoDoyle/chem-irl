import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../config/brand';
import { REPORT_CATEGORIES, type ReportCategory } from '../lib/types';
import { blockUser, submitReport } from '../lib/safety';
import AnimatedPressable from './ui/AnimatedPressable';
import GHButton from './ui/GHButton';

interface SafetyActionSheetProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetName?: string;
  onBlocked?: () => void;
}

const DESCRIPTION_MAX = 500;

type SheetView = 'actions' | 'report';

export default function SafetyActionSheet({
  visible,
  onClose,
  targetUserId,
  targetName,
  onBlocked,
}: SafetyActionSheetProps) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<SheetView>('actions');
  const [blocking, setBlocking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null);
  const [description, setDescription] = useState('');

  const displayName = targetName || 'this person';

  // Reset the sheet to its initial state each time it opens so a previous
  // report draft doesn't leak into the next session.
  useEffect(() => {
    if (visible) {
      setView('actions');
      setSelectedCategory(null);
      setDescription('');
      setBlocking(false);
      setSubmitting(false);
    }
  }, [visible]);

  const handleBlockPress = () => {
    Alert.alert(
      `Block ${displayName}?`,
      "They won't be able to see you or contact you, and any match will be removed.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            setBlocking(true);
            const result = await blockUser(targetUserId);
            setBlocking(false);
            if (result.success) {
              onBlocked?.();
              onClose();
            } else {
              Alert.alert('Could not block', result.error || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSubmitReport = async () => {
    if (!selectedCategory || submitting) return;
    setSubmitting(true);
    const result = await submitReport(targetUserId, selectedCategory, description);
    setSubmitting(false);
    if (result.success) {
      onClose();
      Alert.alert('Report submitted', 'Thanks — our team will review it.');
    } else {
      Alert.alert('Could not submit report', result.error || 'Please try again.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close safety options"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.handle} />

          {view === 'actions' ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>Safety</Text>
              </View>

              <View style={styles.actionList}>
                <AnimatedPressable
                  onPress={() => setView('report')}
                  style={styles.actionRow}
                  haptic={false}
                  accessibilityLabel={`Report ${displayName}`}
                >
                  <Ionicons name="flag-outline" size={22} color={BRAND_COLORS.text[900]} />
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionLabel}>Report</Text>
                    <Text style={styles.actionHint}>Flag this person for our team to review</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={BRAND_COLORS.text[600]} />
                </AnimatedPressable>

                <AnimatedPressable
                  onPress={handleBlockPress}
                  disabled={blocking}
                  style={[styles.actionRow, styles.actionRowDanger]}
                  haptic={false}
                  accessibilityLabel={`Block ${displayName}`}
                >
                  <Ionicons name="ban-outline" size={22} color={BRAND_COLORS.danger} />
                  <View style={styles.actionTextWrap}>
                    <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Block</Text>
                    <Text style={styles.actionHint}>Remove the match and hide each other</Text>
                  </View>
                  {blocking ? (
                    <ActivityIndicator color={BRAND_COLORS.danger} />
                  ) : (
                    <Ionicons name="chevron-forward" size={20} color={BRAND_COLORS.text[600]} />
                  )}
                </AnimatedPressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <AnimatedPressable
                  onPress={() => setView('actions')}
                  haptic={false}
                  accessibilityLabel="Back to safety options"
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={22} color={BRAND_COLORS.primary} />
                </AnimatedPressable>
                <Text style={styles.title}>Report</Text>
                <View style={styles.headerSpacer} />
              </View>

              <ScrollView
                style={styles.body}
                contentContainerStyle={styles.bodyContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={styles.sectionLabel}>What&apos;s going on?</Text>
                <View style={styles.categoryList}>
                  {REPORT_CATEGORIES.map((cat) => {
                    const selected = selectedCategory === cat.value;
                    return (
                      <AnimatedPressable
                        key={cat.value}
                        onPress={() => setSelectedCategory(cat.value)}
                        style={[styles.categoryRow, selected && styles.categoryRowSelected]}
                        haptic={false}
                        accessibilityRole="button"
                        accessibilityLabel={cat.label}
                      >
                        <Text
                          style={[styles.categoryText, selected && styles.categoryTextSelected]}
                        >
                          {cat.label}
                        </Text>
                        {selected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20}
                            color={BRAND_COLORS.primary}
                          />
                        )}
                      </AnimatedPressable>
                    );
                  })}
                </View>

                <Text style={[styles.sectionLabel, styles.noteLabel]}>
                  Add a note <Text style={styles.optional}>(optional)</Text>
                </Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Anything else our team should know?"
                  placeholderTextColor={BRAND_COLORS.text[600]}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  maxLength={DESCRIPTION_MAX}
                  editable={!submitting}
                />
                <Text style={styles.charCount}>
                  {description.length}/{DESCRIPTION_MAX}
                </Text>
              </ScrollView>

              <View style={styles.footer}>
                <GHButton
                  title="Submit report"
                  onPress={handleSubmitReport}
                  loading={submitting}
                  disabled={!selectedCategory}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: MIDNIGHT.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: MIDNIGHT.borderDefault,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.base,
  },
  headerSpacer: {
    width: 22,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  actionList: {
    gap: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: 'rgba(17,19,24,0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: MIDNIGHT.radius.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.base,
  },
  actionRowDanger: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
  },
  actionLabelDanger: {
    color: BRAND_COLORS.danger,
  },
  actionHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: SPACING.base,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.sm,
  },
  noteLabel: {
    marginTop: SPACING.lg,
  },
  optional: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
  },
  categoryList: {
    gap: SPACING.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(17,19,24,0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: MIDNIGHT.radius.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
  },
  categoryRowSelected: {
    backgroundColor: 'rgba(10, 127, 116, 0.18)',
    borderColor: BRAND_COLORS.primary,
  },
  categoryText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[700],
    flexShrink: 1,
  },
  categoryTextSelected: {
    color: BRAND_COLORS.primaryLight,
  },
  noteInput: {
    backgroundColor: MIDNIGHT.inputBg,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    borderRadius: MIDNIGHT.radius.md,
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[900],
  },
  charCount: {
    alignSelf: 'flex-end',
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[500],
  },
  footer: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
});
