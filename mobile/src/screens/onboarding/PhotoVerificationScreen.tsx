import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';

export default function PhotoVerificationScreen() {
  const [verificationPhoto, setVerificationPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera permission required',
        'Please enable camera access in your device settings to verify your photo.'
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setVerificationPhoto(result.assets[0].uri);
      }
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to take photo');
      Alert.alert(title, message);
    }
  };

  const handleContinue = async (isSkipping = false) => {
    if (!isSkipping && !verificationPhoto) {
      Alert.alert('Photo required', 'Please take a verification photo to continue');
      return;
    }

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

      // Get current profile to merge prompts
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;

      let photoVerificationData: Record<string, any>;

      if (isSkipping) {
        // User is skipping - mark as skipped
        photoVerificationData = {
          status: 'skipped',
          skipped_at: new Date().toISOString(),
        };
      } else {
        // Upload verification photo
        const photoResponse = await fetch(verificationPhoto!);
        const photoBlob = await photoResponse.blob();
        const fileName = `${user.id}/verification/${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('profiles')
          .upload(fileName, photoBlob, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          const { title, message } = getErrorAlert(
            uploadError,
            'Failed to upload verification photo'
          );
          Alert.alert(title, message);
          setLoading(false);
          return;
        }

        // Get public URL
        const {
          data: { publicUrl },
        } = supabase.storage.from('profiles').getPublicUrl(fileName);

        photoVerificationData = {
          status: 'pending',
          photo_url: publicUrl,
          completed_at: new Date().toISOString(),
        };
      }

      // Complete onboarding: save photo verification and mark signup as complete
      const { error: updateError } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: {
          ...currentPrompts,
          photo_verification: photoVerificationData,
        },
        completion_pct: 100,
        signup_completed: true,
      });

      if (updateError) {
        const { title, message } = getErrorAlert(updateError, 'Failed to complete profile');
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      // Track completion
      trackEvent('onboarding_completed', {
        hasPhoto: !isSkipping,
        photoVerificationSkipped: isSkipping,
      });

      // Trigger App.tsx to re-evaluate routing by refreshing the session
      // This causes onAuthStateChange to fire with a new access token,
      // which triggers bootstrapApp to re-fetch profile and update routing
      await supabase.auth.refreshSession();

      // App.tsx will now automatically route to MainNavigator
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to complete verification');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Immediately skip without confirmation
    await handleContinue(true);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Photo Verification</Text>
      <Text style={styles.subtitle}>
        Take a live selfie to verify your identity. This helps keep our community safe and
        authentic.
      </Text>

      <View style={styles.form}>
        {verificationPhoto ? (
          <View style={styles.photoContainer}>
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoText}>Photo captured</Text>
            </View>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={handleTakePhoto}
              disabled={loading}
            >
              <Text style={styles.retakeButtonText}>Retake</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.captureButton}
            onPress={handleTakePhoto}
            disabled={loading}
          >
            <Text style={styles.captureButtonText}>Take Verification Photo</Text>
          </TouchableOpacity>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Why we verify photos:</Text>
          <Text style={styles.infoText}>
            • Prevents fake profiles{'\n'}• Builds trust in the community{'\n'}• Keeps everyone safe
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.skipButton, loading && styles.buttonDisabled]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, (!verificationPhoto || loading) && styles.buttonDisabled]}
            onPress={() => handleContinue()}
            disabled={!verificationPhoto || loading}
          >
            {loading ? (
              <ActivityIndicator color={BRAND_COLORS.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Finish</Text>
            )}
          </TouchableOpacity>
        </View>
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
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
    lineHeight: 24,
  },
  form: {
    gap: 24,
  },
  photoContainer: {
    gap: 16,
  },
  photoPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: GOLDEN_HOUR.inputBg,
    borderRadius: GOLDEN_HOUR.radius.lg,
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoText: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
  },
  captureButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 20,
    borderRadius: GOLDEN_HOUR.radius.md,
    alignItems: 'center',
    ...GOLDEN_HOUR.glow.primary,
  },
  captureButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  retakeButton: {
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    paddingVertical: 12,
    borderRadius: GOLDEN_HOUR.radius.sm,
    alignItems: 'center',
  },
  retakeButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  infoBox: {
    padding: 16,
    backgroundColor: GOLDEN_HOUR.inputBg,
    borderRadius: GOLDEN_HOUR.radius.sm,
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
  },
  skipButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  button: {
    flex: 2,
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
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
