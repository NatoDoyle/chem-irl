import { useState, useEffect, useRef, useCallback } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import { compressImage } from '../../lib/imageCompression';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';
import { deletePhotoFromStorage } from '../../lib/storage';
import { getErrorAlert } from '../../lib/errors';
import { ensureProfileExists } from '../../lib/profile';
import { sanitizeText, sanitizeMultilineText } from '../../lib/sanitize';
import { addBreadcrumb, clearUserContext } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';
import {
  reconcilePhotos,
  shouldRunReconciliation,
  markReconciliationComplete,
} from '../../lib/reconcilePhotos';
import type { UserGender, UserOrientation } from '../../lib/types';

type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';
type PhotoDeletionState = 'idle' | 'deleting';

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
];

const ORIENTATION_OPTIONS: { value: UserOrientation; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bisexual', label: 'Bisexual' },
  { value: 'pansexual', label: 'Pansexual' },
  { value: 'asexual', label: 'Asexual' },
  { value: 'other', label: 'Other' },
];

const INTENT_OPTIONS = [
  { value: 'casual', label: 'Casual dating' },
  { value: 'dating_long_term', label: 'Dating → long-term' },
  { value: 'long_term', label: 'Long-term relationship' },
  { value: 'open', label: 'Open / exploring' },
];

const FAMILY_PLANS_OPTIONS = [
  { value: 'wants_kids', label: 'Wants kids' },
  { value: 'no_kids', label: "Doesn't want kids" },
  { value: 'has_kids', label: 'Has kids' },
  { value: 'unsure', label: 'Unsure' },
];

const PETS_OPTIONS = [
  { value: 'has_pets', label: 'Has pets' },
  { value: 'wants_pets', label: 'Wants pets' },
  { value: 'allergic', label: "Allergic / doesn't want" },
  { value: 'no_preference', label: 'No preference' },
];

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

const FREQUENCY_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

const LOVE_LANGUAGE_OPTIONS = [
  { value: 'words', label: 'Words of Affirmation' },
  { value: 'acts', label: 'Acts of Service' },
  { value: 'gifts', label: 'Receiving Gifts' },
  { value: 'time', label: 'Quality Time' },
  { value: 'touch', label: 'Physical Touch' },
];

const ASTROLOGY_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

const MBTI_OPTIONS = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Other',
];

const PRESET_INTERESTS = [
  'Travel',
  'Music',
  'Movies',
  'Sports',
  'Cooking',
  'Reading',
  'Photography',
  'Art',
  'Dancing',
  'Gaming',
  'Hiking',
  'Yoga',
  'Fitness',
  'Writing',
  'Technology',
  'Fashion',
  'Food',
  'Wine',
  'Coffee',
  'Pets',
  'Volunteering',
  'Comedy',
  'Theater',
  'Concerts',
];

export default function ProfileScreen() {
  // Profile content
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // Identity (users table)
  const [gender, setGender] = useState<UserGender | null>(null);
  const [orientation, setOrientation] = useState<UserOrientation | null>(null);

  // Demographics (profiles.prompts.demographics)
  const [heightCm, setHeightCm] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [relationshipIntent, setRelationshipIntent] = useState<string | null>(null);
  const [familyPlans, setFamilyPlans] = useState<string | null>(null);
  const [pets, setPets] = useState<string | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [drinking, setDrinking] = useState<string | null>(null);
  const [smoking, setSmoking] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<string | null>(null);
  const [diet, setDiet] = useState('');

  // Preferences (profiles.prompts.preferences)
  const [interests, setInterests] = useState<string[]>([]);
  const [loveLanguage, setLoveLanguage] = useState<string | null>(null);
  const [personalityType, setPersonalityType] = useState<string | null>(null);
  const [astrologySign, setAstrologySign] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState('');
  const [education, setEducation] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUploadStates, setPhotoUploadStates] = useState<Map<number, PhotoUploadState>>(
    new Map()
  );
  const [photoDeletionStates, setPhotoDeletionStates] = useState<Map<number, PhotoDeletionState>>(
    new Map()
  );
  const [failedUploadURIs, setFailedUploadURIs] = useState<Map<number, string>>(new Map());
  const reconciliationRunRef = useRef(false);

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

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

      // Load profiles data
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('prompts, photos')
        .eq('id', user.id)
        .maybeSingle();

      if (profile === null && !error) {
        await ensureProfileExists(user.id);
        const next = await supabase
          .from('profiles')
          .select('prompts, photos')
          .eq('id', user.id)
          .maybeSingle();
        profile = next.data;
        error = next.error;
      }

      if (error) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', 'Failed to load profile');
        setLoading(false);
        return;
      }

      if (profile) {
        const prompts = (profile.prompts ?? {}) as Record<string, any>;
        const demographics = (prompts.demographics ?? {}) as Record<string, any>;
        const preferences = (prompts.preferences ?? {}) as Record<string, any>;

        setHeadline(prompts.headline || '');
        setBio(prompts.bio || '');
        setHeightCm(demographics.height_cm != null ? String(demographics.height_cm) : '');
        setLanguages(demographics.languages || []);
        setRelationshipIntent(demographics.relationship_intent || null);
        setFamilyPlans(demographics.family_plans || null);
        setPets(demographics.pets || null);
        setActivityLevel(demographics.activity_level || null);
        setDrinking(demographics.drinking || null);
        setSmoking(demographics.smoking || null);
        setDrugs(demographics.drugs || null);
        setDiet(demographics.diet || '');
        setInterests(preferences.interests || []);
        setLoveLanguage(preferences.love_language || null);
        setPersonalityType(preferences.personality_type || null);
        setAstrologySign(preferences.astrology_sign || null);
        setJobTitle(preferences.job_title || '');
        setEducation(preferences.education || '');

        const loadedPhotos = (profile.photos as string[]) || [];
        setPhotos(loadedPhotos);

        // Reconciliation
        const shouldReconcile = await shouldRunReconciliation();
        if (shouldReconcile && !reconciliationRunRef.current && loadedPhotos.length > 0) {
          reconciliationRunRef.current = true;
          const reconcileResult = await reconcilePhotos(loadedPhotos, user.id);
          await markReconciliationComplete();

          if (reconcileResult.invalidUrls.length > 0 && !reconcileResult.hadNetworkError) {
            Alert.alert(
              'Some photos are missing',
              `We found ${reconcileResult.invalidUrls.length} photo(s) that no longer exist. Would you like to remove them from your profile?`,
              [
                { text: 'Keep them', style: 'cancel' },
                {
                  text: 'Remove',
                  onPress: async () => {
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
            setPhotos(reconcileResult.validUrls);
          }
        }
      }

      // Load users table data (gender, orientation)
      const { data: userData } = await supabase
        .from('users')
        .select('gender, orientation')
        .eq('user_id', user.id)
        .maybeSingle();

      if (userData) {
        setGender(userData.gender || null);
        setOrientation(userData.orientation || null);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      const { title, message } = getErrorAlert(error, 'Failed to load profile');
      Alert.alert(title, message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const headlineTrimmed = headline.trim();
    const bioTrimmed = bio.trim();

    if (headlineTrimmed && headlineTrimmed.length < 5) {
      Alert.alert('Error', 'Headline must be at least 5 characters');
      return;
    }
    if (bioTrimmed && bioTrimmed.length < 20) {
      Alert.alert('Error', 'Bio must be at least 20 characters');
      return;
    }

    const parsedHeight = heightCm.trim() ? parseInt(heightCm.trim(), 10) : null;
    if (parsedHeight !== null && (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 250)) {
      Alert.alert('Error', 'Height must be between 50 and 250 cm');
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

      // Get current prompts to preserve any fields we don't edit here
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;

      const sanitizedHeadline = headlineTrimmed ? sanitizeText(headlineTrimmed) : '';
      const sanitizedBio = bioTrimmed ? sanitizeMultilineText(bioTrimmed) : '';

      const demographics: Record<string, any> = {
        ...(currentPrompts.demographics || {}),
      };
      if (parsedHeight !== null) demographics.height_cm = parsedHeight;
      else delete demographics.height_cm;
      if (languages.length > 0) demographics.languages = languages;
      else delete demographics.languages;
      demographics.relationship_intent = relationshipIntent;
      demographics.family_plans = familyPlans;
      demographics.pets = pets;
      demographics.activity_level = activityLevel;
      demographics.drinking = drinking;
      demographics.smoking = smoking;
      demographics.drugs = drugs;
      if (diet.trim()) demographics.diet = diet.trim();
      else delete demographics.diet;

      const preferences: Record<string, any> = {
        ...(currentPrompts.preferences || {}),
      };
      if (interests.length > 0) preferences.interests = interests;
      else delete preferences.interests;
      preferences.love_language = loveLanguage;
      preferences.personality_type = personalityType;
      preferences.astrology_sign = astrologySign;
      if (jobTitle.trim()) preferences.job_title = jobTitle.trim();
      else delete preferences.job_title;
      if (education.trim()) preferences.education = education.trim();
      else delete preferences.education;

      const prompts = {
        ...currentPrompts,
        headline: sanitizedHeadline || undefined,
        bio: sanitizedBio || undefined,
        demographics,
        preferences,
      };

      const profilePayload: any = {
        id: user.id,
        prompts,
        photos,
        completion_pct: photos.length >= 1 ? 100 : 50,
      };
      if (parsedHeight !== null) {
        profilePayload.height_cm = parsedHeight;
      }

      const { error: profileError } = await supabase.from('profiles').upsert(profilePayload);

      if (profileError) {
        // Retry without height_cm column in case it doesn't exist
        if (
          profileError.code === '42703' ||
          profileError.message.includes('column') ||
          profileError.message.includes('does not exist')
        ) {
          delete profilePayload.height_cm;
          const { error: retryError } = await supabase.from('profiles').upsert(profilePayload);
          if (retryError) {
            const { title, message } = getErrorAlert(retryError, 'Failed to update profile');
            Alert.alert(title, message);
            setSaving(false);
            return;
          }
        } else {
          const { title, message } = getErrorAlert(profileError, 'Failed to update profile');
          Alert.alert(title, message);
          setSaving(false);
          return;
        }
      }

      // Save users table fields (gender, orientation) if set
      if (gender || orientation) {
        const userUpdate: Record<string, any> = {};
        if (gender) userUpdate.gender = gender;
        if (orientation) userUpdate.orientation = orientation;

        const { error: userError } = await supabase
          .from('users')
          .update(userUpdate)
          .eq('user_id', user.id);

        if (userError) {
          console.error('Error updating user:', userError);
        }
      }

      trackEvent('profile_updated');
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

      // Read file as base64 and convert to ArrayBuffer (cross-platform; fetch+blob fails on Android)
      const base64 = await FileSystem.readAsStringAsync(compressedUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const fileExt = 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: false });

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

  const handleSignOut = async () => {
    addBreadcrumb('User signing out', 'auth', 'info');
    clearUserContext();
    await supabase.auth.signOut();
  };

  const toggleMultiSelect = (value: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  // Reusable UI components

  const renderSectionHeader = (title: string, sectionKey: string, summary?: string) => {
    const isExpanded = expandedSections.has(sectionKey);
    return (
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={() => toggleSection(sectionKey)}
        disabled={saving}
      >
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!isExpanded && summary ? (
            <Text style={styles.sectionSummary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Text style={styles.sectionChevron}>{isExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
    );
  };

  const renderPicker = (
    value: string | null,
    options: { value: string; label: string }[],
    onSelect: (v: string | null) => void
  ) => (
    <View style={styles.pickerContainer}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.chip, value === opt.value && styles.chipSelected]}
          onPress={() => onSelect(value === opt.value ? null : opt.value)}
          disabled={saving}
        >
          <Text style={[styles.chipText, value === opt.value && styles.chipTextSelected]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderTagPicker = (values: string[], options: string[], onToggle: (v: string) => void) => (
    <View style={styles.pickerContainer}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, values.includes(opt) && styles.chipSelected]}
          onPress={() => onToggle(opt)}
          disabled={saving}
        >
          <Text style={[styles.chipText, values.includes(opt) && styles.chipTextSelected]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  const genderLabel = GENDER_OPTIONS.find((o) => o.value === gender)?.label;
  const orientationLabel = ORIENTATION_OPTIONS.find((o) => o.value === orientation)?.label;
  const intentLabel = INTENT_OPTIONS.find((o) => o.value === relationshipIntent)?.label;
  const familyLabel = FAMILY_PLANS_OPTIONS.find((o) => o.value === familyPlans)?.label;
  const petsLabel = PETS_OPTIONS.find((o) => o.value === pets)?.label;
  const activityLabel = ACTIVITY_OPTIONS.find((o) => o.value === activityLevel)?.label;
  const loveLabel = LOVE_LANGUAGE_OPTIONS.find((o) => o.value === loveLanguage)?.label;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>Manage your profile information</Text>

      {/* ── Headline & Bio ── */}
      <View style={styles.section}>
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
      </View>

      {/* ── Photos ── */}
      <View style={styles.section}>
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
                {isUploading && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
                {isDeleting && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
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
      </View>

      {/* ── Identity ── */}
      {renderSectionHeader(
        'Identity',
        'identity',
        [genderLabel, orientationLabel].filter(Boolean).join(' · ')
      )}
      {expandedSections.has('identity') && (
        <View style={styles.sectionBody}>
          <Text style={styles.fieldLabel}>Gender</Text>
          {renderPicker(gender, GENDER_OPTIONS, (v) => setGender(v as UserGender | null))}
          <Text style={styles.fieldLabel}>Interested in</Text>
          {renderPicker(orientation, ORIENTATION_OPTIONS, (v) =>
            setOrientation(v as UserOrientation | null)
          )}
        </View>
      )}

      {/* ── Height ── */}
      {renderSectionHeader('Height', 'height', heightCm ? `${heightCm} cm` : undefined)}
      {expandedSections.has('height') && (
        <View style={styles.sectionBody}>
          <TextInput
            style={styles.input}
            placeholder="Height in cm (e.g. 175)"
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={heightCm}
            onChangeText={setHeightCm}
            keyboardType="numeric"
            maxLength={3}
            editable={!saving}
          />
          {heightCm ? (
            <TouchableOpacity onPress={() => setHeightCm('')} disabled={saving}>
              <Text style={styles.clearLink}>Clear height</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* ── Languages ── */}
      {renderSectionHeader(
        'Languages',
        'languages',
        languages.length > 0 ? languages.join(', ') : undefined
      )}
      {expandedSections.has('languages') && (
        <View style={styles.sectionBody}>
          {renderTagPicker(languages, LANGUAGE_OPTIONS, (v) =>
            toggleMultiSelect(v, languages, setLanguages)
          )}
        </View>
      )}

      {/* ── Relationship ── */}
      {renderSectionHeader(
        'Relationship',
        'relationship',
        [intentLabel, familyLabel].filter(Boolean).join(' · ')
      )}
      {expandedSections.has('relationship') && (
        <View style={styles.sectionBody}>
          <Text style={styles.fieldLabel}>Looking for</Text>
          {renderPicker(relationshipIntent, INTENT_OPTIONS, setRelationshipIntent)}
          <Text style={styles.fieldLabel}>Family plans</Text>
          {renderPicker(familyPlans, FAMILY_PLANS_OPTIONS, setFamilyPlans)}
        </View>
      )}

      {/* ── Pets ── */}
      {renderSectionHeader('Pets', 'pets', petsLabel)}
      {expandedSections.has('pets') && (
        <View style={styles.sectionBody}>{renderPicker(pets, PETS_OPTIONS, setPets)}</View>
      )}

      {/* ── Lifestyle ── */}
      {renderSectionHeader('Lifestyle', 'lifestyle', activityLabel || undefined)}
      {expandedSections.has('lifestyle') && (
        <View style={styles.sectionBody}>
          <Text style={styles.fieldLabel}>Activity level</Text>
          {renderPicker(activityLevel, ACTIVITY_OPTIONS, setActivityLevel)}
          <Text style={styles.fieldLabel}>Drinking</Text>
          {renderPicker(drinking, FREQUENCY_OPTIONS, setDrinking)}
          <Text style={styles.fieldLabel}>Smoking</Text>
          {renderPicker(smoking, FREQUENCY_OPTIONS, setSmoking)}
          <Text style={styles.fieldLabel}>Drugs</Text>
          {renderPicker(drugs, FREQUENCY_OPTIONS, setDrugs)}
          <Text style={styles.fieldLabel}>Diet</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Vegan, Vegetarian, Halal..."
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={diet}
            onChangeText={setDiet}
            maxLength={50}
            editable={!saving}
          />
        </View>
      )}

      {/* ── Interests ── */}
      {renderSectionHeader(
        'Interests',
        'interests',
        interests.length > 0
          ? interests.slice(0, 3).join(', ') + (interests.length > 3 ? '...' : '')
          : undefined
      )}
      {expandedSections.has('interests') && (
        <View style={styles.sectionBody}>
          {renderTagPicker(interests, PRESET_INTERESTS, (v) =>
            toggleMultiSelect(v, interests, setInterests)
          )}
        </View>
      )}

      {/* ── Personality & Astrology ── */}
      {renderSectionHeader(
        'Personality & Astrology',
        'personality',
        [personalityType, astrologySign, loveLabel].filter(Boolean).join(' · ')
      )}
      {expandedSections.has('personality') && (
        <View style={styles.sectionBody}>
          <Text style={styles.fieldLabel}>Love language</Text>
          {renderPicker(loveLanguage, LOVE_LANGUAGE_OPTIONS, setLoveLanguage)}
          <Text style={styles.fieldLabel}>Personality type (MBTI)</Text>
          {renderTagPicker(personalityType ? [personalityType] : [], MBTI_OPTIONS, (v) =>
            setPersonalityType(personalityType === v ? null : v)
          )}
          <Text style={styles.fieldLabel}>Astrology sign</Text>
          {renderTagPicker(astrologySign ? [astrologySign] : [], ASTROLOGY_SIGNS, (v) =>
            setAstrologySign(astrologySign === v ? null : v)
          )}
        </View>
      )}

      {/* ── Work & Education ── */}
      {renderSectionHeader(
        'Work & Education',
        'work',
        [jobTitle, education].filter((s) => s.trim()).join(' · ') || undefined
      )}
      {expandedSections.has('work') && (
        <View style={styles.sectionBody}>
          <Text style={styles.fieldLabel}>Job title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Software Engineer"
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={jobTitle}
            onChangeText={setJobTitle}
            maxLength={100}
            editable={!saving}
          />
          <Text style={styles.fieldLabel}>Education</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. University of Sydney"
            placeholderTextColor={BRAND_COLORS.text[600]}
            value={education}
            onChangeText={setEducation}
            maxLength={100}
            editable={!saving}
          />
        </View>
      )}

      {/* ── Save ── */}
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

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
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
    marginBottom: 24,
  },

  // Sections
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: GOLDEN_HOUR.borderDefault,
  },
  sectionHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
  },
  sectionSummary: {
    fontSize: 14,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  sectionChevron: {
    fontSize: 12,
    color: BRAND_COLORS.text[600],
  },
  sectionBody: {
    paddingVertical: 12,
    gap: 12,
  },

  // Fields
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: BRAND_COLORS.text[900],
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_COLORS.text[700],
  },
  input: {
    borderWidth: 1,
    borderColor: GOLDEN_HOUR.borderDefault,
    borderRadius: GOLDEN_HOUR.radius.lg,
    padding: 14,
    fontSize: 16,
    backgroundColor: GOLDEN_HOUR.inputBg,
    color: BRAND_COLORS.text[900],
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  clearLink: {
    fontSize: 14,
    color: BRAND_COLORS.danger,
    fontWeight: '500',
    marginTop: 4,
  },

  // Chips / pickers
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: GOLDEN_HOUR.borderDefault,
    backgroundColor: GOLDEN_HOUR.inputBg,
  },
  chipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: '#D1FFFB',
  },
  chipText: {
    fontSize: 14,
    color: BRAND_COLORS.text[700],
    fontWeight: '500',
  },
  chipTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },

  // Photos
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
    borderRadius: GOLDEN_HOUR.radius.lg,
    backgroundColor: '#E2E8F0',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: GOLDEN_HOUR.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deletingText: {
    color: '#fff',
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
    borderRadius: GOLDEN_HOUR.radius.lg,
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
    borderRadius: GOLDEN_HOUR.radius.lg,
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GOLDEN_HOUR.inputBg,
  },
  addPhotoText: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Buttons
  saveButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: 16,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center',
    marginTop: 24,
    ...GOLDEN_HOUR.shadow.warm,
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
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  signOutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
