import { ReactNode } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { REFINED_WARMTH } from '../../config/brand';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type AnimatedPressableProps = {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  accessibilityRole?: 'button' | 'link' | 'tab';
  accessibilityLabel?: string;
};

export default function AnimatedPressable({
  children,
  onPress,
  disabled = false,
  haptic = true,
  style,
  hitSlop,
  accessibilityRole = 'button',
  accessibilityLabel,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const { default: springConfig } = REFINED_WARMTH.animation.spring;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, springConfig);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const handlePress = () => {
    if (haptic) {
      Haptics.selectionAsync();
    }
    onPress();
  };

  return (
    <AnimatedPressableBase
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[animatedStyle, style]}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </AnimatedPressableBase>
  );
}
