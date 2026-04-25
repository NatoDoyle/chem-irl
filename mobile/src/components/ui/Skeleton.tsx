import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { GOLDEN_HOUR, REFINED_WARMTH } from '../../config/brand';

type SkeletonProps = {
  width: number | `${number}%`;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({
  width,
  height,
  borderRadius = REFINED_WARMTH.radius.md,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#252a3a' }, animatedStyle, style]}
    />
  );
}

export function SkeletonText({
  width = '80%' as const,
  style,
}: {
  width?: number | `${number}%`;
  style?: ViewStyle;
}) {
  return <Skeleton width={width} height={14} borderRadius={7} style={style} />;
}

export function SkeletonAvatar({ size = 48, style }: { size?: number; style?: ViewStyle }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[skeletonStyles.card, style]}>
      <Skeleton width="100%" height={200} borderRadius={REFINED_WARMTH.radius.lg} />
      <View style={skeletonStyles.cardContent}>
        <SkeletonText width="60%" />
        <SkeletonText width="90%" style={{ marginTop: 8 }} />
        <SkeletonText width="40%" style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: GOLDEN_HOUR.surface,
    borderRadius: REFINED_WARMTH.radius.lg,
    overflow: 'hidden',
    ...REFINED_WARMTH.shadow.subtle,
  },
  cardContent: {
    padding: REFINED_WARMTH.spacing.base,
  },
});
