import { ReactNode } from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GOLDEN_HOUR } from '../../config/brand';

type GHScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
};

export default function GHScreen({ children, scroll, style, contentStyle }: GHScreenProps) {
  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, style]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, style]}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
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
