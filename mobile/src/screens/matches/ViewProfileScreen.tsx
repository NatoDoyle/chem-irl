import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import AnimatedPressable from '../../components/ui/AnimatedPressable';
import {
  INTENT_OPTIONS,
  FAMILY_PLANS_OPTIONS,
  PETS_OPTIONS,
  ACTIVITY_OPTIONS,
  FREQUENCY_OPTIONS,
  LOVE_LANGUAGE_OPTIONS,
} from '../../config/profileOptions';

const PLACEHOLDER_IMAGE = require('../../../assets/icon.png');

type ViewProfileRouteParams = {
  userId: string;
};

type ViewProfileNavigationProp = NativeStackNavigationProp<any, 'ViewProfile'>;

type Demographics = {
  relationship_intent?: string;
  height_cm?: number | string;
  family_plans?: string;
  pets?: string;
  drinking?: string;
  smoking?: string;
  drugs?: string;
  diet?: string;
  activity_level?: string;
  love_language?: string;
  mbti?: string;
  astrology_sign?: string;
};

type Preferences = {
  languages?: string[];
  interests?: string[];
  work?: string;
  education?: string;
};

type InfoRow = { label: string; value: string };

type LookupOption = { value: string; label: string };

function lookupLabel(options: readonly LookupOption[], raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const hit = options.find((o) => o.value === raw);
  return hit?.label ?? raw;
}

function buildInfoRows(
  demographics: Demographics | undefined,
  preferences: Preferences | undefined
): InfoRow[] {
  const rows: InfoRow[] = [];
  const push = (label: string, value: string | undefined | null) => {
    if (value && value.trim().length > 0) rows.push({ label, value });
  };

  if (demographics) {
    push('Looking for', lookupLabel(INTENT_OPTIONS, demographics.relationship_intent));
    if (demographics.height_cm) push('Height', `${demographics.height_cm} cm`);
    push('Family plans', lookupLabel(FAMILY_PLANS_OPTIONS, demographics.family_plans));
    push('Pets', lookupLabel(PETS_OPTIONS, demographics.pets));
    push('Drinks', lookupLabel(FREQUENCY_OPTIONS, demographics.drinking));
    push('Smokes', lookupLabel(FREQUENCY_OPTIONS, demographics.smoking));
    push('Drugs', lookupLabel(FREQUENCY_OPTIONS, demographics.drugs));
    push('Diet', demographics.diet);
    push('Activity level', lookupLabel(ACTIVITY_OPTIONS, demographics.activity_level));
    push('Love language', lookupLabel(LOVE_LANGUAGE_OPTIONS, demographics.love_language));
    push('Personality', demographics.mbti);
    push('Astrology', demographics.astrology_sign);
  }

  if (preferences) {
    if (Array.isArray(preferences.languages) && preferences.languages.length > 0) {
      push('Languages', preferences.languages.join(', '));
    }
    push('Work', preferences.work);
    push('Education', preferences.education);
  }

  return rows;
}

export default function ViewProfileScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<ViewProfileNavigationProp>();
  const { userId } = route.params as ViewProfileRouteParams;

  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [demographics, setDemographics] = useState<Demographics | undefined>();
  const [preferences, setPreferences] = useState<Preferences | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, photos, prompts')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        const { message } = getErrorAlert(profileError, 'Failed to load profile');
        setError(message);
        return;
      }
      if (!profile) {
        setError('Profile not found');
        return;
      }

      const profilePhotos = (profile.photos as string[]) || [];
      const prompts = (profile.prompts as Record<string, any>) || {};

      setPhotos(profilePhotos);
      setName(profile.full_name || 'No name');
      setBio(prompts.bio || '');
      setDemographics(prompts.demographics as Demographics | undefined);
      setPreferences(prompts.preferences as Preferences | undefined);
    } catch (err: any) {
      const { message } = getErrorAlert(err, 'Failed to load profile');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const infoRows = useMemo(
    () => buildInfoRows(demographics, preferences),
    [demographics, preferences]
  );
  const interests = useMemo(() => {
    const list = preferences?.interests;
    return Array.isArray(list) ? list.filter((i): i is string => typeof i === 'string' && !!i) : [];
  }, [preferences]);

  const hasRichContent = bio.length > 0 || infoRows.length > 0 || interests.length > 0;

  if (loading) {
    return (
      <View style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={BRAND_COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
        <AnimatedPressable style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </AnimatedPressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
    >
      <View style={styles.backButtonRow}>
        <AnimatedPressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          haptic={false}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={BRAND_COLORS.primary} />
        </AnimatedPressable>
      </View>

      {/* Hero photo + name. The first photo gets full width; this is the
          surface the user came here to see. */}
      {photos.length > 0 ? (
        <Image
          source={{ uri: photos[0] }}
          style={styles.heroPhoto}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.heroPhotoFallbackWrap}>
          <Image
            source={PLACEHOLDER_IMAGE}
            style={styles.heroPhotoFallback}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        </View>
      )}

      <View style={styles.headerBlock}>
        <Text style={styles.name}>{name}</Text>
        {bio ? <Text style={styles.bio}>{bio}</Text> : null}
      </View>

      {infoRows.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.infoCard}>
            {infoRows.map((row, idx) => (
              <View
                key={row.label}
                style={[styles.infoRow, idx < infoRows.length - 1 && styles.infoRowDivider]}
              >
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {interests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.chipRow}>
            {interests.map((interest, idx) => (
              <View key={`${interest}-${idx}`} style={styles.chip}>
                <Text style={styles.chipText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Remaining photos stacked vertically. Hinge-style: the user keeps
          scrolling and sees more of the person rather than swiping a tiny
          carousel. */}
      {photos.slice(1).map((uri, idx) => (
        <Image
          key={`${idx}-${uri}`}
          source={{ uri }}
          style={styles.galleryPhoto}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ))}

      {!hasRichContent && (
        <Text style={styles.sparseHint}>This profile hasn&apos;t added more details yet.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
  },
  scrollContent: {
    paddingBottom: SPACING['2xl'],
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    height: 48,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: MIDNIGHT.borderDefault,
  },
  heroPhotoFallbackWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MIDNIGHT.borderDefault,
  },
  heroPhotoFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: BRAND_COLORS.primary,
  },
  headerBlock: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    alignItems: 'center',
  },
  name: {
    fontSize: TYPOGRAPHY.fontSize['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    textAlign: 'center',
  },
  bio: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[700],
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
    color: BRAND_COLORS.text[600],
    textTransform: 'uppercase',
    letterSpacing: TYPOGRAPHY.letterSpacing.wide,
    marginBottom: SPACING.sm,
  },
  infoCard: {
    backgroundColor: 'rgba(17, 19, 24, 0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: MIDNIGHT.radius.md,
    paddingHorizontal: SPACING.base,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  infoRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1f2e',
  },
  infoLabel: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[600],
  },
  infoValue: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[900],
    textAlign: 'right',
    flexShrink: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chip: {
    backgroundColor: 'rgba(10, 127, 116, 0.18)',
    borderWidth: 1,
    borderColor: BRAND_COLORS.primary,
    borderRadius: 18,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  chipText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.primaryLight,
  },
  galleryPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: MIDNIGHT.borderDefault,
    marginTop: SPACING.md,
  },
  sparseHint: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    fontStyle: 'italic',
    color: BRAND_COLORS.text[600],
    textAlign: 'center',
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  errorText: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.danger,
    textAlign: 'center',
    marginBottom: SPACING.base,
    paddingHorizontal: SPACING.xl,
  },
  retryButton: {
    backgroundColor: BRAND_COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: MIDNIGHT.radius.lg,
    alignSelf: 'center',
    marginTop: SPACING.sm,
  },
  retryButtonText: {
    color: BRAND_COLORS.onPrimary,
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
});
