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
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
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
type PhotoDeletionState = 'idle' | 'deleting';

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

/**
 * Wraps a promise with a timeout, preserving the promise's return type
 * Clears timeout on resolve/reject to prevent memory leaks
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([
    promise.then(
      (value) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return value;
      },
      (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        throw error;
      }
    ),
    timeoutPromise,
  ]);
}

export default function ProfileScreen() {
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<string[]>([]);
  const [favouriteFirstDates, setFavouriteFirstDates] = useState<string[]>([]);
  const [newDateIdea, setNewDateIdea] = useState('');
  const [loading, setLoading] = useState(true);

  // Clamp bio to 500 characters (match BioScreen validation)
  const handleBioChange = (text: string) => {
    if (text.length <= 500) {
      setBio(text);
    } else {
      setBio(text.substring(0, 500));
    }
  };
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Track upload state per photo (by index)
  const [photoUploadStates, setPhotoUploadStates] = useState<Map<number, PhotoUploadState>>(
    new Map()
  );
  const [photoDeletionStates, setPhotoDeletionStates] = useState<Map<number, PhotoDeletionState>>(
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

      const userId = user.id;
      if (__DEV__) {
        console.log(
          '[ProfileScreen.loadProfile] Querying profile for user:',
          userId.substring(0, 8)
        );
      }

      let { data: profile, error } = await supabase
        .from('profiles')
        .select('prompts, photos, favourite_first_dates, bio')
        .eq('id', userId)
        .maybeSingle();

      if (__DEV__ && error) {
        console.error('[ProfileScreen.loadProfile] Supabase error:', {
          userId: userId.substring(0, 8),
          error: error.message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        });
      }

      // If profile doesn't exist, try to create it
      if (!profile && !error) {
        console.warn(
          '[ProfileScreen.loadProfile] Profile not found, attempting to create:',
          userId.substring(0, 8)
        );
        const { error: createError } = await supabase.from('profiles').upsert(
          {
            id: userId,
            prompts: {} as any,
            availability: {} as any,
            photos: [] as any,
            completion_pct: 0,
            signup_completed: false,
            onboarding: { currentStepId: null, resolvedSteps: {} } as any,
            terms_accepted: false,
          },
          { onConflict: 'id' }
        );

        if (createError) {
          console.error('[ProfileScreen.loadProfile] Failed to create profile:', {
            userId: userId.substring(0, 8),
            error: createError.message,
            code: (createError as any).code,
            details: (createError as any).details,
            hint: (createError as any).hint,
          });
          Alert.alert('Error', 'Failed to load or create profile');
          setLoading(false);
          return;
        }

        // Re-fetch profile after creation
        const { data: newProfile, error: refetchError } = await supabase
          .from('profiles')
          .select('prompts, photos, favourite_first_dates, bio')
          .eq('id', userId)
          .maybeSingle();

        if (refetchError || !newProfile) {
          console.error('[ProfileScreen.loadProfile] Failed to refetch after creation:', {
            userId: userId.substring(0, 8),
            error: refetchError?.message,
          });
          Alert.alert('Error', 'Failed to load profile');
          setLoading(false);
          return;
        }

        profile = newProfile;
      }

      if (error) {
        console.error('[ProfileScreen.loadProfile] Error loading profile:', {
          userId: userId.substring(0, 8),
          error: error.message,
          code: (error as any).code,
          details: (error as any).details,
          hint: (error as any).hint,
        });
        Alert.alert('Error', 'Failed to load profile');
        setLoading(false);
        return;
      }

      if (profile) {
        const loadedPrompts = (profile.prompts as Record<string, string>) || {};
        setPrompts(loadedPrompts);
        setHeadline(loadedPrompts.headline || '');
        // Prefer bio column, fallback to prompts.bio for backwards compatibility
        setBio((profile.bio as string) || loadedPrompts.bio || '');
        const loadedPhotos = (profile.photos as string[]) || [];
        setPhotos(loadedPhotos);
        const loadedDates = (profile.favourite_first_dates as string[]) || [];
        setFavouriteFirstDates(loadedDates);

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
                      id: user.id,
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
      const { title, message } = getErrorAlert(error, 'Failed to load profile');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDateIdea = () => {
    const trimmed = newDateIdea.trim();

    // Validate: no empty
    if (trimmed.length === 0) {
      Alert.alert('Error', 'Please enter a date idea');
      return;
    }

    // Validate: max length 60 chars
    if (trimmed.length > 60) {
      Alert.alert('Error', 'Date idea must be 60 characters or less');
      return;
    }

    // Validate: no duplicates (case-insensitive)
    const isDuplicate = favouriteFirstDates.some(
      (date) => date.toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      Alert.alert('Error', 'This date idea already exists');
      return;
    }

    // Validate: max 3 items
    if (favouriteFirstDates.length >= 3) {
      Alert.alert('Error', 'You can only have up to 3 favourite first dates');
      return;
    }

    setFavouriteFirstDates([...favouriteFirstDates, trimmed]);
    setNewDateIdea('');
  };

  const handleRemoveDateIdea = (index: number) => {
    setFavouriteFirstDates(favouriteFirstDates.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const headlineTrimmed = headline.trim();
    const bioTrimmed = bio.trim();

    // Validate bio max length only (no min length, no required fields)
    if (bioTrimmed.length > 500) {
      Alert.alert('Error', 'Bio must be 500 characters or less');
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        const { title, message } = getErrorAlert('Not authenticated', 'Authentication Error');
        Alert.alert(title, message);
        setSaving(false);
        return;
      }

      // Sanitize user inputs before storing (set to null if empty)
      const sanitizedHeadline = headlineTrimmed.length > 0 ? sanitizeText(headlineTrimmed) : null;
      const sanitizedBio = bioTrimmed.length > 0 ? sanitizeMultilineText(bioTrimmed) : null;

      // Merge with existing prompts to preserve other keys
      const mergedPrompts = {
        ...prompts,
        ...(sanitizedHeadline !== null && { headline: sanitizedHeadline }),
      };

      // Remove legacy prompts.bio to prevent divergence (bio is now in bio column)
      delete (mergedPrompts as any).bio;

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        prompts: mergedPrompts,
        bio: sanitizedBio,
        photos: photos,
        favourite_first_dates: favouriteFirstDates,
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

    // Prevent deletion if this photo is already being deleted
    const deletionState = photoDeletionStates.get(index);
    if (deletionState === 'deleting') {
      return; // Already deleting, ignore duplicate request
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

    // Mark as deleting to prevent duplicate deletions
    setPhotoDeletionStates((prev) => new Map(prev).set(index, 'deleting'));

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
        const { title, message } = getErrorAlert('Not authenticated', 'Authentication Error');
        Alert.alert(title, message);
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
    } finally {
      // Clear deletion state
      setPhotoDeletionStates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(index);
        return newMap;
      });
    }
  };

  const handleSignOut = async () => {
    // Re-entrancy guard: prevent multiple simultaneous sign-out attempts
    if (signingOut) {
      console.log('[ProfileScreen] handleSignOut: already in progress, ignoring');
      return;
    }

    console.log('[ProfileScreen] handleSignOut: pressed');

    setSigningOut(true);
    try {
      // Check session before signOut (inside try block)
      const { data: sessionBefore } = await supabase.auth.getSession();
      console.log(
        '[ProfileScreen] handleSignOut: session exists before =',
        !!sessionBefore.session
      );

      addBreadcrumb('User signing out', 'auth', 'info');

      console.log('[ProfileScreen] handleSignOut: calling signOut with scope=local');

      // Use scope: 'local' for instant local sign-out
      // Wrap signOut in a timeout to prevent UI from getting stuck
      const signOutResult = await withTimeout(supabase.auth.signOut({ scope: 'local' }), 8000);

      // Check for signOut error (signOut returns { error } and usually does not throw)
      if (signOutResult.error) {
        const error = signOutResult.error;
        const errorStatus = (error as any).status || 'unknown';
        const errorCode = (error as any).code || 'unknown';
        console.log(
          `[ProfileScreen] handleSignOut: signOut returned error = ${error.message || error}, status=${errorStatus}, code=${errorCode}`
        );
        throw error;
      }

      console.log('[ProfileScreen] handleSignOut: signOut succeeded');

      // Check session after signOut
      const { data: sessionAfter } = await supabase.auth.getSession();
      console.log('[ProfileScreen] handleSignOut: session exists after =', !!sessionAfter.session);

      clearUserContext();

      // Note: App.tsx onAuthStateChange listener should handle SIGNED_OUT event
      // and update session state, which will trigger navigation to auth screens
      // If that doesn't work, the session check above will be null and App.tsx
      // will re-evaluate routing on next render
    } catch (error: any) {
      const errorStatus = (error as any).status || 'unknown';
      const errorCode = (error as any).code || 'unknown';
      console.log(
        `[ProfileScreen] handleSignOut: error = ${error.message || error}, status=${errorStatus}, code=${errorCode}`
      );
      const { title, message } = getErrorAlert(error, 'Sign Out Error');
      Alert.alert(title, message);
    } finally {
      // Always reset loading state, even if signOut fails or times out
      setSigningOut(false);
      console.log('[ProfileScreen] handleSignOut: loading state reset');
    }
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
        <Text style={styles.label}>Headline (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="A short, catchy headline"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={headline}
          onChangeText={setHeadline}
          maxLength={100}
          editable={!saving}
        />

        <View>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Bio (optional)</Text>
            <Text style={styles.charCount}>{bio.length}/500</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Tell people about yourself..."
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={bio}
            onChangeText={handleBioChange}
            multiline
            numberOfLines={4}
            maxLength={200}
            editable={!saving}
          />
        </View>

        <Text style={styles.label}>Favourite first dates</Text>
        <Text style={styles.subLabel}>Share 1-3 ideas for great first dates (optional)</Text>
        <View style={styles.dateIdeasContainer}>
          {favouriteFirstDates.map((dateIdea, index) => (
            <View key={index} style={styles.dateIdeaChip}>
              <Text style={styles.dateIdeaText}>{dateIdea}</Text>
              <TouchableOpacity
                style={styles.removeDateIdeaButton}
                onPress={() => handleRemoveDateIdea(index)}
                disabled={saving}
              >
                <Text style={styles.removeDateIdeaText}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
        <View style={styles.dateIdeaInputRow}>
          <TextInput
            style={[styles.input, styles.dateIdeaInput]}
            placeholder="Add a date idea (max 60 chars)"
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={newDateIdea}
            onChangeText={setNewDateIdea}
            maxLength={60}
            editable={!saving && favouriteFirstDates.length < 3}
            onSubmitEditing={handleAddDateIdea}
          />
          <TouchableOpacity
            style={[
              styles.addDateIdeaButton,
              (saving || favouriteFirstDates.length >= 3 || newDateIdea.trim().length === 0) &&
                styles.buttonDisabled,
            ]}
            onPress={handleAddDateIdea}
            disabled={saving || favouriteFirstDates.length >= 3 || newDateIdea.trim().length === 0}
          >
            <Text style={styles.addDateIdeaButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Photos</Text>
        <View style={styles.photosContainer}>
          {photos.map((photo, index) => {
            const uploadState = photoUploadStates.get(index);
            const deletionState = photoDeletionStates.get(index);
            const isUploading = uploadState === 'uploading';
            const isDeleting = deletionState === 'deleting';
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
                {isDeleting && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color={BRAND_COLORS.onPrimary} size="small" />
                    <Text style={styles.deletingText}>Deleting...</Text>
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
                  disabled={saving || isUploading || isDeleting}
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
            <ActivityIndicator color={BRAND_COLORS.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.signOutButton, signingOut && styles.buttonDisabled]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator color={BRAND_COLORS.onPrimary} />
        ) : (
          <Text style={styles.signOutText}>Sign Out</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.surface,
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
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  subLabel: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginTop: -8,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: 'BRAND_COLORS.background[50]',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  dateIdeasContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dateIdeaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.primary + '20',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  dateIdeaText: {
    fontSize: 14,
    color: BRAND_COLORS.text[900],
    maxWidth: 200,
  },
  removeDateIdeaButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeDateIdeaText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  dateIdeaInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dateIdeaInput: {
    flex: 1,
  },
  addDateIdeaButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  addDateIdeaButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
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
  deletingText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
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
    color: BRAND_COLORS.onPrimary,
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
    backgroundColor: 'BRAND_COLORS.background[50]',
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
    color: BRAND_COLORS.onPrimary,
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
    color: BRAND_COLORS.onPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
