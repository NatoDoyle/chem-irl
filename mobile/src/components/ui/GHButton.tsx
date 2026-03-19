import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { BRAND_COLORS, GOLDEN_HOUR } from '../../config/brand';

type GHButtonVariant = 'primary' | 'secondary' | 'coral';

type GHButtonProps = {
  title: string;
  onPress: () => void;
  variant?: GHButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function GHButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: GHButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant],
        GOLDEN_HOUR.shadow.warm,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? BRAND_COLORS.primary : '#fff'} />
      ) : (
        <Text style={[styles.textBase, variantTextStyles[variant], textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: GOLDEN_HOUR.radius.lg,
    alignItems: 'center' as const,
  },
  disabled: {
    opacity: 0.6,
  },
  textBase: {
    fontSize: 18,
    fontWeight: '600',
  },
});

const variantStyles: Record<GHButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: BRAND_COLORS.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
  },
  coral: {
    backgroundColor: GOLDEN_HOUR.coral,
  },
};

const variantTextStyles: Record<GHButtonVariant, TextStyle> = {
  primary: {
    color: '#fff',
  },
  secondary: {
    color: BRAND_COLORS.primary,
  },
  coral: {
    color: '#fff',
  },
};
