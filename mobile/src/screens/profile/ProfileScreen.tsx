import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { compressImage } from '../../lib/imageCompression';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING, GOLD } from '../../config/brand';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import GHButton from '../../components/ui/GHButton';
import { deletePhotoFromStorage } from '../../lib/storage';
import { getErrorAlert } from '../../lib/errors';
import { ensureProfileExists } from '../../lib/profile';
import { sanitizeMultilineText } from '../../lib/sanitize';
import { addBreadcrumb, clearUserContext } from '../../lib/sentry';
import { trackEvent } from '../../lib/analytics';
import {
  reconcilePhotos,
  shouldRunReconciliation,
  markReconciliationComplete,
} from '../../lib/reconcilePhotos';
import PaywallModal from '../../components/PaywallModal';
import { getEntitlement } from '../../lib/subscription';
import {
  GENDER_OPTIONS,
  ORIENTATION_OPTIONS,
  INTENT_OPTIONS,
  FAMILY_PLANS_OPTIONS,
  PETS_OPTIONS,
  ACTIVITY_OPTIONS,
  FREQUENCY_OPTIONS,
  LOVE_LANGUAGE_OPTIONS,
  ASTROLOGY_SIGNS,
  MBTI_OPTIONS,
  LANGUAGE_OPTIONS,
  PRESET_INTERESTS,
  type UserGender,
  type UserOrientation,
} from '../../config/profileOptions';
import type { WeeklySlot } from '../../lib/types';
import {
  generateAvailabilitySummary,
  formatSlotDisplay,
  validateWeeklySlot,
} from '../../lib/availability';
import AvailabilitySlotPicker from '../../components/AvailabilitySlotPicker';

type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';
type PhotoDeletionState = 'idle' | 'deleting';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const contentPadding = 24;
  const photoGridGap = 12;
  const photoWidth = (screenWidth - contentPadding * 2 - photoGridGap * 2) / 3;

  // Profile content
  const [fullName, setFullName] = useState('');
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

  // Availability (profiles.availability.weekly_slots)
  const [weeklySlots, setWeeklySlots] = useState<WeeklySlot[]>([]);

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

  // Track which sections are expanded (for edit mode)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Chem Plus upgrade card. Hidden once the user is entitled (active
  // trial or subscription). `null` means we haven't checked yet — the
  // card is hidden until we know, so users don't see a flash.
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);

  const refreshEntitlement = useCallback(async () => {
    try {
      const ent = await getEntitlement();
      setEntitled(ent.allowed);
    } catch {
      setEntitled(null);
    }
  }, []);

  useEffect(() => {
    refreshEntitlement();
  }, [refreshEntitlement]);

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
        .select('full_name, prompts, photos, availability')
        .eq('id', user.id)
        .maybeSingle();

      if (profile === null && !error) {
        await ensureProfileExists(user.id);
        const next = await supabase
          .from('profiles')
          .select('full_name, prompts, photos, availability')
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

        setFullName((profile as any).full_name || '');
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

        const availability = (profile.availability ?? {}) as Record<string, any>;
        setWeeklySlots(availability.weekly_slots || []);

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
    const bioTrimmed = bio.trim();

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

      // Get current prompts and availability to preserve fields we don't edit here
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts, availability')
        .eq('id', user.id)
        .maybeSingle();

      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;
      const currentAvailability = (currentProfile?.availability ?? {}) as Record<string, any>;

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
        bio: sanitizedBio || undefined,
        demographics,
        preferences,
      };

      const updatedAvailability = {
        ...currentAvailability,
        weekly_slots: weeklySlots,
        summary: generateAvailabilitySummary(weeklySlots),
      };

      const profilePayload: any = {
        id: user.id,
        prompts,
        photos,
        availability: updatedAvailability,
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

  const addSlot = (slot: WeeklySlot) => {
    const error = validateWeeklySlot(slot);
    if (error) {
      Alert.alert('Invalid time slot', error);
      return;
    }
    if (weeklySlots.length >= 3) {
      Alert.alert('Limit', 'You can add up to 3 recurring time slots');
      return;
    }
    setWeeklySlots([...weeklySlots, slot]);
  };

  const removeSlot = (index: number) => {
    setWeeklySlots(weeklySlots.filter((_, i) => i !== index));
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
      <AnimatedPressable
        style={styles.sectionHeader}
        onPress={() => toggleSection(sectionKey)}
        disabled={saving}
        haptic={false}
      >
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!isExpanded && summary ? (
            <Text style={styles.sectionSummary} numberOfLines={1}>
              {summary}
            </Text>
          ) : null}
        </View>
        <Text style={styles.sectionChevron}>{isExpanded ? '\u25B2' : '\u25BC'}</Text>
      </AnimatedPressable>
    );
  };

  const renderPicker = (
    value: string | null,
    options: { value: string; label: string }[],
    onSelect: (v: string | null) => void
  ) => (
    <View style={styles.pickerContainer}>
      {options.map((opt) => (
        <AnimatedPressable
          key={opt.value}
          style={[styles.chip, value === opt.value && styles.chipSelected]}
          onPress={() => onSelect(value === opt.value ? null : opt.value)}
          disabled={saving}
          haptic={false}
        >
          <Text style={[styles.chipText, value === opt.value && styles.chipTextSelected]}>
            {opt.label}
          </Text>
        </AnimatedPressable>
      ))}
    </View>
  );

  const renderTagPicker = (values: string[], options: string[], onToggle: (v: string) => void) => (
    <View style={styles.pickerContainer}>
      {options.map((opt) => (
        <AnimatedPressable
          key={opt}
          style={[styles.chip, values.includes(opt) && styles.chipSelected]}
          onPress={() => onToggle(opt)}
          disabled={saving}
          haptic={false}
        >
          <Text style={[styles.chipText, values.includes(opt) && styles.chipTextSelected]}>
            {opt}
          </Text>
        </AnimatedPressable>
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

  const intentLabel = INTENT_OPTIONS.find((o) => o.value === relationshipIntent)?.label;
  const loveLabel = LOVE_LANGUAGE_OPTIONS.find((o) => o.value === loveLanguage)?.label;

  // Build availability chip data
  const availabilityChips = weeklySlots.map((slot) => {
    const dayAbbrev = slot.day.substring(0, 3).toUpperCase();
    const startHour = parseInt(slot.start_time.split(':')[0], 10);
    let period = 'Morning';
    if (startHour >= 12 && startHour < 17) period = 'Afternoon';
    else if (startHour >= 17 && startHour < 21) period = 'Evening';
    else if (startHour >= 21) period = 'Night';
    return { day: dayAbbrev, time: period, slot };
  });

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <AnimatedPressable style={styles.headerIcon} onPress={() => {}} haptic={false}>
            <Ionicons name="arrow-back" size={24} color={BRAND_COLORS.primary} />
          </AnimatedPressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <AnimatedPressable style={styles.headerIcon} onPress={() => {}} haptic={false}>
            <Ionicons name="settings-outline" size={24} color={BRAND_COLORS.primary} />
          </AnimatedPressable>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.avatarRing, MIDNIGHT.glow.primary]}>
            <View style={styles.avatarContainer}>
              {photos.length > 0 ? (
                <Image
                  source={{ uri: photos[0] }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color={BRAND_COLORS.text[500]} />
                </View>
              )}
            </View>
            <AnimatedPressable style={styles.avatarEditBadge} onPress={pickImage} haptic={false}>
              <Ionicons name="pencil" size={12} color={BRAND_COLORS.onPrimary} />
            </AnimatedPressable>
          </View>
          <Text style={styles.heroName}>{fullName || 'Your Name'}</Text>
          <Text style={styles.heroTagline}>
            {bio?.substring(0, 60) || 'Add a bio to stand out'}
          </Text>
        </View>

        {/* Chem Plus Upgrade — hidden once the user is entitled */}
        {entitled === false && (
          <AnimatedPressable
            style={styles.upgradeCard}
            onPress={() => setPaywallVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Try Chem Plus free for 3 days"
            haptic={false}
          >
            <View style={styles.upgradeIcon}>
              <Ionicons name="sparkles" size={18} color={BRAND_COLORS.onPrimary} />
            </View>
            <View style={styles.upgradeBody}>
              <Text style={styles.upgradeTitle}>Try Chem Plus free for 3 days</Text>
              <Text style={styles.upgradeSubtitle}>
                Iris helps with your bio, dates, and replies.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={BRAND_COLORS.text[600]} />
          </AnimatedPressable>
        )}

        {/* About Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>About</Text>
            <AnimatedPressable onPress={() => toggleSection('about')} haptic={false}>
              <Ionicons name="pencil" size={16} color={BRAND_COLORS.text[500]} />
            </AnimatedPressable>
          </View>
          {expandedSections.has('about') ? (
            <View style={styles.editSection}>
              <Text style={styles.fieldLabel}>Bio</Text>
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
          ) : (
            <Text style={styles.cardBody}>
              {bio || 'Tap the pencil to add a bio and let others know about you.'}
            </Text>
          )}
        </View>

        {/* My Photos Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>My Photos</Text>
            <AnimatedPressable onPress={() => toggleSection('photos')} haptic={false}>
              <Text style={styles.viewAllText}>VIEW ALL</Text>
            </AnimatedPressable>
          </View>
          <View style={styles.photoGrid}>
            {photos.slice(0, 6).map((photo, index) => {
              const uploadState = photoUploadStates.get(index);
              const deletionState = photoDeletionStates.get(index);
              const isUploading = uploadState === 'uploading';
              const isDeleting = deletionState === 'deleting';
              return (
                <View
                  key={index}
                  style={[
                    styles.photoGridItem,
                    { width: photoWidth, height: photoWidth * (4 / 3) },
                  ]}
                >
                  <Image
                    source={{ uri: photo }}
                    style={styles.photoGridImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                  {isUploading && (
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
                      <Text style={styles.checkmark}>{'\u2713'}</Text>
                    </View>
                  )}
                  {uploadState === 'error' && (
                    <View style={[styles.uploadOverlay, styles.errorOverlay]}>
                      <Text style={styles.errorIcon}>!</Text>
                      <AnimatedPressable
                        style={styles.retryButton}
                        onPress={() => retryUpload(index)}
                      >
                        <Text style={styles.retryText}>Retry</Text>
                      </AnimatedPressable>
                    </View>
                  )}
                  <AnimatedPressable
                    style={styles.removePhotoButton}
                    onPress={() => removePhoto(index)}
                    disabled={saving || isUploading || isDeleting}
                    haptic={false}
                  >
                    <Text style={styles.removePhotoText}>{'\u00D7'}</Text>
                  </AnimatedPressable>
                </View>
              );
            })}
            {photos.length < 6 && (
              <AnimatedPressable
                style={[styles.addPhotoSlot, { width: photoWidth, height: photoWidth * (4 / 3) }]}
                onPress={pickImage}
                disabled={uploading || saving}
                haptic={false}
              >
                {uploading ? (
                  <ActivityIndicator color={BRAND_COLORS.primary} />
                ) : (
                  <Ionicons name="add" size={28} color={BRAND_COLORS.text[500]} />
                )}
              </AnimatedPressable>
            )}
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Details</Text>
            <AnimatedPressable onPress={() => toggleSection('details')} haptic={false}>
              <Ionicons name="pencil" size={16} color={BRAND_COLORS.text[500]} />
            </AnimatedPressable>
          </View>
          {expandedSections.has('details') ? (
            <View style={styles.editSection}>
              <Text style={styles.fieldLabel}>Height (cm)</Text>
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
                <AnimatedPressable onPress={() => setHeightCm('')} disabled={saving} haptic={false}>
                  <Text style={styles.clearLink}>Clear height</Text>
                </AnimatedPressable>
              ) : null}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Languages</Text>
              {renderTagPicker(languages, LANGUAGE_OPTIONS, (v) =>
                toggleMultiSelect(v, languages, setLanguages)
              )}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Looking for</Text>
              {renderPicker(relationshipIntent, INTENT_OPTIONS, setRelationshipIntent)}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Family plans</Text>
              {renderPicker(familyPlans, FAMILY_PLANS_OPTIONS, setFamilyPlans)}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Pets</Text>
              {renderPicker(pets, PETS_OPTIONS, setPets)}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Gender</Text>
              {renderPicker(gender, GENDER_OPTIONS, (v) => setGender(v as UserGender | null))}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Interested in</Text>
              {renderPicker(orientation, ORIENTATION_OPTIONS, (v) =>
                setOrientation(v as UserOrientation | null)
              )}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Activity level</Text>
              {renderPicker(activityLevel, ACTIVITY_OPTIONS, setActivityLevel)}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Drinking</Text>
              {renderPicker(drinking, FREQUENCY_OPTIONS, setDrinking)}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Smoking</Text>
              {renderPicker(smoking, FREQUENCY_OPTIONS, setSmoking)}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Drugs</Text>
              {renderPicker(drugs, FREQUENCY_OPTIONS, setDrugs)}

              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Diet</Text>
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
          ) : (
            <View>
              {/* Height row */}
              <View style={styles.detailRow}>
                <View style={styles.detailLeft}>
                  <Ionicons name="resize" size={16} color={BRAND_COLORS.text[500]} />
                  <Text style={styles.detailLabel}>Height</Text>
                </View>
                <Text style={styles.detailValue}>{heightCm ? `${heightCm} cm` : '\u2014'}</Text>
              </View>
              {/* Languages row */}
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <View style={styles.detailLeft}>
                  <Ionicons name="language" size={16} color={BRAND_COLORS.text[500]} />
                  <Text style={styles.detailLabel}>Languages</Text>
                </View>
                <Text style={styles.detailValue}>
                  {languages.length > 0 ? languages.join(', ') : '\u2014'}
                </Text>
              </View>
              {/* Intent row */}
              <View style={[styles.detailRow, styles.detailRowBorder]}>
                <View style={styles.detailLeft}>
                  <Ionicons name="heart" size={16} color={BRAND_COLORS.text[500]} />
                  <Text style={styles.detailLabel}>Intent</Text>
                </View>
                <Text style={[styles.detailValue, intentLabel && styles.detailValuePrimary]}>
                  {intentLabel || '\u2014'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Interests Card */}
        <View style={styles.glassCard}>
          {renderSectionHeader(
            'Interests',
            'interests',
            interests.length > 0
              ? interests.slice(0, 3).join(', ') + (interests.length > 3 ? '...' : '')
              : undefined
          )}
          {expandedSections.has('interests') ? (
            <View style={styles.editSection}>
              {renderTagPicker(interests, PRESET_INTERESTS, (v) =>
                toggleMultiSelect(v, interests, setInterests)
              )}
            </View>
          ) : interests.length > 0 ? (
            <View style={[styles.availabilityChips, { marginTop: 12 }]}>
              {interests.slice(0, 6).map((interest) => (
                <View key={interest} style={styles.availChip}>
                  <Text style={styles.availChipTime}>{interest}</Text>
                </View>
              ))}
              {interests.length > 6 && (
                <View style={styles.availChip}>
                  <Text style={styles.availChipTime}>+{interests.length - 6} more</Text>
                </View>
              )}
            </View>
          ) : null}
        </View>

        {/* Personality & Astrology Card */}
        <View style={styles.glassCard}>
          {renderSectionHeader(
            'Personality & Astrology',
            'personality',
            [personalityType, astrologySign, loveLabel].filter(Boolean).join(' \u00B7 ')
          )}
          {expandedSections.has('personality') && (
            <View style={styles.editSection}>
              <Text style={styles.fieldLabel}>Love language</Text>
              {renderPicker(loveLanguage, LOVE_LANGUAGE_OPTIONS, setLoveLanguage)}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Personality type (MBTI)</Text>
              {renderTagPicker(personalityType ? [personalityType] : [], MBTI_OPTIONS, (v) =>
                setPersonalityType(personalityType === v ? null : v)
              )}
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Astrology sign</Text>
              {renderTagPicker(astrologySign ? [astrologySign] : [], ASTROLOGY_SIGNS, (v) =>
                setAstrologySign(astrologySign === v ? null : v)
              )}
            </View>
          )}
        </View>

        {/* Work & Education Card */}
        <View style={styles.glassCard}>
          {renderSectionHeader(
            'Work & Education',
            'work',
            [jobTitle, education].filter((s) => s.trim()).join(' \u00B7 ') || undefined
          )}
          {expandedSections.has('work') && (
            <View style={styles.editSection}>
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
              <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Education</Text>
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
        </View>

        {/* When I'm Usually Free Card */}
        <View style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>When I'm Usually Free</Text>
            <Ionicons name="flash" size={16} color={GOLD[600]} />
          </View>
          {expandedSections.has('availability') ? (
            <View style={styles.editSection}>
              {weeklySlots.map((slot, index) => (
                <View key={index} style={styles.slotRow}>
                  <Text style={styles.slotText}>{formatSlotDisplay(slot)}</Text>
                  <AnimatedPressable
                    onPress={() => removeSlot(index)}
                    disabled={saving}
                    haptic={false}
                  >
                    <Text style={styles.clearLink}>Remove</Text>
                  </AnimatedPressable>
                </View>
              ))}
              {weeklySlots.length < 3 && (
                <AvailabilitySlotPicker onAdd={addSlot} disabled={saving} />
              )}
              {weeklySlots.length === 0 && (
                <Text style={styles.fieldHint}>Add times when you're usually free for dates</Text>
              )}
              <AnimatedPressable onPress={() => toggleSection('availability')} haptic={false}>
                <Text style={[styles.viewAllText, { marginTop: 12 }]}>DONE</Text>
              </AnimatedPressable>
            </View>
          ) : (
            <>
              {availabilityChips.length > 0 ? (
                <View style={styles.availabilityChips}>
                  {availabilityChips.map((chip, index) => (
                    <View
                      key={index}
                      style={[styles.availChip, index === 0 && styles.availChipActive]}
                    >
                      <Text style={[styles.availChipDay, index === 0 && styles.availChipDayActive]}>
                        {chip.day}
                      </Text>
                      <Text
                        style={[styles.availChipTime, index === 0 && styles.availChipTimeActive]}
                      >
                        {chip.time}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <AnimatedPressable onPress={() => toggleSection('availability')} haptic={false}>
                  <Text style={styles.fieldHint}>Tap to add your usual free times</Text>
                </AnimatedPressable>
              )}
              <Text style={styles.availabilityHint}>
                Adding availability helps matches propose times faster
              </Text>
              {availabilityChips.length > 0 && (
                <AnimatedPressable onPress={() => toggleSection('availability')} haptic={false}>
                  <Text style={[styles.viewAllText, { marginTop: 8 }]}>EDIT</Text>
                </AnimatedPressable>
              )}
            </>
          )}
        </View>

        {/* Save Changes */}
        <GHButton
          title="Save Changes"
          onPress={handleSave}
          loading={saving}
          disabled={saving}
          style={styles.saveButton}
        />

        {/* Sign Out */}
        <GHButton
          title="Sign Out"
          onPress={handleSignOut}
          variant="coral"
          style={styles.signOutButton}
        />
      </ScrollView>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => {
          setPaywallVisible(false);
          // Re-check entitlement after the modal closes so the card
          // disappears immediately once the trial / subscription lands.
          refreshEntitlement();
        }}
        onTrialStarted={refreshEntitlement}
        onSubscriptionRequested={refreshEntitlement}
        surface="profile"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: MIDNIGHT.bg,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Header
  header: {
    backgroundColor: MIDNIGHT.bg,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1f2e',
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    textAlign: 'center',
    flex: 1,
  },

  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },

  // Chem Plus upgrade card (between hero and About)
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.base,
    borderRadius: MIDNIGHT.radius.lg,
    backgroundColor: 'rgba(10, 127, 116, 0.10)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.aqua[700],
    marginBottom: SPACING.xl,
  },
  upgradeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeBody: {
    flex: 1,
  },
  upgradeTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[900],
  },
  upgradeSubtitle: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  avatarRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 3,
    borderColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: MIDNIGHT.surface,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MIDNIGHT.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroName: {
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    color: BRAND_COLORS.text[900],
    textAlign: 'center',
    marginTop: 16,
  },
  heroTagline: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.primary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Glass Card
  glassCard: {
    ...MIDNIGHT.glassCard,
    borderRadius: 24,
    padding: 24,
    marginBottom: 32,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    fontSize: TYPOGRAPHY.fontSize.lg,
    color: BRAND_COLORS.text[900],
  },
  cardBody: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[600],
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.relaxed,
  },
  viewAllText: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
  },

  // Photo Grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoGridItem: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1f2e',
  },
  photoGridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  addPhotoSlot: {
    borderRadius: 16,
    backgroundColor: '#1a1f2e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
  },

  // Photo Overlays
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  deletingText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    marginTop: SPACING.xs,
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
  errorIcon: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 24,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: MIDNIGHT.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: MIDNIGHT.radius.sm,
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
    zIndex: 2,
  },
  removePhotoText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },

  // Details Card
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[500],
  },
  detailValue: {
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: BRAND_COLORS.text[900],
  },
  detailValuePrimary: {
    color: BRAND_COLORS.primaryLight,
  },

  // Availability Chips
  availabilityChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  availChip: {
    backgroundColor: '#1a1f2e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availChipActive: {
    backgroundColor: 'rgba(10,127,116,0.2)',
    borderColor: 'rgba(10,127,116,0.3)',
  },
  availChipDay: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    color: BRAND_COLORS.text[600],
    textTransform: 'uppercase',
  },
  availChipDayActive: {
    color: BRAND_COLORS.primary,
  },
  availChipTime: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
  },
  availChipTimeActive: {
    color: BRAND_COLORS.primary,
  },
  availabilityHint: {
    fontSize: 11,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontStyle: 'italic',
    color: BRAND_COLORS.text[500],
    marginTop: 16,
  },

  // Accordion Section Headers (inside glass cards)
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sectionHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  sectionSummary: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginTop: 2,
  },
  sectionChevron: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: BRAND_COLORS.primary,
  },

  // Edit Section
  editSection: {
    gap: 12,
  },

  // Slots (availability edit mode)
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...MIDNIGHT.glassCardSm,
    padding: 12,
  },
  slotText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[900],
    flex: 1,
  },

  // Fields
  fieldLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[700],
  },
  fieldHint: {
    fontSize: TYPOGRAPHY.fontSize.xs + 1,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[500],
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    borderRadius: MIDNIGHT.radius.lg,
    padding: 14,
    fontSize: 16,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    backgroundColor: MIDNIGHT.inputBg,
    color: BRAND_COLORS.text[900],
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  clearLink: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.danger,
    marginTop: SPACING.xs,
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
    borderRadius: MIDNIGHT.radius.full,
    borderWidth: 1,
    borderColor: MIDNIGHT.borderDefault,
    backgroundColor: MIDNIGHT.glassCard.backgroundColor,
  },
  chipSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primary,
    ...MIDNIGHT.glow.selected,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[700],
  },
  chipTextSelected: {
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.onPrimary,
  },

  // Buttons
  saveButton: {
    marginTop: SPACING.lg,
  },
  signOutButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.base,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
});
