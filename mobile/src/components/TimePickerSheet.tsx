import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../config/brand';
import AnimatedPressable from './ui/AnimatedPressable';
import GHButton from './ui/GHButton';
import { localDateToUTC, utcStringToLocalDate } from '../lib/timezone';
import { durationMinutesOf, validateWindow, type TimeWindow } from '../lib/timeWindow';

type TimePickerSheetMode = 'create' | 'edit';

interface TimePickerSheetProps {
  visible: boolean;
  mode: TimePickerSheetMode;
  initialWindow?: TimeWindow;
  existingWindows: TimeWindow[];
  excludeIndex?: number;
  onSave: (window: TimeWindow) => void;
  onCancel: () => void;
}

const LENGTH_CHIPS = [60, 120, 180, 240] as const;

type AndroidPicker = 'date' | 'start' | 'end' | null;

function defaultCreateValues(): { date: Date; start: Date; end: Date } {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const start = new Date(tomorrow);
  start.setHours(18, 0, 0, 0);

  const end = new Date(tomorrow);
  end.setHours(20, 0, 0, 0);

  return { date: tomorrow, start, end };
}

function combineDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date);
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

export default function TimePickerSheet({
  visible,
  mode,
  initialWindow,
  existingWindows,
  excludeIndex,
  onSave,
  onCancel,
}: TimePickerSheetProps) {
  const insets = useSafeAreaInsets();
  const [date, setDate] = useState<Date>(() => defaultCreateValues().date);
  const [start, setStart] = useState<Date>(() => defaultCreateValues().start);
  const [end, setEnd] = useState<Date>(() => defaultCreateValues().end);
  const [androidPicker, setAndroidPicker] = useState<AndroidPicker>(null);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && initialWindow) {
      const startLocal = utcStringToLocalDate(initialWindow.start);
      const endLocal = utcStringToLocalDate(initialWindow.end);
      const dateOnly = new Date(startLocal);
      dateOnly.setHours(0, 0, 0, 0);
      setDate(dateOnly);
      setStart(startLocal);
      setEnd(endLocal);
    } else {
      const defaults = defaultCreateValues();
      setDate(defaults.date);
      setStart(defaults.start);
      setEnd(defaults.end);
    }
    setAndroidPicker(null);
  }, [visible, mode, initialWindow]);

  const minimumDate = new Date();
  const maximumDate = new Date();
  maximumDate.setDate(maximumDate.getDate() + 7);

  const currentDurationMinutes = durationMinutesOf(localDateToUTC(start), localDateToUTC(end));

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setAndroidPicker(null);
      if (event.type !== 'set' || !selected) return;
    }
    if (!selected) return;
    const next = new Date(selected);
    next.setHours(0, 0, 0, 0);
    setDate(next);
    setStart(combineDateAndTime(next, start));
    setEnd(combineDateAndTime(next, end));
  };

  const handleStartChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setAndroidPicker(null);
      if (event.type !== 'set' || !selected) return;
    }
    if (!selected) return;
    setStart(combineDateAndTime(date, selected));
  };

  const handleEndChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setAndroidPicker(null);
      if (event.type !== 'set' || !selected) return;
    }
    if (!selected) return;
    setEnd(combineDateAndTime(date, selected));
  };

  const handleChip = (durationMinutes: number) => {
    const next = new Date(start.getTime() + durationMinutes * 60_000);
    setEnd(next);
  };

  const handleSave = () => {
    const startUTC = localDateToUTC(start);
    const endUTC = localDateToUTC(end);
    const result = validateWindow(startUTC, endUTC, existingWindows, excludeIndex);
    if (!result.ok) {
      Alert.alert('Error', result.message);
      return;
    }
    onSave({ start: startUTC, end: endUTC });
  };

  const dateLabel = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onCancel}
          accessibilityLabel="Close time picker"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Pick a time</Text>
            <AnimatedPressable
              onPress={onCancel}
              haptic={false}
              accessibilityLabel="Cancel"
              hitSlop={8}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </AnimatedPressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Date</Text>
              {Platform.OS === 'ios' ? (
                <View style={styles.iosDateContainer}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="inline"
                    themeVariant="dark"
                    minimumDate={minimumDate}
                    maximumDate={maximumDate}
                    onChange={handleDateChange}
                    accentColor={BRAND_COLORS.primary}
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => setAndroidPicker('date')}
                  style={styles.androidTrigger}
                  accessibilityRole="button"
                  accessibilityLabel={`Date ${dateLabel}`}
                >
                  <Text style={styles.androidTriggerText}>{dateLabel}</Text>
                </Pressable>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Time</Text>
              <View style={styles.timeRow}>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>Start</Text>
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker
                      value={start}
                      mode="time"
                      display="compact"
                      themeVariant="dark"
                      minuteInterval={15}
                      onChange={handleStartChange}
                      accentColor={BRAND_COLORS.primary}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setAndroidPicker('start')}
                      style={styles.androidTrigger}
                      accessibilityRole="button"
                      accessibilityLabel={`Start time ${timeLabel(start)}`}
                    >
                      <Text style={styles.androidTriggerText}>{timeLabel(start)}</Text>
                    </Pressable>
                  )}
                </View>
                <View style={styles.timeColumn}>
                  <Text style={styles.timeLabel}>End</Text>
                  {Platform.OS === 'ios' ? (
                    <DateTimePicker
                      value={end}
                      mode="time"
                      display="compact"
                      themeVariant="dark"
                      minuteInterval={15}
                      onChange={handleEndChange}
                      accentColor={BRAND_COLORS.primary}
                    />
                  ) : (
                    <Pressable
                      onPress={() => setAndroidPicker('end')}
                      style={styles.androidTrigger}
                      accessibilityRole="button"
                      accessibilityLabel={`End time ${timeLabel(end)}`}
                    >
                      <Text style={styles.androidTriggerText}>{timeLabel(end)}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Length</Text>
              <View style={styles.chipRow}>
                {LENGTH_CHIPS.map((minutes) => {
                  const selected = currentDurationMinutes === minutes;
                  const hours = minutes / 60;
                  return (
                    <AnimatedPressable
                      key={minutes}
                      onPress={() => handleChip(minutes)}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`${hours} hour window`}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {hours}h
                      </Text>
                    </AnimatedPressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <GHButton title="Save" onPress={handleSave} />
          </View>

          {Platform.OS === 'android' && androidPicker === 'date' && (
            <DateTimePicker
              value={date}
              mode="date"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onChange={handleDateChange}
            />
          )}
          {Platform.OS === 'android' && androidPicker === 'start' && (
            <DateTimePicker
              value={start}
              mode="time"
              minuteInterval={15}
              onChange={handleStartChange}
            />
          )}
          {Platform.OS === 'android' && androidPicker === 'end' && (
            <DateTimePicker
              value={end}
              mode="time"
              minuteInterval={15}
              onChange={handleEndChange}
            />
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
    maxHeight: '90%',
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
  cancelText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[600],
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
    marginBottom: SPACING.sm,
  },
  iosDateContainer: {
    marginHorizontal: -SPACING.sm,
  },
  androidTrigger: {
    backgroundColor: 'rgba(17,19,24,0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: MIDNIGHT.radius.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  androidTriggerText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[900],
  },
  timeRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
    alignItems: 'flex-start',
  },
  timeColumn: {
    flex: 1,
    gap: SPACING.xs,
  },
  timeLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[600],
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
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
    minWidth: 56,
    alignItems: 'center',
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
  footer: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#1a1f2e',
  },
});
