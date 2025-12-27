import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../../lib/imageCompression';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS } from '../../config/brand';
import { deletePhotoFromStorage } from '../../lib/storage';
import { getErrorAlert } from '../../lib/errors';
import { sanitizeText, sanitizeMultilineText } from '../../lib/sanitize';
import { addBreadcrumb, clearUserContext } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';
import {
  reconcilePhotos,
  shouldRunReconciliation,
  markReconciliationComplete,
} from '../../lib/reconcilePhotos';

type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function ProfileScreen() {
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Track upload state per photo (by index)
  const [photoUploadStates, setPhotoUploadStates] = useState<Map<number, PhotoUploadState>>(
    new Map()
  );
  // Store original URIs for failed uploads so we can retry without re-selection
  const [failedUploadURIs, setFailedUploadURIs] = useState<Map<number, string>>(new Map());
  // Track if reconciliation has been run in this session (component-level cache)
  const reconciliationRunRef = useRef(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('prompts, photos')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', 'Failed to load profile');
        setLoading(false);
        return;
      }

      if (profile) {
        const prompts = (profile.prompts as Record<string, string>) || {};
        setHeadline(prompts.headline || '');
        setBio(prompts.bio || '');
        const loadedPhotos = (profile.photos as string[]) || [];
        setPhotos(loadedPhotos);

        // Run reconciliation if needed (cached to max once per 24h AND once per session)
        // Component-level cache prevents multiple runs if user navigates away/back
        const shouldReconcile = await shouldRunReconciliation();
        if (shouldReconcile && !reconciliationRunRef.current && loadedPhotos.length > 0) {
          reconciliationRunRef.current = true; // Mark as run in this session
          const reconcileResult = await reconcilePhotos(loadedPhotos, user.id);
          await markReconciliationComplete();

          // If invalid photos found and no network error, prompt user
          if (reconcileResult.invalidUrls.length > 0 && !reconcileResult.hadNetworkError) {
            Alert.alert(
              'Some photos are missing',
              `We found ${reconcileResult.invalidUrls.length} photo(s) that no longer exist. Would you like to remove them from your profile?`,
              [
                {
                  text: 'Keep them',
                  style: 'cancel',
                  onPress: () => {
                    // Keep invalid URLs in UI but show them differently (handled by UI showing broken images)
                    // User can manually remove them later
                  },
                },
                {
                  text: 'Remove',
                  onPress: async () => {
                    // Update profile to remove invalid URLs
                    const updatedPhotos = reconcileResult.validUrls;
                    const { error: updateError } = await supabase.from('profiles').upsert({
                      user_id: user.id,
                      photos: updatedPhotos,
                    });

                    if (updateError) {
                      const { title, message } = getErrorAlert(
                        updateError,
                        'Failed to update profile'
                      );
                      Alert.alert(title, message);
                    } else {
                      setPhotos(updatedPhotos);
                      Alert.alert('Success', 'Broken photos removed from your profile');
                    }
                  },
                },
              ],
              { cancelable: true }
            );
          } else if (reconcileResult.validUrls.length !== loadedPhotos.length) {
            // Some invalid photos but network error - silently update UI to only show valid ones
            // Don't update DB in case it was a temporary network issue
            setPhotos(reconcileResult.validUrls);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const headlineTrimmed = headline.trim();
    const bioTrimmed = bio.trim();

    if (!headlineTrimmed || !bioTrimmed) {
      Alert.alert('Error', 'Please fill in both headline and bio');
      return;
    }

    if (headlineTrimmed.length < 5) {
      Alert.alert('Error', 'Headline must be at least 5 characters');
      return;
    }

    if (bioTrimmed.length < 20) {
      Alert.alert('Error', 'Bio must be at least 20 characters');
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        setSaving(false);
        return;
      }

      // Sanitize user inputs before storing
      const sanitizedHeadline = sanitizeText(headlineTrimmed);
      const sanitizedBio = sanitizeMultilineText(bioTrimmed);

      const { error } = await supabase.from('profiles').upsert({
        user_id: user.id,
        prompts: {
          headline: sanitizedHeadline,
          bio: sanitizedBio,
        },
        photos: photos,
        completion_pct: photos.length >= 1 ? 100 : 50,
      });

      if (error) {
        const { title, message } = getErrorAlert(error, 'Failed to update profile');
        Alert.alert(title, message);
        setSaving(false);
        return;
      }

      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      const { title, message } = getErrorAlert(error, 'Failed to update profile');
      Alert.alert(title, message);
    } finally {
      setSaving(false);
    }
  };

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

      // Convert compressed URI to blob
      const response = await fetch(compressedUri);
      const blob = await response.blob();
      // Use compressed URI for filename extension
      const fileExt = 'jpg'; // Always JPEG after compression
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, blob, {
          contentType: `image/${fileExt}`,
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

      // Check for duplicate photo URL
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

      // Limit to 6 photos max
      const updatedPhotos = [...photos, publicUrl].slice(0, 6);
      setPhotos(updatedPhotos);
      // Track photo upload
      trackEvent('photo_uploaded', {
        photoCount: updatedPhotos.length,
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

  const removePhoto = async (index: number) => {
    const photoToRemove = photos[index];
    if (!photoToRemove) {
      return;
    }

    // Prevent deletion if this photo or any photo is currently uploading
    const uploadState = photoUploadStates.get(index);
    if (uploadState === 'uploading' || uploading) {
      const { title, message } = getErrorAlert(
        'Cannot delete photo while upload is in progress',
        'Upload in Progress'
      );
      Alert.alert(title, message);
      return;
    }

    // Optimistically update UI
    const updatedPhotos = photos.filter((_, i) => i !== index);
    setPhotos(updatedPhotos);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        // Restore photo if not authenticated
        setPhotos(photos);
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Delete from storage (verify deletion succeeds before updating DB)
      const deleteResult = await deletePhotoFromStorage(photoToRemove, user.id);

      if (!deleteResult.success) {
        // Restore photo if deletion failed - don't update DB
        setPhotos(photos);
        const { title, message } = getErrorAlert(
          deleteResult.error || 'Failed to delete photo',
          'Failed to delete photo'
        );
        Alert.alert(title, message);
        return;
      }

      // Storage deletion verified - now update database
      const { error: updateError } = await supabase.from('profiles').upsert({
        user_id: user.id,
        photos: updatedPhotos,
        completion_pct: updatedPhotos.length >= 1 ? 100 : 50,
      });

      if (updateError) {
        // Storage deleted but DB update failed - restore UI
        // Note: We can't restore the deleted storage file, but at least the UI
        // will be consistent. The photo will remain deleted in storage.
        setPhotos(photos);
        const { title, message } = getErrorAlert(updateError, 'Failed to update profile');
        Alert.alert(
          title,
          `${message} Note: Photo was deleted from storage but may need to be re-added.`
        );
      }
    } catch (error: any) {
      // Restore photo on unexpected error
      setPhotos(photos);
      const { title, message } = getErrorAlert(error, 'Failed to delete photo');
      Alert.alert(title, message);
    }
  };

  const handleSignOut = async () => {
    addBreadcrumb('User signing out', 'auth', 'info');
    clearUserContext();
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Manage your profile information</Text>

      <View style={styles.form}>
        <Text style={styles.label}>Headline</Text>
        <TextInput
          style={styles.input}
          placeholder="A short, catchy headline"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={headline}
          onChangeText={setHeadline}
          maxLength={100}
          editable={!saving}
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell people about yourself..."
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={4}
          maxLength={500}
          editable={!saving}
        />

        <Text style={styles.label}>Photos</Text>
        <View style={styles.photosContainer}>
          {photos.map((photo, index) => {
            const uploadState = photoUploadStates.get(index);
            const isUploading = uploadState === 'uploading';
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
                    <ActivityIndicator color="#fff" size="small" />
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
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(index)}
                  disabled={saving || isUploading}
                >
                  <Text style={styles.removePhotoText}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
          {photos.length < 6 && (
            <TouchableOpacity
              style={styles.addPhotoButton}
              onPress={pickImage}
              disabled={uploading || saving}
            >
              {uploading ? (
                <ActivityIndicator color={BRAND_COLORS.primary} />
              ) : (
                <Text style={styles.addPhotoText}>+ Add Photo</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: BRAND_COLORS.text[600],
    marginBottom: 32,
  },
  form: {
    gap: 16,
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#F8FAFC',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
    zIndex: 1,
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
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  retryText: {
    color: BRAND_COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
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
    backgroundColor: '#F8FAFC',
  },
  addPhotoText: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: BRAND_COLORS.danger,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
