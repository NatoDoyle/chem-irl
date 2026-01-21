import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { compressImage } from '../../lib/imageCompression';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS } from '../../config/brand';
import BaseOnboardingScreen from '../../components/onboarding/BaseOnboardingScreen';
import { markStepResolved } from '../../lib/onboarding/flowGuard';

type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';

/**
 * Convert a local file URI to a Blob, handling Android file:// URIs safely
 * On Android, file:// URIs cannot be fetched directly, so we convert them to content:// URIs
 */
async function uriToBlob(uri: string): Promise<Blob> {
  let fetchUri = uri;

  // On Android, convert file:// URIs to content:// URIs for fetch compatibility
  if (Platform.OS === 'android' && uri.startsWith('file://')) {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);
      if (!contentUri) {
        throw new Error(`getContentUriAsync returned null. Original URI: ${uri}`);
      }
      fetchUri = contentUri;
      if (__DEV__) {
        console.log('[uriToBlob] Android: converted file:// to content:// URI:', fetchUri);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to convert file:// URI to content:// URI on Android. Original URI: ${uri}. Error: ${errorMessage}`
      );
    }
  }

  if (__DEV__) {
    const preview = typeof fetchUri === 'string' ? fetchUri.slice(0, 100) : String(fetchUri);
    console.log('[uriToBlob] Fetching blob from URI:', preview);
  }

  const response = await fetch(fetchUri);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
  }
  return response.blob();
}

// Helper to check if two arrays are equal (by reference and content)
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export default function PhotosScreen() {
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Track upload state per photo (by index)
  const [photoUploadStates, setPhotoUploadStates] = useState<Map<number, PhotoUploadState>>(
    new Map()
  );
  // Store original URIs for failed uploads so we can retry without re-selection
  const [failedUploadURIs, setFailedUploadURIs] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    loadExistingPhotos();
  }, []);

  const loadExistingPhotos = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('photos')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.photos && Array.isArray(profile.photos)) {
        const profilePhotos = profile.photos as string[];
        setPhotos((prev) => (arraysEqual(prev, profilePhotos) ? prev : profilePhotos));
      }
    } catch (error) {
      // Silently fail - user might not have a profile yet
      console.error('Error loading existing photos:', error);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to upload profile pictures.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
    const tempIndex = photos.length; // Index where photo will be added
    setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'uploading'));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        setUploading(false);
        setPhotoUploadStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempIndex);
          return newMap;
        });
        return;
      }

      // Compress image before upload
      const compressedUri = await compressImage(uri);

      // Convert compressed URI to blob (Android-safe)
      const blob = await uriToBlob(compressedUri);
      // Use compressed URI for filename extension
      const fileExt = 'jpg'; // Always JPEG after compression
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'error'));
        // Store URI for retry
        setFailedUploadURIs((prev) => new Map(prev).set(tempIndex, uri));
        Alert.alert('Error', uploadError.message);
        setUploading(false);
        return;
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('profiles').getPublicUrl(fileName);

      // Update profile with new photo
      const { data: profileData } = await supabase
        .from('profiles')
        .select('photos')
        .eq('id', user.id)
        .maybeSingle();

      const existingPhotos = (profileData?.photos as string[]) || [];

      // Check for duplicate photo URL
      if (existingPhotos.includes(publicUrl) || photos.includes(publicUrl)) {
        setPhotoUploadStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(tempIndex);
          return newMap;
        });
        Alert.alert('Duplicate photo', 'This photo is already in your profile.');
        setUploading(false);
        return;
      }

      // Limit to 6 photos max
      const updatedPhotos = [...existingPhotos, publicUrl].slice(0, 6);

      const { error: updateError } = await supabase.from('profiles').upsert({
        id: user.id,
        photos: updatedPhotos,
        completion_pct: updatedPhotos.length >= 1 ? 100 : 50,
      });

      if (updateError) {
        console.error('[PhotosScreen] Supabase upsert error:', {
          error: updateError.message,
          code: (updateError as any).code,
          details: (updateError as any).details,
          hint: (updateError as any).hint,
          photosCount: updatedPhotos.length,
        });
        setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'error'));
        Alert.alert('Error', updateError.message);
        setUploading(false);
        return;
      }

      setPhotos((prev) => (arraysEqual(prev, updatedPhotos) ? prev : updatedPhotos));
      // Track photo upload
      trackEvent('photo_uploaded', {
        photoCount: updatedPhotos.length,
        isOnboarding: true,
      });
      // Clear stored URI on success
      setFailedUploadURIs((prev) => {
        const newMap = new Map(prev);
        newMap.delete(tempIndex);
        return newMap;
      });
      // Mark upload as success, then clear after a brief delay
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
      // Store URI for retry
      setFailedUploadURIs((prev) => new Map(prev).set(tempIndex, uri));
      Alert.alert('Error', error.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const retryUpload = async (index: number) => {
    const storedURI = failedUploadURIs.get(index);
    if (!storedURI) {
      Alert.alert('Error', 'Photo URI not found. Please select the photo again.');
      // Clean up error state if no URI stored
      setPhotoUploadStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
      return;
    }

    // Re-upload using stored URI
    await uploadPhoto(storedURI);
  };

  const handleContinue = async () => {
    if (photos.length < 2) {
      Alert.alert('Photos required', 'Please add at least 2 photos to continue');
      return { success: false, error: 'Minimum 2 photos required' };
    }

    setSaving(true);
    try {
      // Photos are already saved during upload, just mark step as resolved
      const result = await markStepResolved('profile_photos', 'completed');
      if (!result.success) {
        return {
          success: false,
          error: result.error?.message || 'Failed to mark step as complete',
        };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Unknown error' };
    } finally {
      setSaving(false);
    }
  };

  return (
    <BaseOnboardingScreen
      stepId="profile_photos"
      onContinue={handleContinue}
      canContinue={photos.length >= 2}
      loading={saving}
    >
      <View style={styles.photosContainer}>
        {photos.map((photo, index) => {
          const uploadState = photoUploadStates.get(index);
          return (
            <View key={index} style={styles.photoWrapper}>
              <Image
                source={{ uri: photo }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              {uploadState === 'uploading' && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color={BRAND_COLORS.onPrimary} size="small" />
                </View>
              )}
              {uploadState === 'success' && (
                <View style={[styles.uploadOverlay, styles.successOverlay]}>
                  <Text style={styles.checkmark}>✓</Text>
                </View>
              )}
              {uploadState === 'error' && (
                <View style={[styles.uploadOverlay, styles.errorOverlay]}>
                  <Text style={styles.errorText}>!</Text>
                  <TouchableOpacity style={styles.retryButton} onPress={() => retryUpload(index)}>
                    <Text style={styles.retryText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        {photos.length < 6 && (
          <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color={BRAND_COLORS.primary} />
            ) : (
              <Text style={styles.addPhotoText}>+ Add Photo</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
      {photos.length < 2 && (
        <Text style={styles.requirementText}>
          Add at least {2 - photos.length} more photo{2 - photos.length > 1 ? 's' : ''} to continue
        </Text>
      )}
    </BaseOnboardingScreen>
  );
}

const styles = StyleSheet.create({
  requirementText: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 125,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successOverlay: {
    backgroundColor: 'rgba(34, 197, 94, 0.8)',
  },
  errorOverlay: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    flexDirection: 'column',
    gap: 8,
  },
  checkmark: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 32,
    fontWeight: 'bold',
  },
  errorText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: BRAND_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryText: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  addPhotoButton: {
    width: 100,
    height: 125,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'BRAND_COLORS.background[50]',
  },
  addPhotoText: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
