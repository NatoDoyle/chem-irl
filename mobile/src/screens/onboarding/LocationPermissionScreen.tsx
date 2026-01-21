/**
 * Location Permission Screen - Phase 2, Step 8
 * NON-SKIPPABLE - Must grant location permission
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, Linking, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

export default function LocationPermissionScreen() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkPermissionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      const granted = status === 'granted';

      setPermissionGranted(granted);

      // If already granted, update database
      if (granted) {
        await savePermissionStatus(true);
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
    } finally {
      setChecking(false);
    }
  };

  const requestPermission = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setPermissionGranted(true);
        await savePermissionStatus(true);

        // Get current location
        try {
          const location = await Location.getCurrentPositionAsync({});
          await saveLocation(location.coords.latitude, location.coords.longitude);
        } catch (locError) {
          console.warn('Failed to get current location:', locError);
          // Non-fatal, permission is what matters
        }
      } else {
        Alert.alert(
          'Permission Required',
          'Location permission is required to show nearby matches. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      }
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Error requesting permission');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const savePermissionStatus = async (granted: boolean) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ location_permission_granted: granted })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to save permission status:', error);
      }
    } catch (error) {
      console.error('Error saving permission status:', error);
    }
  };

  const saveLocation = async (lat: number, lng: number) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({
          last_known_lat: lat,
          last_known_lng: lng,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to save location:', error);
      }
    } catch (error) {
      console.error('Error saving location:', error);
    }
  };

  const handleContinue = async () => {
    if (!permissionGranted) {
      Alert.alert('Error', 'Location permission is required to proceed');
      return { success: false, error: 'Permission not granted' };
    }

    return { success: true };
  };

  if (checking) {
    return (
      <BaseOnboardingScreen
        stepId="location_permission"
        onContinue={handleContinue}
        canContinue={false}
        loading={true}
      >
        <View style={styles.content}>
          <Text style={styles.text}>Checking permission status...</Text>
        </View>
      </BaseOnboardingScreen>
    );
  }

  return (
    <BaseOnboardingScreen
      stepId="location_permission"
      onContinue={handleContinue}
      canContinue={permissionGranted}
      loading={loading}
    >
      <View style={styles.content}>
        <Text style={styles.explanation}>
          We need your location to show you nearby matches. We only use your location to find people
          in your area - we don't track your location in the background.
        </Text>

        {!permissionGranted && (
          <TouchableOpacity
            style={[styles.requestButton, loading && styles.buttonDisabled]}
            onPress={requestPermission}
            disabled={loading}
          >
            <Text style={styles.requestButtonText}>Enable Location</Text>
          </TouchableOpacity>
        )}

        {permissionGranted && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>✓ Location permission granted</Text>
          </View>
        )}
      </View>
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 24,
  },
  explanation: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    lineHeight: 24,
  },
  requestButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  requestButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successContainer: {
    backgroundColor: BRAND_COLORS.success + '20',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    color: BRAND_COLORS.success,
    fontWeight: '600',
  },
  text: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
  },
});
