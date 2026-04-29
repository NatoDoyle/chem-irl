import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DiscoveryFilters,
  DEFAULT_FILTERS,
  AGE_BOUNDS,
  DISTANCE_BOUNDS,
} from '../lib/discoveryFilters';
import { GENDER_OPTIONS, INTENT_OPTIONS } from '../config/profileOptions';
import type { UserGender } from '../lib/types';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../config/brand';
import AnimatedPressable from './ui/AnimatedPressable';
import GHButton from './ui/GHButton';

interface DiscoveryFilterSheetProps {
  visible: boolean;
  initialFilters: DiscoveryFilters;
  onClose: () => void;
  onApply: (filters: DiscoveryFilters) => Promise<void> | void;
}

const AGE_STEP = 1;
const DISTANCE_STEP = 5;

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export default function DiscoveryFilterSheet({
  visible,
  initialFilters,
  onClose,
  onApply,
}: DiscoveryFilterSheetProps) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<DiscoveryFilters>(initialFilters);
  const [applying, setApplying] = useState(false);

  // Re-hydrate the draft each time the sheet opens so cancelling discards
  // unapplied edits.
  useEffect(() => {
    if (visible) {
      setDraft(initialFilters);
    }
  }, [visible, initialFilters]);

  const ageMin = draft.age_min ?? AGE_BOUNDS.min;
  const ageMax = draft.age_max ?? AGE_BOUNDS.max;
  const distance = draft.max_distance_km ?? null;
  const selectedGenders = useMemo(() => new Set(draft.genders ?? []), [draft.genders]);
  const selectedIntents = useMemo(
    () => new Set(draft.relationship_intents ?? []),
    [draft.relationship_intents]
  );

  const setAgeMin = (next: number) =>
    setDraft((d) => ({ ...d, age_min: clamp(next, AGE_BOUNDS.min, ageMax) }));
  const setAgeMax = (next: number) =>
    setDraft((d) => ({ ...d, age_max: clamp(next, ageMin, AGE_BOUNDS.max) }));
  const setDistance = (next: number | null) =>
    setDraft((d) => ({
      ...d,
      max_distance_km:
        next === null ? undefined : clamp(next, DISTANCE_BOUNDS.min, DISTANCE_BOUNDS.max),
    }));

  const toggleGender = (g: UserGender) => {
    setDraft((d) => {
      const next = new Set(d.genders ?? []);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return { ...d, genders: Array.from(next) };
    });
  };

  const toggleIntent = (intent: string) => {
    setDraft((d) => {
      const next = new Set(d.relationship_intents ?? []);
      if (next.has(intent)) next.delete(intent);
      else next.add(intent);
      return { ...d, relationship_intents: Array.from(next) };
    });
  };

  const handleReset = () => setDraft({ ...DEFAULT_FILTERS });

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply(draft);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Filters</Text>
            <AnimatedPressable
              onPress={handleReset}
              haptic={false}
              accessibilityLabel="Reset filters"
            >
              <Text style={styles.resetText}>Reset</Text>
            </AnimatedPressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Age range */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Age range</Text>
              <View style={styles.stepperRow}>
                <Stepper
                  label="Min"
                  value={ageMin}
                  onChange={setAgeMin}
                  step={AGE_STEP}
                  min={AGE_BOUNDS.min}
                  max={ageMax}
                />
                <Stepper
                  label="Max"
                  value={ageMax}
                  onChange={setAgeMax}
                  step={AGE_STEP}
                  min={ageMin}
                  max={AGE_BOUNDS.max}
                />
              </View>
            </View>

            {/* Gender */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Show me</Text>
              <Text style={styles.sectionHint}>Leave all off for no preference</Text>
              <View style={styles.chipRow}>
                {GENDER_OPTIONS.map((opt) => {
                  const selected = selectedGenders.has(opt.value);
                  return (
                    <AnimatedPressable
                      key={opt.value}
                      onPress={() => toggleGender(opt.value)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${opt.label}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>

            {/* Distance */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Max distance</Text>
              {distance === null ? (
                <View style={styles.distanceRow}>
                  <Text style={styles.distanceLabel}>No limit</Text>
                  <AnimatedPressable
                    onPress={() => setDistance(25)}
                    style={[styles.chip, styles.chipSelected]}
                    haptic={false}
                  >
                    <Text style={[styles.chipText, styles.chipTextSelected]}>Set distance</Text>
                  </AnimatedPressable>
                </View>
              ) : (
                <View style={styles.stepperRow}>
                  <Stepper
                    label="km"
                    value={distance}
                    onChange={setDistance}
                    step={DISTANCE_STEP}
                    min={DISTANCE_BOUNDS.min}
                    max={DISTANCE_BOUNDS.max}
                  />
                  <AnimatedPressable
                    onPress={() => setDistance(null)}
                    style={[styles.chip]}
                    haptic={false}
                  >
                    <Text style={styles.chipText}>No limit</Text>
                  </AnimatedPressable>
                </View>
              )}
            </View>

            {/* Relationship intent */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Looking for</Text>
              <Text style={styles.sectionHint}>Leave all off for no preference</Text>
              <View style={styles.chipRow}>
                {INTENT_OPTIONS.map((opt) => {
                  const selected = selectedIntents.has(opt.value);
                  return (
                    <AnimatedPressable
                      key={opt.value}
                      onPress={() => toggleIntent(opt.value)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${opt.label}`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {opt.label}
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {applying ? (
              <ActivityIndicator color={BRAND_COLORS.primary} />
            ) : (
              <GHButton title="Apply filters" onPress={handleApply} />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface StepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step: number;
  min: number;
  max: number;
}

function Stepper({ label, value, onChange, step, min, max }: StepperProps) {
  const decDisabled = value <= min;
  const incDisabled = value >= max;
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <AnimatedPressable
          onPress={() => onChange(value - step)}
          disabled={decDisabled}
          style={[styles.stepperButton, decDisabled && styles.stepperButtonDisabled]}
          accessibilityLabel={`Decrease ${label}`}
        >
          <Ionicons
            name="remove"
            size={18}
            color={decDisabled ? BRAND_COLORS.text[600] : BRAND_COLORS.text[900]}
          />
        </AnimatedPressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <AnimatedPressable
          onPress={() => onChange(value + step)}
          disabled={incDisabled}
          style={[styles.stepperButton, incDisabled && styles.stepperButtonDisabled]}
          accessibilityLabel={`Increase ${label}`}
        >
          <Ionicons
            name="add"
            size={18}
            color={incDisabled ? BRAND_COLORS.text[600] : BRAND_COLORS.text[900]}
          />
        </AnimatedPressable>
      </View>
    </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.base,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  resetText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.primary,
  },
  body: {
    flexGrow: 0,
  },
  bodyContent: {
    paddingBottom: SPACING.base,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
    marginBottom: SPACING.xs,
  },
  sectionHint: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: SPACING.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  stepper: {
    flexDirection: 'column',
    gap: SPACING.xs,
  },
  stepperLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[600],
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17,19,24,0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: MIDNIGHT.radius.md,
    paddingHorizontal: SPACING.xs,
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: 'rgba(17,19,24,0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 18,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  chipSelected: {
    backgroundColor: 'rgba(10, 127, 116, 0.18)',
    borderColor: BRAND_COLORS.primary,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[700],
  },
  chipTextSelected: {
    color: BRAND_COLORS.primaryLight,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  distanceLabel: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[700],
  },
  footer: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
});
