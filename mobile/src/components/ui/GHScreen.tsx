import { ReactNode } from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GOLDEN_HOUR, REFINED_WARMTH } from '../../config/brand';

type GHScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  gradient?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

export default function GHScreen({
  children,
  scroll,
  gradient,
  style,
  contentStyle,
}: GHScreenProps) {
  const inner = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, contentStyle]}>{children}</View>
  );

  if (gradient) {
    return (
      <LinearGradient colors={REFINED_WARMTH.gradient.warmSurface} style={[styles.safe, style]}>
        <SafeAreaView style={styles.safe}>{inner}</SafeAreaView>
      </LinearGradient>
    );
  }

  return <SafeAreaView style={[styles.safe, style]}>{inner}</SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: GOLDEN_HOUR.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
  },
});
