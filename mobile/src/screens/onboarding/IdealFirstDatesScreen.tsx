/**
 * Ideal First Dates Screen - Phase 5, Step 18
 * OPTIONAL BUT ENFORCED - Up to 3 date ideas or explicit skip
 * Reuses favourite_first_dates field from ProfileScreen
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

export default function IdealFirstDatesScreen() {
  const [dateIdeas, setDateIdeas] = useState<string[]>([]);
  const [newDateIdea, setNewDateIdea] = useState('');
  const [skipped, setSkipped] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExistingDates();
  }, []);

  const loadExistingDates = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('favourite_first_dates')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.favourite_first_dates) {
        const dates = profile.favourite_first_dates as string[];
        if (dates.length === 0 || dates[0] === 'prefer_not_to_say') {
          setSkipped(true);
        } else {
          setDateIdeas(dates);
        }
      }
    } catch (error) {
      console.error('Error loading date ideas:', error);
    }
  };

  const handleAddDateIdea = () => {
    const trimmed = newDateIdea.trim();
    if (trimmed.length === 0) {
      return;
    }

    if (dateIdeas.length >= 3) {
      Alert.alert('Limit reached', 'You can add up to 3 ideal first dates');
      return;
    }

    if (trimmed.length > 60) {
      Alert.alert('Too long', 'Date idea must be 60 characters or less');
      return;
    }

    if (dateIdeas.includes(trimmed)) {
      Alert.alert('Duplicate', 'This date idea is already added');
      return;
    }

    setDateIdeas([...dateIdeas, trimmed]);
    setNewDateIdea('');
    setSkipped(false);
  };

  const handleRemoveDateIdea = (index: number) => {
    setDateIdeas(dateIdeas.filter((_, i) => i !== index));
  };

  const handleSkip = async () => {
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      Alert.alert(
        'Skip Ideal First Dates',
        'Are you sure you want to skip this? You can always add it later from your profile.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ success: false, error: 'Cancelled' }),
          },
          {
            text: 'Skip',
            onPress: () => {
              setSkipped(true);
              setDateIdeas([]);
              setNewDateIdea('');
              resolve({ success: true });
            },
          },
        ]
      );
    });
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const datesToSave = skipped ? [] : dateIdeas;

      const { error } = await supabase
        .from('profiles')
        .update({
          favourite_first_dates: datesToSave,
        })
        .eq('id', user.id);

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save date ideas');
        Alert.alert(title, message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error');
      Alert.alert(title, message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const canContinue = skipped || dateIdeas.length > 0;

  return (
    <BaseOnboardingScreen
      stepId="ideal_first_dates"
      onContinue={handleContinue}
      onSkip={handleSkip}
      canContinue={canContinue}
      loading={loading}
      showSkip={true}
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.instruction}>Share 1-3 ideas for great first dates (optional)</Text>
        <Text style={styles.hint}>This helps others understand what you enjoy doing</Text>

        {dateIdeas.length > 0 && (
          <View style={styles.datesContainer}>
            {dateIdeas.map((dateIdea, index) => (
              <View key={index} style={styles.dateChip}>
                <Text style={styles.dateText}>{dateIdea}</Text>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleRemoveDateIdea(index)}
                  disabled={loading}
                >
                  <Text style={styles.removeText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {dateIdeas.length < 3 && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Add a date idea (max 60 chars)"
              placeholderTextColor={BRAND_COLORS.text[600]}
              value={newDateIdea}
              onChangeText={setNewDateIdea}
              maxLength={60}
              editable={!loading && !skipped}
              onSubmitEditing={handleAddDateIdea}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                (loading || dateIdeas.length >= 3 || newDateIdea.trim().length === 0) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleAddDateIdea}
              disabled={loading || dateIdeas.length >= 3 || newDateIdea.trim().length === 0}
            >
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {dateIdeas.length >= 3 && (
          <Text style={styles.limitText}>Maximum 3 date ideas reached</Text>
        )}

        {skipped && (
          <View style={styles.skippedIndicator}>
            <Text style={styles.skippedText}>Skipped - You can add this later</Text>
          </View>
        )}
      </ScrollView>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    gap: 24,
    paddingBottom: 24,
  },
  instruction: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  datesContainer: {
    gap: 12,
  },
  dateChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.primary + '20',
    borderWidth: 1,
    borderColor: BRAND_COLORS.primary,
    borderRadius: 8,
    padding: 16,
  },
  dateText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
    flex: 1,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  removeText: {
    fontSize: 24,
    color: BRAND_COLORS.danger,
    fontWeight: 'bold',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'BRAND_COLORS.background[50]',
    color: BRAND_COLORS.text[900],
  },
  addButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  limitText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    fontStyle: 'italic',
  },
  skippedIndicator: {
    backgroundColor: BRAND_COLORS.text[100],
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  skippedText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    fontStyle: 'italic',
  },
});
