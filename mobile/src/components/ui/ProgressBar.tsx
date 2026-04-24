import { View, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { BRAND_COLORS, REFINED_WARMTH } from '../../config/brand';

type ProgressBarProps = {
  current: number;
  total: number;
};

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const progress = Math.min(current / total, 1);

  const animatedWidth = useAnimatedStyle(() => ({
    width: withTiming(`${progress * 100}%`, {
      duration: REFINED_WARMTH.animation.duration.normal,
      easing: Easing.out(Easing.ease),
    }),
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, animatedWidth]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    backgroundColor: REFINED_WARMTH.borderDefault,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: BRAND_COLORS.primary,
    borderRadius: 2,
  },
});
