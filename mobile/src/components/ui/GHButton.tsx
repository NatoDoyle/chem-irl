import { ReactNode } from 'react';
import { Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import {
  BRAND_COLORS,
  GOLDEN_HOUR,
  MIDNIGHT,
  REFINED_WARMTH,
  TYPOGRAPHY,
} from '../../config/brand';
import AnimatedPressable from './AnimatedPressable';

type GHButtonVariant = 'primary' | 'secondary' | 'coral' | 'gold' | 'ghost';

type GHButtonProps = {
  title: string;
  onPress: () => void;
  variant?: GHButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: ReactNode;
  iconPosition?: 'leading' | 'trailing';
  haptic?: boolean;
};

export default function GHButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  iconPosition = 'leading',
  haptic = true,
}: GHButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      haptic={haptic}
      style={[
        styles.base,
        variantStyles[variant],
        REFINED_WARMTH.shadow.warm,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? BRAND_COLORS.primary : '#fff'} />
      ) : (
        <>
          {icon && iconPosition === 'leading' && icon}
          <Text
            style={[
              styles.textBase,
              variantTextStyles[variant],
              icon
                ? iconPosition === 'leading'
                  ? styles.textWithLeadingIcon
                  : styles.textWithTrailingIcon
                : undefined,
              textStyle,
            ]}
          >
            {title}
          </Text>
          {icon && iconPosition === 'trailing' && icon}
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: MIDNIGHT.radius.md,
    alignItems: 'center' as const,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  textBase: {
    fontSize: TYPOGRAPHY.fontSize.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semibold,
  },
  textWithLeadingIcon: {
    marginLeft: 8,
  },
  textWithTrailingIcon: {
    marginRight: 8,
  },
});

const variantStyles: Record<GHButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: BRAND_COLORS.primary,
    ...MIDNIGHT.glow.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: BRAND_COLORS.primary,
    ...MIDNIGHT.glow.primary,
  },
  coral: {
    backgroundColor: GOLDEN_HOUR.coral,
  },
  gold: {
    backgroundColor: REFINED_WARMTH.gold,
    ...MIDNIGHT.glow.gold,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
};

const variantTextStyles: Record<GHButtonVariant, TextStyle> = {
  primary: {
    color: '#fff',
  },
  secondary: {
    color: BRAND_COLORS.text[900],
  },
  coral: {
    color: '#fff',
  },
  gold: {
    color: '#fff',
  },
  ghost: {
    color: '#FFFFFF',
  },
};
