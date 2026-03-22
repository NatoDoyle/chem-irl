import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent, type AnalyticsEvent } from '../../lib/analytics';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

interface OnboardingSaveConfig {
  /** Dot-path into prompts to set the value, e.g. 'demographics.gender' or 'preferences.job_title' */
  fieldPath: string;
  /** Screen name to navigate to after save */
  nextScreen: keyof OnboardingStackParamList;
  /** Analytics event name */
  eventName: AnalyticsEvent;
}

/**
 * Sets a value at a dot-separated path within an object, merging at each level.
 *
 * Example: setAtPath({}, 'demographics.gender', 'male')
 *   => { demographics: { gender: 'male' } }
 */
function setAtPath(obj: Record<string, any>, path: string, value: any): Record<string, any> {
  const parts = path.split('.');
  if (parts.length === 1) {
    return { ...obj, [parts[0]]: value };
  }

  const [head, ...rest] = parts;
  const nested = (obj[head] || {}) as Record<string, any>;
  return {
    ...obj,
    [head]: setAtPath(nested, rest.join('.'), value),
  };
}

/**
 * Shared hook for onboarding screens that save a single field into profiles.prompts.
 *
 * Encapsulates the fetch-merge-upsert-navigate-track pattern used by most onboarding screens.
 */
export function useOnboardingSave(config: OnboardingSaveConfig) {
  const { fieldPath, nextScreen, eventName } = config;
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  const [loading, setLoading] = useState(false);

  const save = async (value: any) => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { title, message } = getErrorAlert('Not authenticated', 'Authentication Error');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Fetch current prompts to merge
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;
      const updatedPrompts = setAtPath(currentPrompts, fieldPath, value);

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: updatedPrompts,
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to save');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      trackEvent(eventName);
      navigation.navigate(nextScreen);
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  return { save, loading };
}
