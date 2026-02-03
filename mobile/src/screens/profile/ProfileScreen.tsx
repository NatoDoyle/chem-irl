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
import DateTimePicker from '@react-native-community/datetimepicker';
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
import { UserGender, UserOrientation } from '../../lib/types';

type PhotoUploadState = 'idle' | 'uploading' | 'success' | 'error';
type PhotoDeletionState = 'idle' | 'deleting';

// Validation constants (matching DB constraints)
const HEIGHT_MIN = 50;
const HEIGHT_MAX = 250;
const FAV_DATES_MAX = 3;

// Options constants (matching onboarding screens)
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

const FAMILY_PLANS_OPTIONS = [
  { value: 'wants_kids', label: 'Wants kids' },
  { value: 'no_kids', label: "Doesn't want kids" },
  { value: 'has_kids', label: 'Has kids' },
  { value: 'unsure', label: 'Unsure' },
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

const LOVE_LANGUAGE_OPTIONS = [
  { value: 'words', label: 'Words of Affirmation' },
  { value: 'acts', label: 'Acts of Service' },
  { value: 'gifts', label: 'Receiving Gifts' },
  { value: 'time', label: 'Quality Time' },
  { value: 'touch', label: 'Physical Touch' },
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

const PETS_OPTIONS = [
  { value: 'has_pets', label: 'Has pets' },
  { value: 'wants_pets', label: 'Wants pets' },
  { value: 'allergic', label: "Allergic / doesn't want" },
  { value: 'no_preference', label: 'No preference' },
];

const FREQUENCY_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

export default function ProfileScreen() {
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [availabilitySummary, setAvailabilitySummary] = useState('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [favouriteFirstDates, setFavouriteFirstDates] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  // Demographics from users table
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [gender, setGender] = useState<UserGender | null>(null);
  const [orientation, setOrientation] = useState<UserOrientation | null>(null);
  // Location from profiles.availability (read-only display)
  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);
  const [lastKnownLat, setLastKnownLat] = useState<number | null>(null);
  const [lastKnownLng, setLastKnownLng] = useState<number | null>(null);

  // Additional profile fields from prompts JSONB
  const [astrologySign, setAstrologySign] = useState<string | null>(null);
  const [familyPlans, setFamilyPlans] = useState<string | null>(null);
  const [languages, setLanguages] = useState<string[]>([]);
  const [loveLanguage, setLoveLanguage] = useState<string | null>(null);
  const [personalityType, setPersonalityType] = useState<string | null>(null);
  const [customPersonalityType, setCustomPersonalityType] = useState('');
  const [pets, setPets] = useState<string | null>(null);
  // Lifestyle fields
  const [drinking, setDrinking] = useState<string | null>(null);
  const [smoking, setSmoking] = useState<string | null>(null);
  const [drugs, setDrugs] = useState<string | null>(null);
  const [activityLevel, setActivityLevel] = useState<string | null>(null);
  const [diet, setDiet] = useState('');

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [supportsHeightCm, setSupportsHeightCm] = useState(false);
  const [supportsFavouriteFirstDates, setSupportsFavouriteFirstDates] = useState(false);
  // Track whether bio is a column (canonical) or only in JSONB
  const [hasBioColumn, setHasBioColumn] = useState(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // loadProfile doesn't depend on any props/state that change

  // Self-healing: clamp favourite_first_dates state if it exceeds max
  useEffect(() => {
    if (supportsFavouriteFirstDates && favouriteFirstDates.length > FAV_DATES_MAX) {
      setFavouriteFirstDates((prev) => prev.slice(0, FAV_DATES_MAX));
    }
  }, [supportsFavouriteFirstDates, favouriteFirstDates.length]);

  // Check if error indicates missing column/schema cache
  const isMissingColumnError = (err: any): boolean => {
    if (!err) return false;
    const code = err.code;
    const message = err.message?.toLowerCase() || '';

    // Only match specific error codes or specific message patterns
    return (
      code === '42703' ||
      code === 'PGRST204' ||
      message.includes('schema cache') ||
      message.includes('could not find the') ||
      message.includes('does not exist') ||
      message.includes('unknown field')
    );
  };

  const loadProfile = async () => {
    // Reset support flags at start of each run
    setSupportsHeightCm(false);
    setSupportsFavouriteFirstDates(false);
    setHasBioColumn(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      let profile: any = null;
      let error: any = null;
      let hasHeightCm = false;
      let hasFavouriteDates = false;
      let hasBioCol = false;

      // Strategy 1: Try all fields including bio column (if it exists)
      // Note: If columns don't exist, PostgREST will return error code 42703
      let result = await supabase
        .from('profiles')
        .select(
          'full_name, prompts, photos, availability, completion_pct, height_cm, favourite_first_dates, bio'
        )
        .eq('id', user.id)
        .maybeSingle();

      if (!result.error && result.data) {
        // Success with all fields - check if bio column exists
        profile = result.data;
        hasHeightCm = true;
        hasFavouriteDates = true;
        // Check if bio is present as a column (not just in prompts JSONB)
        hasBioCol = 'bio' in profile;
      } else if (isMissingColumnError(result.error)) {
        // Strategy 2: Try without bio column (it doesn't exist as column)
        // Try with height_cm and favourite_first_dates
        result = await supabase
          .from('profiles')
          .select(
            'full_name, prompts, photos, availability, completion_pct, height_cm, favourite_first_dates'
          )
          .eq('id', user.id)
          .maybeSingle();

        if (!result.error && result.data) {
          profile = result.data;
          hasHeightCm = true;
          hasFavouriteDates = true;
          hasBioCol = false;
        } else if (isMissingColumnError(result.error)) {
          // Strategy 3: Try with height_cm only
          result = await supabase
            .from('profiles')
            .select('full_name, prompts, photos, availability, completion_pct, height_cm')
            .eq('id', user.id)
            .maybeSingle();

          if (!result.error && result.data) {
            profile = result.data;
            hasHeightCm = true;
            hasFavouriteDates = false;
            hasBioCol = false;
          } else if (isMissingColumnError(result.error)) {
            // Strategy 4: Try with favourite_first_dates only
            result = await supabase
              .from('profiles')
              .select(
                'full_name, prompts, photos, availability, completion_pct, favourite_first_dates'
              )
              .eq('id', user.id)
              .maybeSingle();

            if (!result.error && result.data) {
              profile = result.data;
              hasHeightCm = false;
              hasFavouriteDates = true;
              hasBioCol = false;
            } else if (isMissingColumnError(result.error)) {
              // Strategy 5: Fallback to core fields only
              result = await supabase
                .from('profiles')
                .select('full_name, prompts, photos, availability, completion_pct')
                .eq('id', user.id)
                .maybeSingle();

              if (!result.error && result.data) {
                profile = result.data;
                hasHeightCm = false;
                hasFavouriteDates = false;
                hasBioCol = false;
              } else {
                error = result.error;
              }
            } else {
              error = result.error;
            }
          } else {
            error = result.error;
          }
        } else {
          error = result.error;
        }
      } else {
        error = result.error;
      }

      // Set support flags
      setSupportsHeightCm(hasHeightCm);
      setSupportsFavouriteFirstDates(hasFavouriteDates);
      setHasBioColumn(hasBioCol);

      if (error && !isMissingColumnError(error)) {
        console.error('Error loading profile:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        const { title, message } = getErrorAlert(
          error,
          'Failed to load profile. Please check your connection and try again.'
        );
        Alert.alert(title, message);
        setLoading(false);
        return;
      }

      if (profile) {
        setFullName(profile.full_name || '');
        const prompts = (profile?.prompts ?? {}) as Record<string, any>;

        // Compatibility: Read from canonical source (columns if exist, else JSONB)
        // If columns exist, prefer them (even if null/empty); otherwise fallback to prompts JSONB
        if (hasBioCol) {
          setBio(profile.bio || '');
        } else {
          setBio(prompts.bio || '');
        }

        const availability = (profile?.availability ?? {}) as Record<string, any>;
        setAvailabilitySummary(availability.summary || '');
        setLocationPermissionGranted(availability.location_permission_granted ?? null);
        setLastKnownLat(availability.last_known_lat ?? null);
        setLastKnownLng(availability.last_known_lng ?? null);
        const loadedPhotos = (profile.photos as string[]) || [];
        setPhotos(loadedPhotos);

        // Extended fields (only if supported) - normalize data types
        if (hasHeightCm) {
          setHeightCm(profile.height_cm != null ? String(profile.height_cm) : '');
        } else {
          setHeightCm('');
        }

        if (hasFavouriteDates) {
          setFavouriteFirstDates(
            Array.isArray(profile.favourite_first_dates) ? profile.favourite_first_dates : []
          );
        } else {
          setFavouriteFirstDates([]);
        }

        // Load additional fields from prompts JSONB
        const preferences = prompts.preferences || {};
        const demographics = prompts.demographics || {};

        // Preferences
        setAstrologySign(preferences.astrology_sign || null);
        setLoveLanguage(preferences.love_language || null);
        const loadedPersonalityType = preferences.personality_type || null;
        // Check if it's a standard MBTI type or custom
        if (loadedPersonalityType && MBTI_OPTIONS.includes(loadedPersonalityType)) {
          setPersonalityType(loadedPersonalityType);
          setCustomPersonalityType('');
        } else if (loadedPersonalityType) {
          setPersonalityType(null);
          setCustomPersonalityType(loadedPersonalityType);
        } else {
          setPersonalityType(null);
          setCustomPersonalityType('');
        }

        // Demographics
        setFamilyPlans(demographics.family_plans || null);
        setLanguages(Array.isArray(demographics.languages) ? demographics.languages : []);
        setPets(demographics.pets || null);

        // Lifestyle
        setDrinking(demographics.drinking || null);
        setSmoking(demographics.smoking || null);
        setDrugs(demographics.drugs || null);
        setActivityLevel(demographics.activity_level || null);
        setDiet(demographics.diet || '');

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

  const handleSave = async () => {
    const fullNameTrimmed = fullName.trim();
    const bioTrimmed = bio.trim();

    if (!fullNameTrimmed) {
      Alert.alert('Error', 'Please enter your full name');
      return;
    }

    if (!bioTrimmed) {
      Alert.alert('Error', 'Please fill in your bio');
      return;
    }

    if (bioTrimmed.length < 20) {
      Alert.alert('Error', 'Bio must be at least 20 characters');
      return;
    }

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

      // Load current profile to merge JSON objects (preserve existing keys)
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('prompts, availability')
        .eq('id', user.id)
        .maybeSingle();

      // Merge prompts: preserve existing keys, update bio
      const currentPrompts = (currentProfile?.prompts ?? {}) as Record<string, any>;
      const sanitizedBio = sanitizeMultilineText(bioTrimmed);

      // Build preferences object
      const updatedPreferences: Record<string, any> = {
        ...(currentPrompts.preferences || {}),
      };
      // Handle astrology sign (null clears it)
      if (astrologySign !== undefined) {
        updatedPreferences.astrology_sign = astrologySign;
      }
      // Handle love language (null clears it)
      if (loveLanguage !== undefined) {
        updatedPreferences.love_language = loveLanguage;
      }
      // Handle personality type (custom or MBTI, null clears it)
      const effectivePersonalityType = personalityType || customPersonalityType.trim() || null;
      updatedPreferences.personality_type = effectivePersonalityType;

      // Build demographics object
      const updatedDemographics: Record<string, any> = {
        ...(currentPrompts.demographics || {}),
      };
      // Handle family plans (null clears it)
      if (familyPlans !== undefined) {
        updatedDemographics.family_plans = familyPlans;
      }
      // Handle languages (empty array clears it)
      updatedDemographics.languages = languages.length > 0 ? languages : null;
      // Handle pets (null clears it)
      if (pets !== undefined) {
        updatedDemographics.pets = pets;
      }
      // Handle lifestyle fields
      if (drinking !== undefined) {
        updatedDemographics.drinking = drinking;
      }
      if (smoking !== undefined) {
        updatedDemographics.smoking = smoking;
      }
      if (drugs !== undefined) {
        updatedDemographics.drugs = drugs;
      }
      if (activityLevel !== undefined) {
        updatedDemographics.activity_level = activityLevel;
      }
      updatedDemographics.diet = diet.trim() || null;

      // Merge availability: preserve existing keys, update summary
      const currentAvailability = (currentProfile?.availability ?? {}) as Record<string, any>;
      const sanitizedAvailabilitySummary = availabilitySummary.trim()
        ? sanitizeMultilineText(availabilitySummary.trim())
        : null;

      // Sanitize full name
      const sanitizedFullName = sanitizeText(fullNameTrimmed);

      // Normalize height_cm input (50-250 inclusive, blank => null)
      let normalizedHeightCm: number | null = null;
      if (supportsHeightCm) {
        const heightTrimmed = heightCm.trim();
        if (heightTrimmed !== '') {
          const parsed = parseInt(heightTrimmed, 10);
          if (isNaN(parsed)) {
            Alert.alert('Error', 'Height must be a valid number');
            setSaving(false);
            return;
          }
          if (parsed < HEIGHT_MIN || parsed > HEIGHT_MAX) {
            Alert.alert(
              'Error',
              `Height must be between ${HEIGHT_MIN} and ${HEIGHT_MAX} cm (inclusive)`
            );
            setSaving(false);
            return;
          }
          normalizedHeightCm = parsed;
        }
        // else: blank => null (allowed by DB constraint)
      }

      // Normalize favourite_first_dates input (trim, remove empties, de-duplicate case-insensitive, cap to 3)
      let normalizedFavouriteDates: string[] = [];
      if (supportsFavouriteFirstDates) {
        const trimmed = favouriteFirstDates.map((d) => d.trim()).filter((d) => d !== '');
        // De-duplicate case-insensitive
        const seen = new Set<string>();
        normalizedFavouriteDates = trimmed
          .filter((d) => {
            const lower = d.toLowerCase();
            if (seen.has(lower)) {
              return false;
            }
            seen.add(lower);
            return true;
          })
          .slice(0, FAV_DATES_MAX); // cap at 3 (DB constraint)
      }

      // Defense in depth: ensure normalizedFavouriteDates is ALWAYS capped before upsert
      if (supportsFavouriteFirstDates && normalizedFavouriteDates.length > FAV_DATES_MAX) {
        normalizedFavouriteDates = normalizedFavouriteDates.slice(0, FAV_DATES_MAX);
      }

      // Build upsert payload
      const upsertPayload: Record<string, any> = {
        id: user.id,
        full_name: sanitizedFullName,
        prompts: {
          ...currentPrompts,
          bio: sanitizedBio,
          preferences: updatedPreferences,
          demographics: updatedDemographics,
        },
        availability: {
          ...currentAvailability,
          summary: sanitizedAvailabilitySummary,
        },
        photos: photos,
        completion_pct: photos.length >= 1 ? 100 : 50,
      };

      // Compatibility: If bio column exists, write to both column and JSONB
      if (hasBioColumn) {
        upsertPayload.bio = sanitizedBio;
      }

      // Add extended fields only if supported
      if (supportsHeightCm) {
        // Explicitly set to null if cleared (blank input), otherwise use normalized value
        upsertPayload.height_cm = normalizedHeightCm;
      }
      if (supportsFavouriteFirstDates) {
        // Never write NULL (DB may enforce NOT NULL). Cap at FAV_DATES_MAX before write.
        const toWrite = normalizedFavouriteDates.length > 0 ? normalizedFavouriteDates : [];
        upsertPayload.favourite_first_dates = toWrite.slice(0, FAV_DATES_MAX);
      }

      const { error: profileError } = await supabase.from('profiles').upsert(upsertPayload);

      if (profileError) {
        const { title, message } = getErrorAlert(profileError, 'Failed to update profile');
        Alert.alert(title, message);
        setSaving(false);
        return;
      }

      // Save users table data (DOB, gender, orientation)
      // Format DOB as YYYY-MM-DD (local date, not UTC)
      if (!dateOfBirth) {
        Alert.alert('Error', 'Date of birth is required');
        setSaving(false);
        return;
      }
      const year = dateOfBirth.getFullYear();
      const month = String(dateOfBirth.getMonth() + 1).padStart(2, '0');
      const day = String(dateOfBirth.getDate()).padStart(2, '0');
      const dobString = `${year}-${month}-${day}`;

      const { error: userError } = await supabase
        .from('users')
        .update({
          dob: dobString,
          gender: gender,
          orientation: orientation,
        })
        .eq('user_id', user.id)
        .select('user_id')
        .single();

      if (userError) {
        console.error('Error saving user data:', {
          message: userError.message,
          code: userError.code,
          details: userError.details,
          hint: userError.hint,
        });
        const { title, message } = getErrorAlert(userError, 'Failed to update profile');
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
        id: user.id,
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
        <Text style={styles.sectionTitle}>Basic Information</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          placeholder="Your full name"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={fullName}
          onChangeText={setFullName}
          maxLength={100}
          editable={!saving}
        />

        <Text style={styles.label}>Date of Birth</Text>
        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
            disabled={saving}
          >
            <Text style={styles.dateButtonText}>
              {dateOfBirth
                ? dateOfBirth.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Select date of birth'}
            </Text>
          </TouchableOpacity>
        )}
        {(showDatePicker || Platform.OS === 'ios') && (
          <DateTimePicker
            value={dateOfBirth || new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedDate) => {
              if (Platform.OS === 'android') {
                setShowDatePicker(false);
              }
              if (selectedDate) {
                setDateOfBirth(selectedDate);
              }
            }}
            maximumDate={new Date()}
            minimumDate={new Date(1900, 0, 1)}
          />
        )}

        <Text style={styles.label}>Gender</Text>
        <View style={styles.optionsContainer}>
          {(['male', 'female', 'non_binary', 'other'] as UserGender[]).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.optionButton, gender === option && styles.optionButtonSelected]}
              onPress={() => setGender(option)}
              disabled={saving}
            >
              <Text style={[styles.optionText, gender === option && styles.optionTextSelected]}>
                {option.charAt(0).toUpperCase() + option.slice(1).replace('_', '-')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Interested In</Text>
        <View style={styles.optionsContainer}>
          {(
            [
              'straight',
              'gay',
              'lesbian',
              'bisexual',
              'pansexual',
              'asexual',
              'other',
            ] as UserOrientation[]
          ).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.optionButton, orientation === option && styles.optionButtonSelected]}
              onPress={() => setOrientation(option)}
              disabled={saving}
            >
              <Text
                style={[styles.optionText, orientation === option && styles.optionTextSelected]}
              >
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {locationPermissionGranted !== null && (
          <>
            <Text style={styles.label}>Location Permission</Text>
            <View
              style={[
                styles.infoBox,
                locationPermissionGranted ? styles.infoBoxSuccess : styles.infoBoxWarning,
              ]}
            >
              <Text style={styles.infoBoxText}>
                {locationPermissionGranted
                  ? '✓ Location permission granted'
                  : 'Location permission not granted'}
              </Text>
              {lastKnownLat !== null && lastKnownLng !== null && (
                <Text style={styles.infoBoxSubtext}>
                  Last known: {lastKnownLat.toFixed(4)}, {lastKnownLng.toFixed(4)}
                </Text>
              )}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Profile Content</Text>

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

        <Text style={styles.label}>Availability Summary</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="When are you typically available? (e.g., 'Weekends and evenings')"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={availabilitySummary}
          onChangeText={setAvailabilitySummary}
          multiline
          numberOfLines={3}
          maxLength={200}
          editable={!saving}
        />

        <Text style={styles.sectionTitle}>Preferences</Text>

        <Text style={styles.label}>Astrology Sign</Text>
        <View style={styles.optionsContainer}>
          {ASTROLOGY_SIGNS.map((sign) => (
            <TouchableOpacity
              key={sign}
              style={[styles.optionButton, astrologySign === sign && styles.optionButtonSelected]}
              onPress={() => setAstrologySign(sign)}
              disabled={saving}
            >
              <Text
                style={[styles.optionText, astrologySign === sign && styles.optionTextSelected]}
              >
                {sign}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {astrologySign && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setAstrologySign(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear astrology sign</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Love Language</Text>
        <View style={styles.optionsContainer}>
          {LOVE_LANGUAGE_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                loveLanguage === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => setLoveLanguage(option.value)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.optionText,
                  loveLanguage === option.value && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {loveLanguage && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setLoveLanguage(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear love language</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Personality Type</Text>
        <View style={styles.optionsContainer}>
          {MBTI_OPTIONS.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.optionButton, personalityType === type && styles.optionButtonSelected]}
              onPress={() => {
                setPersonalityType(type);
                setCustomPersonalityType('');
              }}
              disabled={saving}
            >
              <Text
                style={[styles.optionText, personalityType === type && styles.optionTextSelected]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Or enter custom personality type"
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={customPersonalityType}
          onChangeText={(text) => {
            setCustomPersonalityType(text);
            if (text.trim()) setPersonalityType(null);
          }}
          maxLength={50}
          editable={!saving}
        />
        {(personalityType || customPersonalityType.trim()) && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              setPersonalityType(null);
              setCustomPersonalityType('');
            }}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear personality type</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Demographics</Text>

        <Text style={styles.label}>Family Plans</Text>
        <View style={styles.optionsContainer}>
          {FAMILY_PLANS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                familyPlans === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => setFamilyPlans(option.value)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.optionText,
                  familyPlans === option.value && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {familyPlans && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setFamilyPlans(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear family plans</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Languages</Text>
        <View style={styles.optionsContainer}>
          {LANGUAGE_OPTIONS.map((language) => {
            const isSelected = languages.includes(language);
            return (
              <TouchableOpacity
                key={language}
                style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                onPress={() => {
                  if (isSelected) {
                    setLanguages(languages.filter((l) => l !== language));
                  } else {
                    setLanguages([...languages, language]);
                  }
                }}
                disabled={saving}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {language}
                  {isSelected ? ' ✓' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {languages.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setLanguages([])}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear all languages</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Pets</Text>
        <View style={styles.optionsContainer}>
          {PETS_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionButton, pets === option.value && styles.optionButtonSelected]}
              onPress={() => setPets(option.value)}
              disabled={saving}
            >
              <Text style={[styles.optionText, pets === option.value && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {pets && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setPets(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear pets preference</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Lifestyle</Text>

        <Text style={styles.label}>Drinking</Text>
        <View style={styles.optionsContainer}>
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                drinking === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => setDrinking(option.value)}
              disabled={saving}
            >
              <Text
                style={[styles.optionText, drinking === option.value && styles.optionTextSelected]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {drinking && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setDrinking(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear drinking preference</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Smoking</Text>
        <View style={styles.optionsContainer}>
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionButton, smoking === option.value && styles.optionButtonSelected]}
              onPress={() => setSmoking(option.value)}
              disabled={saving}
            >
              <Text
                style={[styles.optionText, smoking === option.value && styles.optionTextSelected]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {smoking && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSmoking(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear smoking preference</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Drugs</Text>
        <View style={styles.optionsContainer}>
          {FREQUENCY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.optionButton, drugs === option.value && styles.optionButtonSelected]}
              onPress={() => setDrugs(option.value)}
              disabled={saving}
            >
              <Text
                style={[styles.optionText, drugs === option.value && styles.optionTextSelected]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {drugs && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setDrugs(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear drugs preference</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Activity Level</Text>
        <View style={styles.optionsContainer}>
          {ACTIVITY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.optionButton,
                activityLevel === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => setActivityLevel(option.value)}
              disabled={saving}
            >
              <Text
                style={[
                  styles.optionText,
                  activityLevel === option.value && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {activityLevel && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setActivityLevel(null)}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear activity level</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Diet</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g., Vegetarian, Vegan, Keto, etc."
          placeholderTextColor={BRAND_COLORS.text[600]}
          value={diet}
          onChangeText={setDiet}
          maxLength={100}
          editable={!saving}
        />
        {diet.trim() && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setDiet('')}
            disabled={saving}
          >
            <Text style={styles.clearButtonText}>Clear diet</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Extended Preferences</Text>

        {supportsHeightCm && (
          <>
            <Text style={styles.label}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder={`Your height in centimeters (${HEIGHT_MIN}-${HEIGHT_MAX})`}
              placeholderTextColor={BRAND_COLORS.text[600]}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              maxLength={3}
              editable={!saving}
            />
          </>
        )}

        {supportsFavouriteFirstDates && (
          <>
            <Text style={styles.label}>Favourite First Dates (up to {FAV_DATES_MAX})</Text>
            <View style={styles.listContainer}>
              {favouriteFirstDates.map((date, index) => (
                <View key={index} style={styles.listItem}>
                  <TextInput
                    style={[styles.input, styles.listItemInput]}
                    placeholder="Date idea"
                    placeholderTextColor={BRAND_COLORS.text[600]}
                    value={date}
                    onChangeText={(text) => {
                      const updated = [...favouriteFirstDates];
                      updated[index] = text;
                      setFavouriteFirstDates(updated);
                    }}
                    maxLength={100}
                    editable={!saving}
                  />
                  <TouchableOpacity
                    style={styles.removeItemButton}
                    onPress={() => {
                      setFavouriteFirstDates(favouriteFirstDates.filter((_, i) => i !== index));
                    }}
                    disabled={saving}
                  >
                    <Text style={styles.removeItemText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {favouriteFirstDates.length < FAV_DATES_MAX && (
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={() => {
                    setFavouriteFirstDates([...favouriteFirstDates, '']);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.addItemText}>+ Add Date Idea</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

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
  listContainer: {
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemInput: {
    flex: 1,
  },
  removeItemButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND_COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeItemText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  addItemButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_COLORS.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  addItemText: {
    color: BRAND_COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: BRAND_COLORS.text[900],
    marginTop: 24,
    marginBottom: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    minWidth: 100,
    alignItems: 'center',
  },
  optionButtonSelected: {
    borderColor: BRAND_COLORS.primary,
    backgroundColor: BRAND_COLORS.primarySoft || '#D1FFFB',
  },
  optionText: {
    fontSize: 16,
    color: BRAND_COLORS.text[900],
    fontWeight: '500',
  },
  optionTextSelected: {
    color: BRAND_COLORS.primary,
    fontWeight: '600',
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  infoBoxSuccess: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  infoBoxWarning: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  infoBoxText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#065F46',
  },
  infoBoxSubtext: {
    fontSize: 12,
    color: '#047857',
    marginTop: 4,
  },
  clearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  clearButtonText: {
    color: BRAND_COLORS.danger,
    fontSize: 14,
    fontWeight: '500',
  },
});
