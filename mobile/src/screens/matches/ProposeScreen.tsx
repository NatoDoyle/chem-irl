import { useState } from 'react';
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';

type ProposeRouteParams = {
  matchId: string;
  responseTo?: string; // proposal_id if responding to "none suits"
};

type ProposeNavigationProp = NativeStackNavigationProp<any, 'Propose'>;

const DATE_TYPES = ['Coffee', 'Drinks', 'Dinner', 'Walk', 'Activity', 'Other'];

type PickerMode = 'date' | 'start-time' | 'end-time' | null;

export default function ProposeScreen() {
  const route = useRoute();
  const navigation = useNavigation<ProposeNavigationProp>();
  const { matchId } = route.params as ProposeRouteParams;

  const [selectedWindows, setSelectedWindows] = useState<{ start: string; end: string }[]>([]);
  const [selectedDateTypes, setSelectedDateTypes] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [tempWindow, setTempWindow] = useState<{
    date: Date;
    startTime: Date;
    endTime: Date;
  } | null>(null);

  const addTimeWindow = () => {
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

        const hasOverlap = selectedWindows.some((window) => {
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

        if (hasOverlap) {
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

    const hasOverlap = selectedWindows.some((window) => {
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

    if (hasOverlap) {
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

    // Validate all windows are within 7 days
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const invalidWindow = selectedWindows.find((window) => {
      const windowDate = new Date(window.start);
      return windowDate > sevenDaysFromNow || windowDate < now;
    });

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

      // Calculate expiry (72 hours from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      const { error } = await supabase.from('proposals').insert({
        match_id: matchId,
        sender_id: user.id,
        windows: selectedWindows,
        date_types: selectedDateTypes,
        note: note.trim() || null,
        expires_at: expiresAt.toISOString(),
        status: 'active',
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to send proposal');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      Alert.alert('Success', 'Proposal sent!');
      navigation.goBack();
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to send proposal');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Time Windows (2-3 required)</Text>
        <Text style={styles.sectionSubtitle}>
          Select 2-3 different times within the next 7 days
        </Text>

        {selectedWindows.map((window, index) => (
          <View key={index} style={styles.windowItem}>
            <Text style={styles.windowText}>
              {formatTime(window.start)} - {formatTime(window.end)}
            </Text>
            <TouchableOpacity onPress={() => removeTimeWindow(index)}>
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}

        {selectedWindows.length < 3 && (
          <TouchableOpacity style={styles.addButton} onPress={addTimeWindow}>
            <Text style={styles.addButtonText}>+ Add Time Window</Text>
          </TouchableOpacity>
        )}

        {pickerMode && tempWindow && (
          <View style={styles.pickerContainer}>
            {pickerMode === 'date' && (
              <DateTimePicker
                value={tempWindow.date}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                maximumDate={(() => {
                  const max = new Date();
                  max.setDate(max.getDate() + 7);
                  return max;
                })()}
                onChange={handleDateChange}
              />
            )}
            {pickerMode === 'start-time' && (
              <View>
                <DateTimePicker
                  value={tempWindow.startTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleTimeChange(e, d, 'start')}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setPickerMode('end-time')}
                  >
                    <Text style={styles.pickerButtonText}>Next: End Time</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {pickerMode === 'end-time' && (
              <View>
                <DateTimePicker
                  value={tempWindow.endTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => handleTimeChange(e, d, 'end')}
                />
                {Platform.OS === 'ios' && (
                  <View style={styles.pickerButtonsRow}>
                    <TouchableOpacity
                      style={[styles.pickerButton, styles.pickerButtonSecondary]}
                      onPress={() => {
                        setPickerMode(null);
                        setTempWindow(null);
                      }}
                    >
                      <Text style={styles.pickerButtonSecondaryText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.pickerButton} onPress={confirmTimeWindow}>
                      <Text style={styles.pickerButtonText}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date Types (1-3 required)</Text>
        <View style={styles.dateTypesGrid}>
          {DATE_TYPES.map((type) => (
            <TouchableOpacity
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
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Note (Optional)</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note..."
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Send Proposal</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginBottom: 12,
  },
  windowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  windowText: {
    fontSize: 14,
    color: BRAND_COLORS.text[900],
  },
  removeText: {
    fontSize: 14,
    color: BRAND_COLORS.danger,
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
  pickerContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  pickerButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  pickerButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  pickerButtonSecondaryText: {
    color: BRAND_COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  dateTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  dateTypeButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dateTypeButtonSelected: {
    backgroundColor: BRAND_COLORS.primary,
    borderColor: BRAND_COLORS.primary,
  },
  dateTypeText: {
    fontSize: 14,
    color: BRAND_COLORS.text[900],
  },
  dateTypeTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
