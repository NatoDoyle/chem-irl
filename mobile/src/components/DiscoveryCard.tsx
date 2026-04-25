import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FeedItem } from '../lib/types';
import { BRAND_COLORS, MIDNIGHT, REFINED_WARMTH, GOLD, TYPOGRAPHY, SPACING } from '../config/brand';
import AnimatedPressable from './ui/AnimatedPressable';

interface DiscoveryCardProps {
  item: FeedItem & { photos: string[] };
  onLike?: () => void;
  onPass?: () => void;
}

const PLACEHOLDER_IMAGE = require('../../assets/icon.png');

export default function DiscoveryCard({ item, onLike, onPass }: DiscoveryCardProps) {
  const primaryPhoto = item.photos[0] || null;

  return (
    <View style={styles.card}>
      {/* Photo area with gradient overlay */}
      <View style={styles.photoContainer}>
        <Image
          source={primaryPhoto ? { uri: primaryPhoto } : PLACEHOLDER_IMAGE}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
        <LinearGradient
          colors={REFINED_WARMTH.gradient.cardOverlay}
          style={styles.gradientOverlay}
        />

        {/* Availability badge on photo */}
        {item.availability_summary ? (
          <View style={styles.availabilityBadge}>
            <Text style={styles.availabilityText}>{item.availability_summary}</Text>
          </View>
        ) : null}
      </View>

      {/* Info area below photo */}
      <View style={styles.infoArea}>
        <Text style={styles.headline}>{item.full_name || 'Unknown'}</Text>

        {item.bio ? (
          <Text style={styles.bio} numberOfLines={2}>
            {item.bio}
          </Text>
        ) : null}

        {/* Score row with dividers */}
        <View style={styles.scores}>
          <View style={styles.scoreItem}>
            <Text style={styles.scoreNumber}>{item.action_speed}</Text>
            <Text style={styles.scoreLabel}>SPEED</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={styles.scoreNumber}>{item.attractiveness}</Text>
            <Text style={styles.scoreLabel}>APPEAL</Text>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreItem}>
            <Text style={styles.scoreNumber}>{item.reliability}</Text>
            <Text style={styles.scoreLabel}>RELIABLE</Text>
          </View>
        </View>

        {/* Action buttons */}
        {onLike && onPass && (
          <View style={styles.actions}>
            <AnimatedPressable onPress={onPass} style={styles.passButton} accessibilityLabel="Pass">
              <Ionicons name="close" size={24} color={BRAND_COLORS.text[500]} />
            </AnimatedPressable>

            <AnimatedPressable onPress={onLike} style={styles.likeButton} accessibilityLabel="Like">
              <Ionicons name="heart" size={36} color="#FFFFFF" />
            </AnimatedPressable>

            <AnimatedPressable
              onPress={onLike}
              style={styles.superButton}
              accessibilityLabel="Super Like"
            >
              <Ionicons name="flash" size={24} color={GOLD[600]} />
            </AnimatedPressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    ...MIDNIGHT.glassCard,
    overflow: 'hidden',
  },
  photoContainer: {
    flex: 1,
    position: 'relative',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  availabilityBadge: {
    position: 'absolute',
    bottom: SPACING.base,
    left: SPACING.base,
  },
  availabilityText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.primary,
  },
  infoArea: {
    paddingHorizontal: SPACING.base,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.base,
    gap: SPACING.sm,
  },
  headline: {
    fontSize: TYPOGRAPHY.fontSize['2xl'],
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.text[900],
  },
  bio: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    color: BRAND_COLORS.text[600],
    lineHeight: TYPOGRAPHY.fontSize.sm * TYPOGRAPHY.lineHeight.normal,
  },
  scores: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BRAND_COLORS.border,
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center',
  },
  scoreDivider: {
    height: 32,
    width: 1,
    backgroundColor: BRAND_COLORS.border,
  },
  scoreNumber: {
    fontSize: TYPOGRAPHY.fontSize.xl,
    fontFamily: TYPOGRAPHY.fontFamily.serifBold,
    color: BRAND_COLORS.primaryLight,
  },
  scoreLabel: {
    fontSize: 10,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    color: BRAND_COLORS.text[500],
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
    marginTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  passButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: BRAND_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...MIDNIGHT.glow.primary,
  },
  superButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: BRAND_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
