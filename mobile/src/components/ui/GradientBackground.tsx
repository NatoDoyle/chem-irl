import { ReactNode } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { REFINED_WARMTH } from '../../config/brand';

type GradientBackgroundProps = {
  children: ReactNode;
  colors?: readonly [string, string, ...string[]];
  style?: ViewStyle;
};

export default function GradientBackground({
  children,
  colors = REFINED_WARMTH.gradient.warmSurface,
  style,
}: GradientBackgroundProps) {
  return (
    <LinearGradient colors={colors} style={[styles.gradient, style]}>
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
});
