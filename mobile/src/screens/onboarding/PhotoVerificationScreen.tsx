/**
 * Photo Verification Screen - Phase 6, Step 24
 * NON-SKIPPABLE - Stub implementation for photo verification
 *
 * TODO: Integrate with actual photo verification provider (e.g., Persona, Veriff, etc.)
 * For now, this is a placeholder that allows users to "verify" for testing purposes
 */

import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { supabase } from '../../lib/supabase/client';
import { getErrorAlert } from '../../lib/errors';
import { BRAND_COLORS } from '../../config/brand';

export default function PhotoVerificationScreen() {
  const [verificationStatus, setVerificationStatus] = useState<
    'pending' | 'processing' | 'verified'
  >('pending');
  const [loading, setLoading] = useState(false);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);

  const handleTakeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need camera access to verify your identity.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelfieUri(result.assets[0].uri);
      handleVerify(selfieUri || result.assets[0].uri);
    }
  };

  const handleVerify = async (uri: string) => {
    setVerificationStatus('processing');
    setLoading(true);

    try {
      // TODO: Implement actual photo verification with provider
      // For now, simulate verification after a delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mark as verified (stub implementation)
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          photo_verification_status: 'verified',
          photo_verification_timestamp: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setVerificationStatus('verified');
    } catch (error: any) {
      setVerificationStatus('pending');
      const { title, message } = getErrorAlert(error, 'Verification failed');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (verificationStatus !== 'verified') {
      Alert.alert('Verification required', 'Please complete photo verification to continue');
      return { success: false, error: 'Verification not complete' };
    }

    return { success: true };
  };

  return (
    <BaseOnboardingScreen
      stepId="photo_verification"
      onContinue={handleContinue}
      canContinue={verificationStatus === 'verified'}
      loading={loading}
    >
      <View style={styles.content}>
        <Text style={styles.explanation}>
          To ensure a safe and authentic community, we verify your identity with a quick selfie.
          This helps us maintain trust and prevent fake profiles.
        </Text>

        {verificationStatus === 'pending' && (
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleTakeSelfie}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Take Selfie</Text>
          </TouchableOpacity>
        )}

        {verificationStatus === 'processing' && (
          <View style={styles.processingContainer}>
            <Text style={styles.processingText}>Processing verification...</Text>
            <Text style={styles.processingHint}>Please wait while we verify your photo</Text>
          </View>
        )}

        {verificationStatus === 'verified' && (
          <View style={styles.verifiedContainer}>
            <Text style={styles.verifiedIcon}>✓</Text>
            <Text style={styles.verifiedText}>Photo verified successfully!</Text>
          </View>
        )}

        <View style={styles.noteContainer}>
          <Text style={styles.noteTitle}>Note:</Text>
          <Text style={styles.noteText}>
            Your verification photo is secure and will only be used for identity verification. It
            will not be visible to other users.
          </Text>
        </View>
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
    color: BRAND_COLORS.text[700],
    lineHeight: 24,
  },
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  processingContainer: {
    backgroundColor: BRAND_COLORS.primary + '20',
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.primary,
  },
  processingHint: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
  },
  verifiedContainer: {
    backgroundColor: BRAND_COLORS.success + '20',
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  verifiedIcon: {
    fontSize: 48,
    color: BRAND_COLORS.success,
    fontWeight: 'bold',
  },
  verifiedText: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.success,
  },
  noteContainer: {
    backgroundColor: BRAND_COLORS.text[100],
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  noteText: {
    fontSize: 14,
    color: BRAND_COLORS.text[700],
    lineHeight: 20,
  },
});
