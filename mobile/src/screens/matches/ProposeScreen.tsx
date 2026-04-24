import { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, MIDNIGHT, GOLD, TYPOGRAPHY, SPACING } from '../../config/brand';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import { getErrorAlert, isRecoverableError } from '../../lib/errors';
import { enqueue, processQueue, QueuedProposal } from '../../lib/offlineQueue';
import { createThrottle } from '../../lib/throttle';
import { sanitizeMultilineText } from '../../lib/sanitize';
import { addBreadcrumb } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';
import {
  localDateToUTC,
  isWithinSevenDays,
  isValidTimeWindow,
  formatProposalDate,
  formatProposalTimeOnly,
} from '../../lib/timezone';
import { weeklySlotsToPrefillWindows } from '../../lib/availability';
import type { WeeklySlot } from '../../lib/types';

type ProposeRouteParams = {
  matchId: string;
  responseTo?: string; // proposal_id if responding to "none suits"
};

type ProposeNavigationProp = NativeStackNavigationProp<any, 'Propose'>;

const DATE_TYPES = ['Coffee', 'Drinks', 'Dinner', 'Walk', 'Activity', 'Other'];

type PickerMode = 'date' | 'start-time' | 'end-time' | null;

function hasWindowOverlap(
  existingWindows: { start: string; end: string }[],
  newWindow: { start: string; end: string }
): boolean {
  return existingWindows.some((window) => {
    const wStart = new Date(window.start);
    const wEnd = new Date(window.end);
    const nStart = new Date(newWindow.start);
    const nEnd = new Date(newWindow.end);
    return (
      (nStart >= wStart && nStart < wEnd) ||
      (nEnd > wStart && nEnd <= wEnd) ||
      (nStart <= wStart && nEnd >= wEnd)
    );
  });
}

export default function ProposeScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<ProposeNavigationProp>();
  const { matchId } = route.params as ProposeRouteParams;

  const [selectedWindows, setSelectedWindows] = useState<{ start: string; end: string }[]>([]);
  const [selectedDateTypes, setSelectedDateTypes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [isPrefilled, setIsPrefilled] = useState(false);
  // Throttle proposal submission to prevent spam (min 2 seconds between proposals)
  const submitThrottleRef = useRef(createThrottle(() => {}, 2000));
  const [tempWindow, setTempWindow] = useState<{
    date: Date;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  const maximumDate = useMemo(() => {
    const max = new Date();
    max.setDate(max.getDate() + 7);
    return max;
  }, []);

  // Pre-fill time windows from saved weekly availability
  useEffect(() => {
    const prefillFromAvailability = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('availability')
          .eq('id', user.id)
          .maybeSingle();

        const availability = (profile?.availability ?? {}) as Record<string, any>;
        const slots = availability.weekly_slots as WeeklySlot[] | undefined;

        if (slots && slots.length > 0) {
          const prefilled = weeklySlotsToPrefillWindows(slots);
          if (prefilled.length > 0) {
            setSelectedWindows(prefilled);
            setIsPrefilled(true);
          }
        }
      } catch {
        // Non-critical: if prefill fails, user adds windows manually
      }
    };

    prefillFromAvailability();
  }, []);

  const addTimeWindow = () => {
    setIsPrefilled(false);
    if (selectedWindows.length >= 3) {
      Alert.alert('Limit', 'You can only propose 2-3 time windows');
      return;
    }

    const now = new Date();
    const defaultDate = new Date(now);
    defaultDate.setDate(defaultDate.getDate() + 1);
    defaultDate.setHours(0, 0, 0, 0);

    const defaultStartTime = new Date(defaultDate);
    defaultStartTime.setHours(18, 0, 0);

    const defaultEndTime = new Date(defaultDate);
    defaultEndTime.setHours(20, 0, 0);

    setTempWindow({
      date: defaultDate,
      startTime: defaultStartTime,
      endTime: defaultEndTime,
    });
    setPickerMode('date');
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setPickerMode(null);
    }

    if (event.type === 'set' && selectedDate && tempWindow) {
      const newDate = new Date(selectedDate);
      newDate.setHours(0, 0, 0, 0);

      const updatedStartTime = new Date(tempWindow.startTime);
      updatedStartTime.setFullYear(newDate.getFullYear());
      updatedStartTime.setMonth(newDate.getMonth());
      updatedStartTime.setDate(newDate.getDate());

      const updatedEndTime = new Date(tempWindow.endTime);
      updatedEndTime.setFullYear(newDate.getFullYear());
      updatedEndTime.setMonth(newDate.getMonth());
      updatedEndTime.setDate(newDate.getDate());

      setTempWindow({
        date: newDate,
        startTime: updatedStartTime,
        endTime: updatedEndTime,
      });

      if (Platform.OS === 'ios') {
        setPickerMode('start-time');
      } else {
        // Android: continue to start time
        setTimeout(() => setPickerMode('start-time'), 100);
      }
    } else if (event.type === 'dismissed') {
      setPickerMode(null);
      setTempWindow(null);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date, type: 'start' | 'end' = 'start') => {
    if (Platform.OS === 'android') {
      setPickerMode(null);
    }

    if (event.type === 'set' && selectedTime && tempWindow) {
      if (type === 'start') {
        const updatedStartTime = new Date(selectedTime);
        updatedStartTime.setFullYear(tempWindow.date.getFullYear());
        updatedStartTime.setMonth(tempWindow.date.getMonth());
        updatedStartTime.setDate(tempWindow.date.getDate());

        setTempWindow({
          ...tempWindow,
          startTime: updatedStartTime,
        });

        if (Platform.OS === 'ios') {
          setPickerMode('end-time');
        } else {
          setTimeout(() => setPickerMode('end-time'), 100);
        }
      } else {
        const updatedEndTime = new Date(selectedTime);
        updatedEndTime.setFullYear(tempWindow.date.getFullYear());
        updatedEndTime.setMonth(tempWindow.date.getMonth());
        updatedEndTime.setDate(tempWindow.date.getDate());

        const finalStartTime = tempWindow.startTime;
        const finalEndTime = updatedEndTime;

        // Validate: start < end
        if (finalStartTime >= finalEndTime) {
          Alert.alert('Error', 'End time must be after start time');
          setPickerMode(null);
          setTempWindow(null);
          return;
        }

        // Validate: within 7 days
        const now = new Date();
        const sevenDaysFromNow = new Date(now);
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

        if (finalStartTime > sevenDaysFromNow || finalStartTime < now) {
          Alert.alert('Error', 'All time windows must be within the next 7 days');
          setPickerMode(null);
          setTempWindow(null);
          return;
        }

        // Check for overlapping windows
        const newWindow = {
          start: finalStartTime.toISOString(),
          end: finalEndTime.toISOString(),
        };

        if (hasWindowOverlap(selectedWindows, newWindow)) {
          Alert.alert('Error', 'Time windows cannot overlap');
          setPickerMode(null);
          setTempWindow(null);
          return;
        }

        setSelectedWindows([...selectedWindows, newWindow]);
        setPickerMode(null);
        setTempWindow(null);
      }
    } else if (event.type === 'dismissed') {
      setPickerMode(null);
      setTempWindow(null);
    }
  };

  const confirmTimeWindow = () => {
    if (!tempWindow) return;

    const finalStartTime = tempWindow.startTime;
    const finalEndTime = tempWindow.endTime;

    // Convert to UTC ISO strings for storage
    const startUTC = localDateToUTC(finalStartTime);
    const endUTC = localDateToUTC(finalEndTime);

    // Validate: start < end (using timezone-aware validation)
    if (!isValidTimeWindow(startUTC, endUTC)) {
      Alert.alert('Error', 'End time must be after start time');
      setPickerMode(null);
      setTempWindow(null);
      return;
    }

    // Validate: within 7 days (using timezone-aware validation)
    if (!isWithinSevenDays(startUTC)) {
      Alert.alert('Error', 'All time windows must be within the next 7 days');
      setPickerMode(null);
      setTempWindow(null);
      return;
    }

    // Check for overlapping windows
    const newWindow = {
      start: startUTC,
      end: endUTC,
    };

    if (hasWindowOverlap(selectedWindows, newWindow)) {
      Alert.alert('Error', 'Time windows cannot overlap');
      setPickerMode(null);
      setTempWindow(null);
      return;
    }

    setSelectedWindows([...selectedWindows, newWindow]);
    setPickerMode(null);
    setTempWindow(null);
  };

  const removeTimeWindow = (index: number) => {
    setIsPrefilled(false);
    setSelectedWindows(selectedWindows.filter((_, i) => i !== index));
  };

  const toggleDateType = (type: string) => {
    if (selectedDateTypes.includes(type)) {
      setSelectedDateTypes(selectedDateTypes.filter((t) => t !== type));
    } else {
      if (selectedDateTypes.length >= 3) {
        Alert.alert('Limit', 'Select 1-3 date types');
        return;
      }
      setSelectedDateTypes([...selectedDateTypes, type]);
    }
  };

  const handleSubmit = async () => {
    if (selectedWindows.length < 2 || selectedWindows.length > 3) {
      Alert.alert('Error', 'Please select exactly 2-3 time windows');
      return;
    }

    // Prevent rapid successive proposal submissions (rate limiting)
    if (submitThrottleRef.current.isThrottled()) {
      Alert.alert('Please wait', 'You can only submit proposals every 2 seconds');
      return;
    }

    // Update throttle to prevent next call for 2 seconds
    submitThrottleRef.current.execute();

    // Validate all windows are within 7 days (using timezone-aware validation)
    const invalidWindow = selectedWindows.find((window) => !isWithinSevenDays(window.start));

    if (invalidWindow) {
      Alert.alert('Error', 'All time windows must be within the next 7 days');
      return;
    }

    if (selectedDateTypes.length < 1 || selectedDateTypes.length > 3) {
      Alert.alert('Error', 'Please select 1-3 date types');
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate expiry (72 hours from now) and convert to UTC
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);
      const expiresAtUTC = localDateToUTC(expiresAt);

      // Sanitize note before storing
      const sanitizedNote = note.trim() ? sanitizeMultilineText(note) : null;

      addBreadcrumb('Creating proposal', 'proposal', 'info', {
        matchId: matchId.substring(0, 8),
        windowCount: selectedWindows.length,
        dateTypeCount: selectedDateTypes.length,
      });
      trackEvent('proposal_sent', {
        matchId: matchId.substring(0, 8),
        windowCount: selectedWindows.length,
        dateTypeCount: selectedDateTypes.length,
        hasNote: !!sanitizedNote,
      });

      const { error } = await supabase.from('proposals').insert({
        match_id: matchId,
        sender_id: user.id,
        windows: selectedWindows, // Already in UTC format
        date_types: selectedDateTypes,
        note: sanitizedNote,
        expires_at: expiresAtUTC,
        status: 'active',
      });

      if (error) {
        // Check if it's a recoverable (network) error
        if (isRecoverableError(error)) {
          // Queue proposal for retry
          const queuedProposal: QueuedProposal = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'proposal',
            match_id: matchId,
            sender_id: user.id,
            windows: selectedWindows, // Already in UTC format
            date_types: selectedDateTypes,
            note: note.trim() || null,
            expires_at: expiresAtUTC,
            createdAt: localDateToUTC(new Date()),
          };
          await enqueue(queuedProposal);
          Alert.alert('Proposal queued', "Your proposal will be sent when you're back online.");
          navigation.goBack();
          setLoading(false);
          return;
        } else {
          // Non-recoverable error
          const { title, message } = getErrorAlert(error, 'Failed to send proposal');
          Alert.alert(title, message);
          setLoading(false);
          return;
        }
      }

      // Success - process any queued operations
      await processQueue();
      Alert.alert('Success', 'Proposal sent!');
      navigation.goBack();
    } catch (error: any) {
      // Check if it's a recoverable (network) error
      if (isRecoverableError(error)) {
        // Queue proposal for retry
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 72);
          const expiresAtUTC = localDateToUTC(expiresAt);

          const queuedProposal: QueuedProposal = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'proposal',
            match_id: matchId,
            sender_id: user.id,
            windows: selectedWindows, // Already in UTC format
            date_types: selectedDateTypes,
            note: note.trim() || null,
            expires_at: expiresAtUTC,
            createdAt: localDateToUTC(new Date()),
          };
          await enqueue(queuedProposal);
          Alert.alert('Proposal queued', "Your proposal will be sent when you're back online.");
          navigation.goBack();
          setLoading(false);
          return;
        }
      }
      const { title, message } = getErrorAlert(error, 'Failed to send proposal');
      Alert.alert(title, message);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const NOTE_MAX_LENGTH = 140;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 200 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header App Bar */}
        <View style={styles.header}>
          <AnimatedPressable
            style={styles.headerBackButton}
            onPress={() => navigation.goBack()}
            haptic={false}
          >
            <Ionicons name="arrow-back" size={24} color={BRAND_COLORS.primary} />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Propose a Time</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Date Types Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>What's the vibe?</Text>
            <Text style={styles.sectionHeaderRight}>SELECT ONE</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateTypesScroll}
          >
            {DATE_TYPES.map((type) => (
              <AnimatedPressable
                key={type}
                style={[
                  styles.dateTypeButton,
                  selectedDateTypes.includes(type) && styles.dateTypeButtonSelected,
                ]}
                onPress={() => toggleDateType(type)}
              >
                <Text
                  style={[
                    styles.dateTypeText,
                    selectedDateTypes.includes(type) && styles.dateTypeTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </AnimatedPressable>
            ))}
          </ScrollView>
        </View>

        {/* Time Windows Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Suggested Times</Text>
            <Text style={styles.sectionHeaderRight}>MAX 3 OPTIONS</Text>
          </View>

          {isPrefilled && selectedWindows.length > 0 && (
            <Text style={styles.prefillHint}>
              Pre-filled from your usual availability. Edit or remove as needed.
            </Text>
          )}

          {selectedWindows.map((window, index) => (
            <View key={index} style={styles.windowCard}>
              {/* Date Row */}
              <View style={styles.windowRow}>
                <View style={styles.windowIconBox}>
                  <Ionicons name="calendar-outline" size={20} color={BRAND_COLORS.text[600]} />
                </View>
                <View style={styles.windowInfo}>
                  <Text style={styles.windowLabel}>DATE</Text>
                  <Text style={styles.windowValue}>{formatProposalDate(window.start)}</Text>
                </View>
                <AnimatedPressable
                  onPress={() => removeTimeWindow(index)}
                  haptic={false}
                  style={styles.windowAction}
                >
                  <Ionicons name="create-outline" size={20} color={BRAND_COLORS.text[500]} />
                </AnimatedPressable>
              </View>
              {/* Divider */}
              <View style={styles.windowDivider} />
              {/* Time Row */}
              <View style={styles.windowRow}>
                <View style={styles.windowIconBox}>
                  <Ionicons name="time-outline" size={20} color={BRAND_COLORS.text[600]} />
                </View>
                <View style={styles.windowInfo}>
                  <Text style={styles.windowLabel}>WINDOW</Text>
                  <Text style={styles.windowValue}>
                    {formatProposalTimeOnly(window.start)} - {formatProposalTimeOnly(window.end)}
                  </Text>
                </View>
                <View style={styles.windowAction}>
                  <Ionicons name="chevron-down" size={20} color={BRAND_COLORS.text[500]} />
                </View>
              </View>
            </View>
          ))}

          {selectedWindows.length < 3 && (
            <AnimatedPressable style={styles.addButton} onPress={addTimeWindow}>
              <Ionicons name="add-circle-outline" size={30} color={BRAND_COLORS.text[500]} />
              <Text style={styles.addButtonText}>Add another option</Text>
            </AnimatedPressable>
          )}

          {pickerMode && tempWindow && (
            <View style={styles.pickerContainer}>
              {pickerMode === 'date' && (
                <DateTimePicker
                  value={tempWindow.date}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant="dark"
                  minimumDate={new Date()}
                  maximumDate={maximumDate}
                  onChange={handleDateChange}
                />
              )}
              {pickerMode === 'start-time' && (
                <View>
                  <DateTimePicker
                    value={tempWindow.startTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="dark"
                    onChange={(e, d) => handleTimeChange(e, d, 'start')}
                  />
                  {Platform.OS === 'ios' && (
                    <AnimatedPressable
                      style={styles.pickerButton}
                      onPress={() => setPickerMode('end-time')}
                    >
                      <Text style={styles.pickerButtonText}>Next: End Time</Text>
                    </AnimatedPressable>
                  )}
                </View>
              )}
              {pickerMode === 'end-time' && (
                <View>
                  <DateTimePicker
                    value={tempWindow.endTime}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    themeVariant="dark"
                    onChange={(e, d) => handleTimeChange(e, d, 'end')}
                  />
                  {Platform.OS === 'ios' && (
                    <View style={styles.pickerButtonsRow}>
                      <AnimatedPressable
                        style={[styles.pickerButton, styles.pickerButtonSecondary]}
                        onPress={() => {
                          setPickerMode(null);
                          setTempWindow(null);
                        }}
                      >
                        <Text style={styles.pickerButtonSecondaryText}>Cancel</Text>
                      </AnimatedPressable>
                      <AnimatedPressable style={styles.pickerButton} onPress={confirmTimeWindow}>
                        <Text style={styles.pickerButtonText}>Confirm</Text>
                      </AnimatedPressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Note Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a note (optional)</Text>
          <View style={styles.noteWrapper}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note..."
              placeholderTextColor={BRAND_COLORS.text[600]}
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              maxLength={NOTE_MAX_LENGTH}
            />
            <Text style={styles.noteCounter}>
              {note.length} / {NOTE_MAX_LENGTH}
            </Text>
          </View>
        </View>

        {/* Recipient Card */}
        <View style={styles.section}>
          <View style={styles.recipientCard}>
            <View style={styles.recipientAvatar} />
            <View style={styles.recipientInfo}>
              <Text style={styles.recipientLabel}>Proposing to</Text>
              <Text style={styles.recipientName}>Your Match</Text>
            </View>
            <View style={styles.recipientHeart}>
              <Ionicons name="heart" size={20} color={BRAND_COLORS.primary} />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Footer */}
      <LinearGradient
        colors={['transparent', MIDNIGHT.bg, MIDNIGHT.bg]}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}
        pointerEvents="box-none"
      >
        <AnimatedPressable
          style={[styles.goldButton, loading && styles.goldButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.goldButtonText}>{loading ? 'Sending...' : 'Send Proposal'}</Text>
          {!loading && (
            <Ionicons
              name="send"
              size={18}
              color={BRAND_COLORS.onPrimary}
              style={styles.sendIcon}
            />
          )}
        </AnimatedPressable>
        <Text style={styles.expiryNote}>PROPOSALS EXPIRE IN 72 HOURS</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: SPACING.base,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  headerSpacer: {
    width: 40,
  },

  // Sections
  section: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  sectionHeaderRight: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[500],
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },
  prefillHint: {
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.primary,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
  },

  // Date Types
  dateTypesScroll: {
    paddingRight: SPACING.lg,
  },
  dateTypeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 9999,
    marginRight: 12,
    backgroundColor: MIDNIGHT.surface,
    borderWidth: 1,
    borderColor: '#1a1f2e',
  },
  dateTypeButtonSelected: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: 'rgba(10,127,116,0.2)',
    ...MIDNIGHT.glow.selected,
  },
  dateTypeText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[600],
  },
  dateTypeTextSelected: {
    color: BRAND_COLORS.onPrimary,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },

  // Time Window Cards
  windowCard: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: MIDNIGHT.surface,
    borderWidth: 1,
    borderColor: '#1a1f2e',
    marginBottom: SPACING.md,
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  windowIconBox: {
    width: 40,
    height: 40,
    borderRadius: MIDNIGHT.radius.sm,
    backgroundColor: MIDNIGHT.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  windowInfo: {
    flex: 1,
  },
  windowLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[500],
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    marginBottom: 2,
  },
  windowValue: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[900],
  },
  windowAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  windowDivider: {
    height: 1,
    backgroundColor: 'rgba(26,31,46,0.5)',
    marginVertical: SPACING.md,
  },

  // Add Button
  addButton: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#1a1f2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: BRAND_COLORS.text[500],
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: SPACING.xs,
  },

  // Picker
  pickerContainer: {
    marginTop: SPACING.base,
    padding: SPACING.base,
    ...MIDNIGHT.glassCard,
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.base,
    gap: SPACING.md,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: MIDNIGHT.radius.md,
    alignItems: 'center',
  },
  pickerButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
  },
  pickerButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  pickerButtonSecondaryText: {
    color: BRAND_COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },

  // Note
  noteWrapper: {
    position: 'relative',
    marginTop: SPACING.sm,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    borderRadius: MIDNIGHT.radius.lg,
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    backgroundColor: MIDNIGHT.inputBg,
    color: BRAND_COLORS.text[900],
    minHeight: 80,
    textAlignVertical: 'top',
  },
  noteCounter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[500],
    textTransform: 'uppercase',
  },

  // Recipient Card
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.base,
    borderRadius: MIDNIGHT.radius.lg,
    backgroundColor: MIDNIGHT.surface,
    borderWidth: 1,
    borderColor: '#1a1f2e',
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1a1f2e',
    marginRight: SPACING.md,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[500],
    marginBottom: 2,
  },
  recipientName: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  recipientHeart: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 127, 116, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  goldButton: {
    backgroundColor: GOLD[600],
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...MIDNIGHT.glow.gold,
  },
  goldButtonDisabled: {
    opacity: 0.6,
  },
  goldButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  sendIcon: {
    marginLeft: SPACING.sm,
  },
  expiryNote: {
    textAlign: 'center',
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: 'rgba(202, 138, 4, 0.6)',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide * 2,
    marginTop: SPACING.md,
  },
});
