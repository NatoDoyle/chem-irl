import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../lib/supabase/client';
import { BRAND_COLORS, MIDNIGHT, TYPOGRAPHY, SPACING } from '../../config/brand';
import { getErrorAlert } from '../../lib/errors';
import AnimatedPressable from '../../components/ui/AnimatedPressable';

const PHOTO_WIDTH = 200;
const PHOTO_HEIGHT = 260;

const PLACEHOLDER_IMAGE = require('../../../assets/icon.png');

type ViewProfileRouteParams = {
  userId: string;
};

type ViewProfileNavigationProp = NativeStackNavigationProp<any, 'ViewProfile'>;

export default function ViewProfileScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const navigation = useNavigation<ViewProfileNavigationProp>();
  const { userId } = route.params as ViewProfileRouteParams;

  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [infoPills, setInfoPills] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
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

      // Mirror the pill extraction in MatchDetailScreen so this view stays
      // visually consistent when reached via the photo tap from a match card.
      const pills: string[] = [];
      const demographics = prompts.demographics as Record<string, any> | undefined;
      const preferences = prompts.preferences as Record<string, any> | undefined;
      if (demographics) {
        Object.entries(demographics).forEach(([, value]) => {
          if (typeof value === 'string' && value) pills.push(value);
          if (Array.isArray(value))
            value.forEach((v) => typeof v === 'string' && v && pills.push(v));
        });
      }
      if (preferences) {
        Object.entries(preferences).forEach(([, value]) => {
          if (typeof value === 'string' && value) pills.push(value);
          if (Array.isArray(value))
            value.forEach((v) => typeof v === 'string' && v && pills.push(v));
        });
      }
      setInfoPills(pills);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top }}>
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

      <View style={styles.header}>
        {photos.length > 0 ? (
          <View>
            <FlatList
              data={photos}
              horizontal
              pagingEnabled={false}
              showsHorizontalScrollIndicator={false}
              snapToInterval={PHOTO_WIDTH + SPACING.sm}
              decelerationRate="fast"
              contentContainerStyle={styles.photoGallery}
              keyExtractor={(item, index) => `${index}-${item}`}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / (PHOTO_WIDTH + SPACING.sm)
                );
                setActivePhotoIndex(Math.min(index, photos.length - 1));
              }}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={styles.galleryPhoto}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              )}
            />
            {photos.length > 1 && (
              <View style={styles.pageDots}>
                {photos.map((_, index) => (
                  <View
                    key={index}
                    style={[styles.pageDot, index === activePhotoIndex && styles.pageDotActive]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <Image
            source={PLACEHOLDER_IMAGE}
            style={styles.avatar}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}

        <Text style={styles.name}>{name}</Text>

        {bio ? <Text style={styles.bio}>{bio}</Text> : null}

        {infoPills.length > 0 && (
          <View style={styles.pillsContainer}>
            {infoPills.map((pill, index) => (
              <View key={`${pill}-${index}`} style={styles.pill}>
                <Text style={styles.pillText}>{pill}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MIDNIGHT.bg,
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
  header: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  photoGallery: {
    paddingHorizontal: SPACING.sm,
    gap: SPACING.sm,
  },
  galleryPhoto: {
    width: PHOTO_WIDTH,
    height: PHOTO_HEIGHT,
    borderRadius: MIDNIGHT.radius.md,
    backgroundColor: MIDNIGHT.borderDefault,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  pageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.text[500],
  },
  pageDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.primary,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: MIDNIGHT.borderDefault,
    marginBottom: SPACING.md,
    borderWidth: 3,
    borderColor: BRAND_COLORS.primary,
  },
  name: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
    marginTop: SPACING.md,
  },
  bio: {
    fontSize: TYPOGRAPHY.fontSize.base,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    marginTop: SPACING.sm,
    textAlign: 'center',
    lineHeight: TYPOGRAPHY.fontSize.base * TYPOGRAPHY.lineHeight.relaxed,
    paddingHorizontal: SPACING.base,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: SPACING.md,
    gap: SPACING.sm,
    paddingHorizontal: SPACING.base,
  },
  pill: {
    backgroundColor: 'rgba(17, 19, 24, 0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  pillText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[700],
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
