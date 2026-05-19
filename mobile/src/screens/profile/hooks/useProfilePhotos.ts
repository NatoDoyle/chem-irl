import { useState } from 'react';
import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { compressImage } from '../../../lib/imageCompression';
import { supabase } from '../../../lib/supabase/client';
import { deletePhotoFromStorage } from '../../../lib/storage';
import { getErrorAlert } from '../../../lib/errors';
import { moderatePhoto, PhotoModerationError } from '../../../lib/photoModeration';
import { addBreadcrumb } from '../../../lib/sentry';
import { trackEvent } from '../../../lib/analytics';

const PHOTO_VERIFICATION_ENABLED = process.env.EXPO_PUBLIC_ENABLE_PHOTO_VERIFICATION === 'true';
const MATCH_CONFIDENCE_THRESHOLD = 0.7;

export type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';
export type PhotoDeletionState = 'idle' | 'deleting';

/**
 * Owns the per-photo upload/delete state machines and the handlers that
 * pick, compress, moderate, upload, retry, and remove profile photos.
 * Photos themselves stay in the parent (ProfileScreen) because the
 * hero avatar and the save payload both read the array — passing them
 * in keeps a single source of truth.
 *
 * Handler bodies are a verbatim move from the original inline screen
 * implementation; only the closure references (photos / setPhotos) are
 * now threaded in through params instead of resolved from the screen's
 * local scope.
 */
export function useProfilePhotos(params: {
  photos: string[];
  setPhotos: (next: string[]) => void;
}): {
  uploading: boolean;
  photoUploadStates: Map<number, PhotoUploadState>;
  photoDeletionStates: Map<number, PhotoDeletionState>;
  pickImage: () => Promise<void>;
  retryUpload: (index: number) => Promise<void>;
  removePhoto: (index: number) => Promise<void>;
} {
  const { photos, setPhotos } = params;

  const [uploading, setUploading] = useState(false);
  const [photoUploadStates, setPhotoUploadStates] = useState<Map<number, PhotoUploadState>>(
    new Map()
  );
  const [photoDeletionStates, setPhotoDeletionStates] = useState<Map<number, PhotoDeletionState>>(
    new Map()
  );
  const [failedUploadURIs, setFailedUploadURIs] = useState<Map<number, string>>(new Map());

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to upload profile pictures.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    setUploading(true);
    const tempIndex = photos.length;
    setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'uploading'));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { title, message } = getErrorAlert('Not authenticated', 'Authentication Error');
        Alert.alert(title, message);
        setUploading(false);
        setPhotoUploadStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempIndex);
          return newMap;
        });
        return;
      }

      const compressedUri = await compressImage(uri);

      const base64 = await FileSystem.readAsStringAsync(compressedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const fileExt = 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, decode(base64), { contentType: 'image/jpeg', upsert: false });

      if (uploadError) {
        setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'error'));
        setFailedUploadURIs((prev) => new Map(prev).set(tempIndex, uri));
        Alert.alert('Error', uploadError.message);
        setUploading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('profiles').getPublicUrl(fileName);

      if (photos.includes(publicUrl)) {
        setPhotoUploadStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempIndex);
          return newMap;
        });
        Alert.alert('Duplicate photo', 'This photo is already in your profile.');
        setUploading(false);
        return;
      }

      // Photo safety + identity-match check (flag-gated). On `blocked`
      // we roll the photo back out of storage; on `review` we demote
      // verification_status; on `match`/`no_match` we only breadcrumb.
      if (PHOTO_VERIFICATION_ENABLED) {
        try {
          const safety = await moderatePhoto({ kind: 'safety', photoPath: fileName });
          if (safety.kind !== 'safety') {
            throw new PhotoModerationError('unexpected_kind', 502, safety);
          }
          trackEvent('photo_safety_scanned', {
            decision: safety.decision,
            riskScore: safety.overallRiskScore,
            isOnboarding: false,
          });
          if (safety.decision === 'blocked') {
            await supabase.storage.from('profiles').remove([fileName]);
            setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'error'));
            Alert.alert(
              'Photo not allowed',
              `${safety.summary} ${safety.recommendedAction}`.trim()
            );
            setUploading(false);
            return;
          }

          // Re-match new gallery photo against the stored verification
          // selfie. Failures here are observational only — pets and
          // scenery are legitimate gallery content.
          const { data: profileForMatch } = await supabase
            .from('profiles')
            .select('verification_selfie_path, verification_status')
            .eq('id', user.id)
            .maybeSingle();
          const row = profileForMatch as {
            verification_selfie_path?: string | null;
            verification_status?: string | null;
          } | null;
          if (row?.verification_selfie_path) {
            const match = await moderatePhoto({
              kind: 'match',
              photoPath: fileName,
              comparePath: row.verification_selfie_path,
            });
            if (match.kind === 'match') {
              trackEvent('photo_match_checked', {
                decision: match.decision,
                confidence: match.confidence,
                isOnboarding: false,
              });
              if (match.decision !== 'match' || match.confidence < MATCH_CONFIDENCE_THRESHOLD) {
                addBreadcrumb(
                  'gallery photo did not match verification selfie',
                  'photo-verification',
                  'warning',
                  { photoPath: fileName, decision: match.decision }
                );
              }
            }
          }

          if (safety.decision === 'review' && row?.verification_status === 'verified') {
            // Only demote, never elevate. If the user wasn't verified
            // before, this no-ops.
            await supabase
              .from('profiles')
              .update({ verification_status: 'pending_review' })
              .eq('id', user.id);
          }
        } catch (modError) {
          // Moderation failure is non-fatal for the user's edit. Log
          // and continue — we'd rather let a borderline photo through
          // than block all profile edits on a Claude outage.
          addBreadcrumb('photo moderation failed (non-fatal)', 'photo-verification', 'error', {
            error: modError instanceof Error ? modError.message : String(modError),
          });
        }
      }

      const updatedPhotos = [...photos, publicUrl].slice(0, 6);
      setPhotos(updatedPhotos);
      trackEvent('photo_uploaded', { photoCount: updatedPhotos.length });
      setFailedUploadURIs((prev) => {
        const newMap = new Map(prev);
        newMap.delete(tempIndex);
        return newMap;
      });
      setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'success'));
      setTimeout(() => {
        setPhotoUploadStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempIndex);
          return newMap;
        });
      }, 1000);
    } catch (error: any) {
      setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'error'));
      setFailedUploadURIs((prev) => new Map(prev).set(tempIndex, uri));
      const { title, message } = getErrorAlert(error, 'Failed to upload photo');
      Alert.alert(title, message);
    } finally {
      setUploading(false);
    }
  };

  const retryUpload = async (index: number) => {
    const storedURI = failedUploadURIs.get(index);
    if (!storedURI) {
      const { title, message } = getErrorAlert(
        'Photo URI not found. Please select the photo again.',
        'Upload Error'
      );
      Alert.alert(title, message);
      setPhotoUploadStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
      return;
    }
    await uploadPhoto(storedURI);
  };

  const removePhoto = async (index: number) => {
    const photoToRemove = photos[index];
    if (!photoToRemove) return;

    const deletionState = photoDeletionStates.get(index);
    if (deletionState === 'deleting') return;

    const uploadState = photoUploadStates.get(index);
    if (uploadState === 'uploading' || uploading) {
      Alert.alert('Upload in Progress', 'Cannot delete photo while upload is in progress');
      return;
    }

    setPhotoDeletionStates((prev) => new Map(prev).set(index, 'deleting'));
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setPhotos(photos);
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      const deleteResult = await deletePhotoFromStorage(photoToRemove, user.id);
      if (!deleteResult.success) {
        setPhotos(photos);
        const { title, message } = getErrorAlert(
          deleteResult.error || 'Failed to delete photo',
          'Failed to delete photo'
        );
        Alert.alert(title, message);
        return;
      }

      const { error: updateError } = await supabase.from('profiles').upsert({
        id: user.id,
        photos: updatedPhotos,
        completion_pct: updatedPhotos.length >= 1 ? 100 : 50,
      });

      if (updateError) {
        setPhotos(photos);
        const { title, message } = getErrorAlert(updateError, 'Failed to update profile');
        Alert.alert(title, message);
      }
    } catch (error: any) {
      setPhotos(photos);
      const { title, message } = getErrorAlert(error, 'Failed to delete photo');
      Alert.alert(title, message);
    } finally {
      setPhotoDeletionStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
    }
  };

  return { uploading, photoUploadStates, photoDeletionStates, pickImage, retryUpload, removePhoto };
}
