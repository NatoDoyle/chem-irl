import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';
import { getErrorAlert, isRecoverableError } from '../../lib/errors';
import { enqueue, processQueue, QueuedProposal } from '../../lib/offlineQueue';
import { createThrottle } from '../../lib/throttle';
import { sanitizeMultilineText } from '../../lib/sanitize';
import { addBreadcrumb } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';
import {
  localDateToUTC,
  isWithinSevenDays,
  formatProposalDate,
  formatProposalTimeOnly,
} from '../../lib/timezone';
import { weeklySlotsToPrefillWindows } from '../../lib/availability';
import type { WeeklySlot } from '../../lib/types';

type ProposeRouteParams = {
  matchId: string;
  responseTo?: string;
};

type ProposeNavigationProp = NativeStackNavigationProp<any, 'Propose'>;

const DATE_TYPES = ['Coffee', 'Drinks', 'Dinner', 'Walk', 'Activity', 'Other'];

const TIME_BLOCKS = [
  { label: 'Morning', hint: '9 - 11a', start: '09:00', end: '11:00' },
  { label: 'Lunch', hint: '12 - 1:30p', start: '12:00', end: '13:30' },
  { label: 'Afternoon', hint: '2 - 4p', start: '14:00', end: '16:00' },
  { label: 'Evening', hint: '6 - 8p', start: '18:00', end: '20:00' },
  { label: 'Night', hint: '8 - 10p', start: '20:00', end: '22:00' },
] as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SECTION_PADDING = 20;
const BLOCK_GAP = 8;
const BLOCK_WIDTH = (SCREEN_WIDTH - SECTION_PADDING * 2 - BLOCK_GAP) / 2;

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

function isBlockPassed(day: Date, block: (typeof TIME_BLOCKS)[number]): boolean {
  const now = new Date();
  const [endHour, endMinute] = block.end.split(':').map(Number);
  const blockEnd = new Date(day);
  blockEnd.setHours(endHour, endMinute, 0, 0);
  return blockEnd <= now;
}

function isBlockAlreadyAdded(
  day: Date,
  block: (typeof TIME_BLOCKS)[number],
  windows: { start: string; end: string }[]
): boolean {
  const [startH, startM] = block.start.split(':').map(Number);
  const [endH, endM] = block.end.split(':').map(Number);
  const blockStart = new Date(day);
  blockStart.setHours(startH, startM, 0, 0);
  const blockEnd = new Date(day);
  blockEnd.setHours(endH, endM, 0, 0);
  const startUTC = localDateToUTC(blockStart);
  const endUTC = localDateToUTC(blockEnd);
  return windows.some((w) => w.start === startUTC && w.end === endUTC);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimeDisplay(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ProposeScreen() {
  const route = useRoute();
  const navigation = useNavigation<ProposeNavigationProp>();
  const { matchId } = route.params as ProposeRouteParams;

  // Match context
  const [otherUserName, setOtherUserName] = useState('');
  const [otherUserPhoto, setOtherUserPhoto] = useState<string | null>(null);

  // Time windows
  const [selectedWindows, setSelectedWindows] = useState<{ start: string; end: string }[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<(typeof TIME_BLOCKS)[number] | null>(null);
  const [isPrefilled, setIsPrefilled] = useState(false);

  // Custom time picker
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [customStartTime, setCustomStartTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [customEndTime, setCustomEndTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  });
  // Android: which time modal is currently open
  const [androidPickerField, setAndroidPickerField] = useState<'start' | 'end' | null>(null);

  // Date types & note
  const [selectedDateTypes, setSelectedDateTypes] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Submission
  const [loading, setLoading] = useState(false);
  const submitThrottleRef = useRef(createThrottle(() => {}, 2000));

  // Inline validation
  const [errors, setErrors] = useState<{ windows?: string; dateTypes?: string }>({});

  const next7Days = useMemo(() => {
    const days: Date[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days;
  }, []);

  // Fetch match context (other user's name + photo)
  useEffect(() => {
    const fetchMatchContext = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: matchData } = await supabase
          .from('matches')
          .select('user_a, user_b')
          .eq('match_id', matchId)
          .single();

        if (!matchData) return;

        const otherUserId = matchData.user_a === user.id ? matchData.user_b : matchData.user_a;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, photos')
          .eq('id', otherUserId)
          .maybeSingle();

        if (profile) {
          setOtherUserName((profile.full_name as string) || '');
          const photos = (profile.photos as string[]) || [];
          setOtherUserPhoto(photos[0] || null);
        }
      } catch {
        // Non-critical: header shows without name/photo
      }
    };

    fetchMatchContext();
  }, [matchId]);

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

  const handleDaySelect = (day: Date) => {
    if (selectedDay && isSameDay(selectedDay, day)) {
      // Deselect same day — clear everything
      setSelectedDay(null);
      setSelectedBlock(null);
      setCustomPickerOpen(false);
      setAndroidPickerField(null);
    } else {
      setSelectedDay(day);
      setCustomPickerOpen(false);
      setAndroidPickerField(null);
      // Keep selectedBlock — user might want same time slot on a different day
    }
  };

  // Highlight a block (does NOT add the window yet)
  const handleBlockTap = (block: (typeof TIME_BLOCKS)[number]) => {
    if (selectedBlock?.label === block.label) {
      setSelectedBlock(null); // toggle off
    } else {
      setSelectedBlock(block);
    }
    setCustomPickerOpen(false);
    setAndroidPickerField(null);
    setErrors((prev) => ({ ...prev, windows: undefined }));
  };

  const handleCustomTap = () => {
    if (!selectedDay) return;

    const defaultStart = new Date(selectedDay);
    defaultStart.setHours(18, 0, 0, 0);
    const defaultEnd = new Date(selectedDay);
    defaultEnd.setHours(20, 0, 0, 0);

    setCustomStartTime(defaultStart);
    setCustomEndTime(defaultEnd);
    setCustomPickerOpen(true);
    setSelectedBlock(null);
    setAndroidPickerField(null);
    setErrors((prev) => ({ ...prev, windows: undefined }));
  };

  // iOS: inline spinner update. Android: native modal result.
  const handleCustomTimeChange = (field: 'start' | 'end') => (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      setAndroidPickerField(null); // close modal
      if (event.type === 'dismissed' || !selected || !selectedDay) return;
    }
    if (!selected || !selectedDay) return;

    const anchored = new Date(selectedDay);
    anchored.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (field === 'start') {
      setCustomStartTime(anchored);
    } else {
      setCustomEndTime(anchored);
    }
  };

  // Single confirm handler for both preset blocks and custom times
  const confirmTimeSelection = () => {
    if (!selectedDay) return;
    if (selectedWindows.length >= 3) {
      setErrors((prev) => ({ ...prev, windows: 'Maximum 3 time windows' }));
      return;
    }

    let startUTC: string;
    let endUTC: string;

    if (selectedBlock) {
      // Preset block
      const [startH, startM] = selectedBlock.start.split(':').map(Number);
      const [endH, endM] = selectedBlock.end.split(':').map(Number);

      const startDate = new Date(selectedDay);
      startDate.setHours(startH, startM, 0, 0);
      const endDate = new Date(selectedDay);
      endDate.setHours(endH, endM, 0, 0);

      startUTC = localDateToUTC(startDate);
      endUTC = localDateToUTC(endDate);
    } else if (customPickerOpen) {
      // Custom times
      if (customStartTime >= customEndTime) {
        setErrors((prev) => ({ ...prev, windows: 'End time must be after start time' }));
        return;
      }
      startUTC = localDateToUTC(customStartTime);
      endUTC = localDateToUTC(customEndTime);
    } else {
      return;
    }

    if (!isWithinSevenDays(startUTC)) {
      setErrors((prev) => ({ ...prev, windows: 'Must be within the next 7 days' }));
      return;
    }

    const newWindow = { start: startUTC, end: endUTC };

    if (hasWindowOverlap(selectedWindows, newWindow)) {
      setErrors((prev) => ({ ...prev, windows: 'This overlaps with an existing window' }));
      return;
    }

    setErrors((prev) => ({ ...prev, windows: undefined }));
    setIsPrefilled(false);
    setSelectedWindows((prev) => [...prev, newWindow]);
    setSelectedBlock(null);
    setCustomPickerOpen(false);
    setAndroidPickerField(null);
  };

  const removeTimeWindow = (index: number) => {
    setIsPrefilled(false);
    setSelectedWindows(selectedWindows.filter((_, i) => i !== index));
    setErrors((prev) => ({ ...prev, windows: undefined }));
  };

  const toggleDateType = (type: string) => {
    if (selectedDateTypes.includes(type)) {
      setSelectedDateTypes(selectedDateTypes.filter((t) => t !== type));
    } else {
      if (selectedDateTypes.length >= 3) {
        setErrors((prev) => ({ ...prev, dateTypes: 'Maximum 3 date types' }));
        return;
      }
      setSelectedDateTypes([...selectedDateTypes, type]);
    }
    setErrors((prev) => ({ ...prev, dateTypes: undefined }));
  };

  const handleSubmit = async () => {
    if (selectedWindows.length < 2 || selectedWindows.length > 3) {
      setErrors((prev) => ({ ...prev, windows: 'Pick 2-3 time windows' }));
      return;
    }

    if (submitThrottleRef.current.isThrottled()) {
      Alert.alert('Please wait', 'You can only submit proposals every 2 seconds');
      return;
    }

    submitThrottleRef.current.execute();

    const invalidWindow = selectedWindows.find((window) => !isWithinSevenDays(window.start));
    if (invalidWindow) {
      setErrors((prev) => ({ ...prev, windows: 'All times must be within the next 7 days' }));
      return;
    }

    if (selectedDateTypes.length < 1 || selectedDateTypes.length > 3) {
      setErrors((prev) => ({ ...prev, dateTypes: 'Pick 1-3 date types' }));
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);
      const expiresAtUTC = localDateToUTC(expiresAt);

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
        windows: selectedWindows,
        date_types: selectedDateTypes,
        note: sanitizedNote,
        expires_at: expiresAtUTC,
        status: 'active',
      });

      if (error) {
        if (isRecoverableError(error)) {
          const queuedProposal: QueuedProposal = {
            id: `${Date.now()}-${Math.random()}`,
            type: 'proposal',
            match_id: matchId,
            sender_id: user.id,
            windows: selectedWindows,
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
          const { title, message } = getErrorAlert(error, 'Failed to send proposal');
          Alert.alert(title, message);
          setLoading(false);
          return;
        }
      }

      await processQueue();
      Alert.alert('Sent!', 'Your date proposal is on the way.');
      navigation.goBack();
    } catch (error: any) {
      if (isRecoverableError(error)) {
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
            windows: selectedWindows,
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

  const isReady = selectedWindows.length >= 2 && selectedDateTypes.length >= 1;
  const canAddTime = selectedDay && (selectedBlock || customPickerOpen);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Match context header */}
        <View style={styles.header}>
          {otherUserPhoto ? (
            <Image
              source={{ uri: otherUserPhoto }}
              style={styles.headerPhoto}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.headerPhoto, styles.headerPhotoPlaceholder]} />
          )}
          <Text style={styles.headerText}>
            {otherUserName ? `Plan a date with ${otherUserName}` : 'Plan a date'}
          </Text>
        </View>

        {/* Time selection section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>When works for you?</Text>
          <Text style={styles.sectionHint}>pick 2-3</Text>

          {isPrefilled && selectedWindows.length > 0 && (
            <Text style={styles.prefillHint}>Pre-filled from your usual availability</Text>
          )}

          {/* Day strip */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayStripContent}
            style={styles.dayStrip}
          >
            {next7Days.map((day, i) => {
              const isSelected = selectedDay !== null && isSameDay(selectedDay, day);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayCard, isSelected && styles.dayCardSelected]}
                  onPress={() => handleDaySelect(day)}
                >
                  <Text style={[styles.dayName, isSelected && styles.dayTextSelected]}>
                    {i === 0 ? 'Today' : day.toLocaleDateString('en-US', { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Time blocks */}
          {selectedDay && (
            <View style={styles.timeBlockGrid}>
              {TIME_BLOCKS.map((block) => {
                const passed = isBlockPassed(selectedDay, block);
                const alreadyAdded = isBlockAlreadyAdded(selectedDay, block, selectedWindows);
                const highlighted = !customPickerOpen && selectedBlock?.label === block.label;
                const disabled = passed || alreadyAdded || selectedWindows.length >= 3;
                return (
                  <TouchableOpacity
                    key={block.label}
                    style={[
                      styles.timeBlock,
                      alreadyAdded && styles.timeBlockAdded,
                      highlighted && styles.timeBlockHighlighted,
                      disabled && !alreadyAdded && styles.timeBlockDisabled,
                    ]}
                    onPress={() => handleBlockTap(block)}
                    disabled={disabled}
                  >
                    <Text
                      style={[
                        styles.timeBlockLabel,
                        alreadyAdded && styles.timeBlockAddedText,
                        highlighted && styles.timeBlockHighlightedText,
                        disabled && !alreadyAdded && styles.timeBlockLabelDisabled,
                      ]}
                    >
                      {block.label}
                    </Text>
                    <Text
                      style={[
                        styles.timeBlockHint,
                        alreadyAdded && styles.timeBlockAddedText,
                        highlighted && styles.timeBlockHighlightedText,
                        disabled && !alreadyAdded && styles.timeBlockLabelDisabled,
                      ]}
                    >
                      {alreadyAdded ? 'Added' : block.hint}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              {/* Custom block */}
              <TouchableOpacity
                style={[
                  styles.timeBlock,
                  styles.timeBlockCustom,
                  customPickerOpen && styles.timeBlockHighlighted,
                  selectedWindows.length >= 3 && styles.timeBlockDisabled,
                ]}
                onPress={handleCustomTap}
                disabled={selectedWindows.length >= 3}
              >
                <Text
                  style={[
                    styles.timeBlockLabel,
                    customPickerOpen && styles.timeBlockHighlightedText,
                    selectedWindows.length >= 3 && styles.timeBlockLabelDisabled,
                  ]}
                >
                  Custom
                </Text>
                <Text
                  style={[
                    styles.timeBlockHint,
                    customPickerOpen && styles.timeBlockHighlightedText,
                    selectedWindows.length >= 3 && styles.timeBlockLabelDisabled,
                  ]}
                >
                  pick times
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Custom picker — both start and end visible at once */}
          {customPickerOpen && selectedDay && (
            <View style={styles.customPickerContainer}>
              {Platform.OS === 'ios' ? (
                <>
                  <Text style={styles.customPickerLabel}>Start time</Text>
                  <DateTimePicker
                    value={customStartTime}
                    mode="time"
                    display="spinner"
                    onChange={handleCustomTimeChange('start')}
                    minuteInterval={15}
                  />
                  <Text style={[styles.customPickerLabel, { marginTop: 12 }]}>End time</Text>
                  <DateTimePicker
                    value={customEndTime}
                    mode="time"
                    display="spinner"
                    onChange={handleCustomTimeChange('end')}
                    minuteInterval={15}
                  />
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.androidTimeRow}
                    onPress={() => setAndroidPickerField('start')}
                  >
                    <Text style={styles.androidTimeLabel}>Start time</Text>
                    <Text style={styles.androidTimeValue}>
                      {formatTimeDisplay(customStartTime)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.androidTimeRow}
                    onPress={() => setAndroidPickerField('end')}
                  >
                    <Text style={styles.androidTimeLabel}>End time</Text>
                    <Text style={styles.androidTimeValue}>{formatTimeDisplay(customEndTime)}</Text>
                  </TouchableOpacity>
                  {androidPickerField && (
                    <DateTimePicker
                      value={androidPickerField === 'start' ? customStartTime : customEndTime}
                      mode="time"
                      display="default"
                      onChange={handleCustomTimeChange(androidPickerField)}
                      minuteInterval={15}
                    />
                  )}
                </>
              )}
            </View>
          )}

          {/* "Add this time" button — one button to confirm the selection */}
          {canAddTime && selectedWindows.length < 3 && (
            <TouchableOpacity style={styles.addTimeButton} onPress={confirmTimeSelection}>
              <Text style={styles.addTimeButtonText}>Add this time</Text>
            </TouchableOpacity>
          )}

          {errors.windows && <Text style={styles.errorText}>{errors.windows}</Text>}
        </View>

        {/* Selected windows */}
        {selectedWindows.length > 0 && (
          <View style={styles.section}>
            {selectedWindows.map((window, index) => (
              <View key={index} style={styles.windowCard}>
                <View style={styles.windowCardContent}>
                  <Text style={styles.windowCardDate}>{formatProposalDate(window.start)}</Text>
                  <Text style={styles.windowCardTime}>
                    {formatProposalTimeOnly(window.start)} - {formatProposalTimeOnly(window.end)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.windowRemove}
                  onPress={() => removeTimeWindow(index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.windowRemoveText}>{'\u00D7'}</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Text style={styles.windowCounter}>{selectedWindows.length} of 2-3</Text>
          </View>
        )}

        {/* Date types section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What kind of date?</Text>
          <Text style={styles.sectionHint}>pick 1-3</Text>
          <View style={styles.dateTypesGrid}>
            {DATE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dateTypeChip,
                  selectedDateTypes.includes(type) && styles.dateTypeChipSelected,
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
              </TouchableOpacity>
            ))}
          </View>
          {errors.dateTypes && <Text style={styles.errorText}>{errors.dateTypes}</Text>}
        </View>

        {/* Note section */}
        <View style={styles.section}>
          <View style={styles.noteHeader}>
            <Text style={styles.sectionTitle}>Add a note</Text>
            <Text style={styles.charCounter}>{note.length}/200</Text>
          </View>
          <TextInput
            style={styles.noteInput}
            placeholder="Anything they should know..."
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>

        <View style={styles.ctaSpacer} />
      </ScrollView>

      {/* Sticky submit button */}
      <View style={styles.stickyCTA}>
        <TouchableOpacity
          style={[styles.submitButton, (!isReady || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Send Proposal</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
  },
  scrollView: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SECTION_PADDING,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 12,
  },
  headerPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerPhotoPlaceholder: {
    backgroundColor: GOLDEN_HOUR.borderDefault,
  },
  headerText: {
    fontSize: 20,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    flex: 1,
  },

  // Sections
  section: {
    paddingHorizontal: SECTION_PADDING,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  sectionHint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
    marginBottom: 12,
  },
  prefillHint: {
    fontSize: 13,
    color: BRAND_COLORS.info,
    fontStyle: 'italic',
    marginBottom: 8,
  },

  // Day strip
  dayStrip: {
    marginBottom: 12,
  },
  dayStripContent: {
    gap: 8,
  },
  dayCard: {
    width: 64,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: GOLDEN_HOUR.radius.md,
    backgroundColor: GOLDEN_HOUR.surface,
    borderWidth: 1.5,
    borderColor: GOLDEN_HOUR.borderDefault,
  },
  dayCardSelected: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  dayName: {
    fontSize: 13,
    fontWeight: '500',
    color: BRAND_COLORS.text[600],
  },
  dayNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: BRAND_COLORS.text[900],
    marginTop: 2,
  },
  dayTextSelected: {
    color: '#fff',
  },

  // Time blocks
  timeBlockGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: BLOCK_GAP,
  },
  timeBlock: {
    width: BLOCK_WIDTH,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: GOLDEN_HOUR.radius.md,
    backgroundColor: GOLDEN_HOUR.surface,
    borderWidth: 1.5,
    borderColor: GOLDEN_HOUR.borderDefault,
    alignItems: 'center',
  },
  timeBlockAdded: {
    backgroundColor: BRAND_COLORS.primarySoft,
    borderColor: BRAND_COLORS.primary,
  },
  timeBlockHighlighted: {
    backgroundColor: BRAND_COLORS.aqua[50],
    borderColor: BRAND_COLORS.primary,
    borderWidth: 2,
  },
  timeBlockDisabled: {
    opacity: 0.35,
  },
  timeBlockCustom: {
    borderStyle: 'dashed' as const,
  },
  timeBlockLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  timeBlockAddedText: {
    color: BRAND_COLORS.primary,
  },
  timeBlockHighlightedText: {
    color: BRAND_COLORS.primary,
    fontWeight: '700',
  },
  timeBlockHint: {
    fontSize: 13,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  timeBlockLabelDisabled: {
    color: BRAND_COLORS.text[600],
  },

  // Custom picker
  customPickerContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: GOLDEN_HOUR.inputBg,
    borderRadius: GOLDEN_HOUR.radius.md,
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
  },
  customPickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLORS.text[700],
    marginBottom: 4,
  },

  // Android time rows
  androidTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GOLDEN_HOUR.borderDefault,
  },
  androidTimeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_COLORS.text[700],
  },
  androidTimeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.primary,
  },

  // Add time button
  addTimeButton: {
    marginTop: 12,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 14,
    borderRadius: GOLDEN_HOUR.radius.md,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
  },
  addTimeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Selected window cards
  windowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: GOLDEN_HOUR.inputBg,
    padding: 14,
    borderRadius: GOLDEN_HOUR.radius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
  },
  windowCardContent: {
    flex: 1,
  },
  windowCardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  windowCardTime: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  windowRemove: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLDEN_HOUR.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  windowRemoveText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[600],
  },
  windowCounter: {
    fontSize: 13,
    color: BRAND_COLORS.text[600],
    marginTop: 4,
  },

  // Date types
  dateTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dateTypeChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: GOLDEN_HOUR.radius.full,
    backgroundColor: GOLDEN_HOUR.surface,
    borderWidth: 1.5,
    borderColor: GOLDEN_HOUR.borderDefault,
  },
  dateTypeChipSelected: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  dateTypeText: {
    fontSize: 14,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  dateTypeTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  // Note
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  charCounter: {
    fontSize: 13,
    color: BRAND_COLORS.text[600],
  },
  noteInput: {
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
    backgroundColor: GOLDEN_HOUR.inputBg,
    borderRadius: GOLDEN_HOUR.radius.md,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
    color: BRAND_COLORS.text[900],
  },

  // Inline errors
  errorText: {
    fontSize: 13,
    color: BRAND_COLORS.danger,
    marginTop: 8,
  },

  // Sticky CTA
  stickyCTA: {
    paddingHorizontal: SECTION_PADDING,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: GOLDEN_HOUR.bg,
    borderTopWidth: 1,
    borderTopColor: GOLDEN_HOUR.borderDefault,
  },
  ctaSpacer: {
    height: 100,
  },
  submitButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    ...GOLDEN_HOUR.shadow.warm,
  },
  submitButtonDisabled: {
    opacity: 0.4,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
