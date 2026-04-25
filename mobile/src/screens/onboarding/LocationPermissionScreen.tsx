import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type LocationPermissionScreenNavigationProp = NativeStackNavigationProp<
  OnboardingStackParamList,
  'LocationPermission'
>;

export default function LocationPermissionScreen() {
  const navigation = useNavigation<LocationPermissionScreenNavigationProp>();
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    setPermissionStatus(status);
  };

  const handleRequestPermission = async () => {
    setRequesting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status === 'granted') {
        // Get current location
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          await saveLocationPermission(location.coords.latitude, location.coords.longitude);
        } catch {
          // Permission granted but location fetch failed - still save permission status
          await saveLocationPermission(null, null);
        }
      } else {
        Alert.alert(
          'Permission required',
          'Location permission is required to show you nearby matches. Please enable it in your device settings.'
        );
      }
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to request permission');
      Alert.alert(title, message);
    } finally {
      setRequesting(false);
    }
  };

  const saveLocationPermission = async (lat: number | null, lng: number | null) => {
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

      // Update profiles.availability JSONB with location permission status
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('availability')
        .eq('id', user.id)
        .maybeSingle();

      const currentAvailability = (currentProfile?.availability ?? {}) as Record<string, any>;

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        availability: {
          ...currentAvailability,
          location_permission_granted: permissionStatus === 'granted',
          last_known_lat: lat,
          last_known_lng: lng,
        },
      });

      if (error) {
        console.error('Error saving location permission:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const { title, message } = getErrorAlert(error, 'Failed to save location permission');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_location_permission_completed', {
        granted: permissionStatus === 'granted',
      });

      navigation.navigate('ProfileReview');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to save location permission');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (permissionStatus === 'granted') {
      navigation.navigate('ProfileReview');
      return;
    }

    if (permissionStatus === 'denied') {
      Alert.alert(
        'Permission denied',
        'Location permission is required. Please enable it in your device settings and return to this screen.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              // On iOS, this will open app settings
              // On Android, user needs to manually navigate
              Alert.alert(
                'Settings',
                'Please go to Settings > Apps > Chem IRL > Permissions and enable Location.'
              );
            },
          },
        ]
      );
      return;
    }

    // Request permission
    await handleRequestPermission();
  };

  const isGranted = permissionStatus === 'granted';
  const isDenied = permissionStatus === 'denied';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Enable location</Text>
      <Text style={styles.subtitle}>
        We use your location to show you nearby matches and help you find dates in your area
      </Text>

      <View style={styles.form}>
        {isGranted && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>✓ Location permission granted</Text>
          </View>
        )}

        {isDenied && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              Location permission is required. Please enable it in your device settings.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, (loading || requesting) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={loading || requesting}
        >
          {loading || requesting ? (
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.buttonText}>
              {isGranted ? 'Continue' : isDenied ? 'Open Settings' : 'Enable Location'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  successContainer: {
    padding: 16,
    backgroundColor: 'rgba(22, 163, 74, 0.15)',
    borderRadius: GOLDEN_HOUR.radius.lg,
    borderWidth: 1,
    borderColor: BRAND_COLORS.success,
  },
  successText: {
    fontSize: 16,
    color: '#34D399',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: GOLDEN_HOUR.radius.lg,
    borderWidth: 1,
    borderColor: BRAND_COLORS.danger,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    marginTop: 8,
    ...GOLDEN_HOUR.shadow.warm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
