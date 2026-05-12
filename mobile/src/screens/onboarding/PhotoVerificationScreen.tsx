// PhotoVerificationScreen — mandatory step that runs the moderate-photo
// edge function against every gallery photo (safety) and against the
// freshly taken selfie ↔ each gallery photo (match), then writes
// verification_status to profiles. Sits between Photos and
// LocationPermission in OnboardingNavigator (flag-gated).

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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, GOLDEN_HOUR, TYPOGRAPHY } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import { trackEvent } from '../../lib/analytics';
import { addBreadcrumb } from '../../lib/sentry';
import { extractStoragePathFromUrl } from '../../lib/storage';
import {
  moderatePhoto,
  PhotoModerationError,
  type SafetyResult,
  type MatchResult,
} from '../../lib/photoModeration';
import type { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type NavProp = NativeStackNavigationProp<OnboardingStackParamList, 'PhotoVerification'>;

// Match threshold (mirror of the prompt — clients decide how to act).
const MATCH_CONFIDENCE_THRESHOLD = 0.7;

type Stage =
  | { kind: 'intro' }
  | { kind: 'uploading_selfie' }
  | {
      kind: 'scanning';
      phase: 'safety' | 'match';
      completed: number;
      total: number;
    }
  | { kind: 'success'; status: 'verified' | 'pending_review' }
  | {
      kind: 'failure';
      reason: 'blocked' | 'no_match' | 'no_face' | 'error';
      detail: string;
    };

export default function PhotoVerificationScreen() {
  const navigation = useNavigation<NavProp>();
  const [stage, setStage] = useState<Stage>({ kind: 'intro' });
  const [retryCount, setRetryCount] = useState(0);

  const startVerification = async () => {
    trackEvent('verification_started');
    addBreadcrumb('photo-verification:start', 'photo-verification', 'info');

    // 1. Camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Camera permission required',
        'Please enable camera access in your device settings to verify your photo.'
      );
      return;
    }

    // 2. Capture selfie
    let selfieUri: string;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [1, 1],
        quality: 0.8,
        cameraType: ImagePicker.CameraType.front,
      });
      if (result.canceled || !result.assets[0]) return;
      selfieUri = result.assets[0].uri;
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to take photo');
      Alert.alert(title, message);
      return;
    }

    // 3. Identify user + load gallery photo URLs
    setStage({ kind: 'uploading_selfie' });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Authentication Error', 'Not authenticated');
      setStage({ kind: 'intro' });
      return;
    }

    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('photos')
      .eq('id', user.id)
      .maybeSingle();
    if (profileErr) {
      Alert.alert('Failed to load profile', profileErr.message);
      setStage({ kind: 'intro' });
      return;
    }
    const galleryUrls = ((profileRow?.photos as string[] | null) ?? []).filter(
      (u): u is string => typeof u === 'string' && u.length > 0
    );
    if (galleryUrls.length === 0) {
      Alert.alert('No photos to verify', 'Please add at least one photo before verification.', [
        { text: 'Back to photos', onPress: () => navigation.goBack() },
      ]);
      setStage({ kind: 'intro' });
      return;
    }
    const galleryPaths: string[] = [];
    for (const url of galleryUrls) {
      const p = extractStoragePathFromUrl(url, 'profiles');
      if (p) galleryPaths.push(p);
    }
    if (galleryPaths.length === 0) {
      Alert.alert('Could not resolve photos', 'Please re-upload your photos and try again.');
      setStage({ kind: 'intro' });
      return;
    }

    // 4. Upload selfie to <user>/verification/<ts>.jpg
    const selfiePath = `${user.id}/verification/${Date.now()}.jpg`;
    try {
      const photoResponse = await fetch(selfieUri);
      const photoBlob = await photoResponse.blob();
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(selfiePath, photoBlob, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to upload selfie');
      Alert.alert(title, message);
      setStage({ kind: 'intro' });
      return;
    }
    addBreadcrumb('photo-verification:selfie-uploaded', 'photo-verification', 'info');

    // 5. Run all safety scans in parallel.
    setStage({
      kind: 'scanning',
      phase: 'safety',
      completed: 0,
      total: galleryPaths.length,
    });
    let safetyResults: SafetyResult[];
    try {
      safetyResults = await Promise.all(
        galleryPaths.map(async (p) => {
          const r = await moderatePhoto({ kind: 'safety', photoPath: p });
          if (r.kind !== 'safety') {
            throw new PhotoModerationError('unexpected_kind', 502, r);
          }
          return r;
        })
      );
    } catch (error) {
      handleModerationError(error);
      return;
    }
    safetyResults.forEach((r) =>
      trackEvent('photo_safety_scanned', {
        decision: r.decision,
        riskScore: r.overallRiskScore,
        isOnboarding: true,
      })
    );

    const blocked = safetyResults.find((r) => r.decision === 'blocked');
    if (blocked) {
      const worst = worstCategory(blocked);
      addBreadcrumb('photo-verification:safety-blocked', 'photo-verification', 'warning', {
        worstCategory: worst,
      });
      trackEvent('verification_blocked', { worstCategory: worst });
      setStage({
        kind: 'failure',
        reason: 'blocked',
        detail: `Photo flagged: ${humanCategory(worst)}. ${blocked.recommendedAction}`,
      });
      return;
    }
    const hasReview = safetyResults.some((r) => r.decision === 'review');

    // 6. Sequential match calls, short-circuit on first confident match.
    setStage({
      kind: 'scanning',
      phase: 'match',
      completed: 0,
      total: galleryPaths.length,
    });

    let matchFound: MatchResult | null = null;
    let allNoFace = true;
    let i = 0;
    for (const galleryPath of galleryPaths) {
      let r: MatchResult;
      try {
        const out = await moderatePhoto({
          kind: 'match',
          photoPath: selfiePath,
          comparePath: galleryPath,
        });
        if (out.kind !== 'match') {
          throw new PhotoModerationError('unexpected_kind', 502, out);
        }
        r = out;
      } catch (error) {
        handleModerationError(error);
        return;
      }
      i += 1;
      setStage({
        kind: 'scanning',
        phase: 'match',
        completed: i,
        total: galleryPaths.length,
      });
      trackEvent('photo_match_checked', {
        decision: r.decision,
        confidence: r.confidence,
        isOnboarding: true,
      });
      if (r.decision !== 'no_face_detected') allNoFace = false;
      if (r.decision === 'match' && r.confidence >= MATCH_CONFIDENCE_THRESHOLD) {
        matchFound = r;
        break;
      }
    }

    if (!matchFound) {
      const reason: 'no_match' | 'no_face' = allNoFace ? 'no_face' : 'no_match';
      addBreadcrumb('photo-verification:no-match-found', 'photo-verification', 'warning', {
        reason,
      });
      setStage({
        kind: 'failure',
        reason,
        detail:
          reason === 'no_face'
            ? "We couldn't find your face in any of your photos. Add at least one clear photo of you."
            : "Your selfie doesn't match any of your photos. Make sure the photos show you clearly.",
      });
      return;
    }

    // 7. Persist outcome on profiles.
    const finalStatus: 'verified' | 'pending_review' = hasReview ? 'pending_review' : 'verified';
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        verification_status: finalStatus,
        verification_completed_at: new Date().toISOString(),
        verification_selfie_path: selfiePath,
      })
      .eq('id', user.id);
    if (updateError) {
      Alert.alert('Failed to save verification', updateError.message);
      setStage({ kind: 'failure', reason: 'error', detail: updateError.message });
      return;
    }

    trackEvent('verification_completed', { status: finalStatus });
    if (hasReview) {
      trackEvent('verification_review_required', {
        categoriesAtMedium: safetyResults.filter((r) => r.decision === 'review').length,
      });
    }
    setStage({ kind: 'success', status: finalStatus });
  };

  const handleModerationError = (error: unknown) => {
    addBreadcrumb('photo-verification:edge-fn-error', 'photo-verification', 'error', {
      error: error instanceof Error ? error.message : String(error),
    });
    const detail =
      error instanceof PhotoModerationError
        ? error.message
        : 'Verification service is unavailable.';
    setStage({ kind: 'failure', reason: 'error', detail });
  };

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    trackEvent('verification_retry', { attemptNumber: retryCount + 1 });
    setStage({ kind: 'intro' });
  };

  const handleEditPhotos = () => {
    navigation.goBack();
  };

  const handleContinueAfterSuccess = () => {
    navigation.navigate('LocationPermission');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Photo Verification</Text>
      <Text style={styles.subtitle}>
        Take a quick front-facing selfie so we can confirm you're a real person and that the photos
        on your profile are really you.
      </Text>

      {stage.kind === 'intro' && (
        <View style={styles.form}>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              {`• You take a live selfie with the front camera\n` +
                `• We scan your photos for unsafe content\n` +
                `• We compare your selfie to your photos\n` +
                `• None of this is shared with other users`}
            </Text>
          </View>
          <Text style={styles.consent}>
            Your selfie is sent to our AI safety service to confirm your identity. You can delete it
            from Settings at any time.
          </Text>
          <TouchableOpacity style={styles.captureButton} onPress={startVerification}>
            <Text style={styles.captureButtonText}>Take selfie</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage.kind === 'uploading_selfie' && (
        <View style={styles.statusCard}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.statusText}>Uploading your selfie…</Text>
        </View>
      )}

      {stage.kind === 'scanning' && (
        <View style={styles.statusCard}>
          <ActivityIndicator color={BRAND_COLORS.primary} size="large" />
          <Text style={styles.statusText}>
            {stage.phase === 'safety' ? 'Scanning your photos…' : 'Verifying it’s you…'}
          </Text>
          <Text style={styles.statusSubText}>
            {stage.completed} of {stage.total}
          </Text>
        </View>
      )}

      {stage.kind === 'success' && (
        <View style={[styles.statusCard, styles.successCard]}>
          <Text style={styles.successTitle}>
            {stage.status === 'verified' ? 'Verified ✓' : 'Verification pending'}
          </Text>
          <Text style={styles.statusSubText}>
            {stage.status === 'verified'
              ? 'You’re all set.'
              : 'We’ll review your photos within 24 hours. You can keep going for now.'}
          </Text>
          <TouchableOpacity style={styles.captureButton} onPress={handleContinueAfterSuccess}>
            <Text style={styles.captureButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}

      {stage.kind === 'failure' && (
        <View style={[styles.statusCard, styles.failureCard]}>
          <Text style={styles.failureTitle}>
            {stage.reason === 'blocked'
              ? 'Photo not allowed'
              : stage.reason === 'no_face'
                ? 'No face detected'
                : stage.reason === 'no_match'
                  ? "Couldn't verify it's you"
                  : 'Verification failed'}
          </Text>
          <Text style={styles.statusSubText}>{stage.detail}</Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleEditPhotos}>
              <Text style={styles.secondaryButtonText}>Edit my photos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={handleRetry}>
              <Text style={styles.captureButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function worstCategory(result: SafetyResult): string {
  if (!Array.isArray(result.categories) || result.categories.length === 0) {
    return 'authenticity';
  }
  const order: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
  let worst = result.categories[0];
  for (const c of result.categories) {
    if ((order[c.severity] ?? 0) > (order[worst.severity] ?? 0)) worst = c;
  }
  return worst.name;
}

function humanCategory(name: string): string {
  switch (name) {
    case 'sexual_nude':
      return 'sexual or nude content';
    case 'violence':
      return 'violence or gore';
    case 'weapons':
      return 'weapons';
    case 'drugs':
      return 'drugs or substances';
    case 'hate':
      return 'hate symbols';
    case 'minors':
      return 'minors safety';
    case 'spam_scam':
      return 'spam or scam content';
    case 'authenticity':
      return 'photo authenticity';
    default:
      return name;
  }
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
    marginBottom: 24,
    lineHeight: 24,
  },
  form: {
    gap: 16,
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
  consent: {
    fontSize: 12,
    color: BRAND_COLORS.text[600],
    lineHeight: 18,
    fontStyle: 'italic',
  },
  captureButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.md,
    alignItems: 'center',
    ...GOLDEN_HOUR.glow.primary,
  },
  captureButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  statusCard: {
    marginTop: 24,
    padding: 24,
    backgroundColor: GOLDEN_HOUR.surface,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    gap: 12,
  },
  successCard: {
    backgroundColor: 'rgba(22, 163, 74, 0.10)',
  },
  failureCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.10)',
  },
  statusText: {
    fontSize: 18,
    color: BRAND_COLORS.text[900],
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  statusSubText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    lineHeight: 20,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  failureTitle: {
    fontSize: 22,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: GOLDEN_HOUR.borderDefault,
    paddingVertical: 14,
    borderRadius: GOLDEN_HOUR.radius.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: BRAND_COLORS.text[700],
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
