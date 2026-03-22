import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BRAND_COLORS, GOLDEN_HOUR } from '../config/brand';
import { DAY_OF_WEEK_OPTIONS } from '../config/profileOptions';
import type { WeeklySlot, DayOfWeek } from '../lib/types';

interface AvailabilitySlotPickerProps {
  onAdd: (slot: WeeklySlot) => void;
  disabled?: boolean;
}

type PickerStep = 'idle' | 'day' | 'start-time' | 'end-time';

function dateToHHMM(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export default function AvailabilitySlotPicker({ onAdd, disabled }: AvailabilitySlotPickerProps) {
  const [step, setStep] = useState<PickerStep>('idle');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek | null>(null);
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(18, 0, 0, 0);
    return d;
  });
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = new Date();
    d.setHours(20, 0, 0, 0);
    return d;
  });

  const reset = () => {
    setStep('idle');
    setSelectedDay(null);
    const defaultStart = new Date();
    defaultStart.setHours(18, 0, 0, 0);
    setStartTime(defaultStart);
    const defaultEnd = new Date();
    defaultEnd.setHours(20, 0, 0, 0);
    setEndTime(defaultEnd);
  };

  const handleDaySelect = (day: DayOfWeek) => {
    setSelectedDay(day);
    setStep('start-time');
  };

  const handleStartTimeChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        reset();
        return;
      }
      if (selected) {
        setStartTime(selected);
        setTimeout(() => setStep('end-time'), 100);
      }
      return;
    }
    // iOS: update value inline, user confirms with button
    if (selected) setStartTime(selected);
  };

  const handleEndTimeChange = (event: any, selected?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        reset();
        return;
      }
      if (selected) {
        setEndTime(selected);
        handleConfirm(selected);
      }
      return;
    }
    // iOS: update value inline, user confirms with button
    if (selected) setEndTime(selected);
  };

  const handleConfirm = (overrideEndTime?: Date) => {
    if (!selectedDay) return;
    const finalEndTime = overrideEndTime ?? endTime;
    const slot: WeeklySlot = {
      day: selectedDay,
      start_time: dateToHHMM(startTime),
      end_time: dateToHHMM(finalEndTime),
    };
    onAdd(slot);
    reset();
  };

  if (step === 'idle') {
    return (
      <TouchableOpacity style={styles.addButton} onPress={() => setStep('day')} disabled={disabled}>
        <Text style={styles.addButtonText}>+ Add Time Slot</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {step === 'day' && (
        <View>
          <Text style={styles.stepLabel}>Select a day</Text>
          <View style={styles.dayGrid}>
            {DAY_OF_WEEK_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.dayChip, selectedDay === opt.value && styles.dayChipSelected]}
                onPress={() => handleDaySelect(opt.value)}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    selectedDay === opt.value && styles.dayChipTextSelected,
                  ]}
                >
                  {opt.shortLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cancelButton} onPress={reset}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'start-time' && (
        <View>
          <Text style={styles.stepLabel}>Start time</Text>
          <DateTimePicker
            value={startTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleStartTimeChange}
            minuteInterval={15}
          />
          {Platform.OS === 'ios' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={reset}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('end-time')}>
                <Text style={styles.primaryButtonText}>Next: End Time</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {step === 'end-time' && (
        <View>
          <Text style={styles.stepLabel}>End time</Text>
          <DateTimePicker
            value={endTime}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleEndTimeChange}
            minuteInterval={15}
          />
          {Platform.OS === 'ios' && (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryButton} onPress={reset}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={() => handleConfirm()}>
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: GOLDEN_HOUR.inputBg,
    borderRadius: 12,
    padding: 16,
  },
  addButton: {
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
    borderStyle: 'dashed',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLORS.text[700],
    marginBottom: 8,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: GOLDEN_HOUR.borderDefault,
    backgroundColor: GOLDEN_HOUR.inputBg,
  },
  dayChipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: '#D1FFFB',
  },
  dayChipText: {
    fontSize: 14,
    color: BRAND_COLORS.text[700],
    fontWeight: '500',
  },
  dayChipTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: BRAND_COLORS.text[600],
    fontSize: 14,
  },
});
