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
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { compressImage } from '../../lib/imageCompression';
import { trackEvent } from '../../lib/analytics';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS } from '../../config/brand';
import { useNavigation } from '@react-navigation/native';

type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function PhotosScreen() {
  const navigation = useNavigation();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
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
        setPhotos(profile.photos as string[]);
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
        setPhotoUploadStates((prev) => new Map(prev).set(tempIndex, 'error'));
        Alert.alert('Error', updateError.message);
        setUploading(false);
        return;
      }

      setPhotos(updatedPhotos);
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
    if (photos.length === 0) {
      Alert.alert('Photo required', 'Please add at least one photo to continue');
      return;
    }

    // Profile is complete, app will automatically show main navigator
    // on next render due to profile completion check
    // Force a refresh by navigating back to root
    navigation.getParent()?.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Photos</Text>
      <Text style={styles.subtitle}>Add at least one photo to your profile</Text>

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

      <TouchableOpacity
        style={[styles.button, photos.length === 0 && styles.buttonDisabled]}
        onPress={handleContinue}
        disabled={photos.length === 0 || uploading}
      >
        <Text style={styles.buttonText}>Continue</Text>
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
  button: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
