// GENERATED — do not edit; run `bun run brand:tokens` to update.
// Canonical source: brand/tokens.ts

import { Platform } from 'react-native';

export const BRAND = {
  name: 'Chem IRL',
  domain: 'chemirl.app',
  url: 'https://chemirl.app',
  tagline: 'Spend less time texting. Test chemistry IRL.',
  description: "Chemistry and vibe aren't on a screen. Meet face to face.",
} as const;

export const BRAND_COLORS = {
  aqua: {
    50: '#E9FFFD',
    100: '#D1FFFB',
    200: '#A6FBF4',
    300: '#74F0E7',
    400: '#3FE0D6',
    500: '#0B9A8D',
    600: '#0A7F74',
    700: '#08655D',
    800: '#064C46',
    900: '#043533',
  },
  primary: '#0A7F74',
  primaryPressed: '#08655D',
  primarySoft: 'rgba(10, 127, 116, 0.15)',
  primaryLight: '#34D399',
  primaryHover: '#08655D',
  surface: '#111318',
  border: '#1a1f2e',
  text: {
    100: '#1a1f2e',
    400: '#4B5563',
    500: '#6B7280',
    600: '#9CA3AF',
    700: '#D1D5DB',
    900: '#F5F5F5',
  },
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2563EB',
  background: {
    0: '#0D0F14',
    50: '#111318',
  },
  onPrimary: '#FFFFFF',
} as const;

// --- Midnight Chemistry Design System ---
// Dark premium aesthetic. Deep midnight backgrounds, glass cards,
// aquamarine glow effects, and gold CTAs.

export const MIDNIGHT = {
  bg: '#0D0F14',
  surface: '#111318',
  inputBg: '#161922',
  borderDefault: '#1a1f2e',
  coral: '#F97316',
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    full: 9999,
  },
  shadow: {
    warm: Platform.select({
      ios: {
        shadowColor: '#0A7F74',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
    warmLg: Platform.select({
      ios: {
        shadowColor: '#0A7F74',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
  },
  glassCard: {
    backgroundColor: 'rgba(17, 19, 24, 0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 20,
  },
  glassCardSm: {
    backgroundColor: 'rgba(17, 19, 24, 0.8)',
    borderWidth: 1,
    borderColor: '#1a1f2e',
    borderRadius: 14,
  },
  glow: {
    primary: Platform.select({
      ios: {
        shadowColor: '#0A7F74',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
    gold: Platform.select({
      ios: {
        shadowColor: '#CA8A04',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
      },
      android: { elevation: 8 },
    }),
    selected: Platform.select({
      ios: {
        shadowColor: '#0A7F74',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
      },
      android: { elevation: 6 },
    }),
  },
} as const;

// Backward-compat alias — all files importing GOLDEN_HOUR resolve to MIDNIGHT.
export const GOLDEN_HOUR = MIDNIGHT;

export const GOLD = {
  50: '#FFFBEB',
  100: '#FEF3C7',
  200: '#FDE68A',
  300: '#FCD34D',
  400: '#FBBF24',
  500: '#EAB308',
  600: '#CA8A04',
  700: '#A16207',
  800: '#854D0E',
  900: '#713F12',
} as const;

export const TYPOGRAPHY = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
    serif: 'LibreCaslonText-Regular',
    serifBold: 'LibreCaslonText-Bold',
    serifItalic: 'LibreCaslonText-Italic',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,
} as const;

export const REFINED_WARMTH = {
  ...MIDNIGHT,
  gold: GOLD[600],
  goldSoft: GOLD[100],
  gradient: {
    warmSurface: ['#0D0F14', '#111318'] as const,
    premium: ['#0A7F74', '#086E64'] as const,
    celebration: ['#F97316', '#CA8A04'] as const,
    cardOverlay: ['transparent', 'rgba(13, 15, 20, 0.85)'] as const,
    midnightGlow: ['rgba(10, 127, 116, 0.08)', 'transparent'] as const,
  },
  radius: { ...MIDNIGHT.radius, xl: 28 },
  shadow: {
    ...MIDNIGHT.shadow,
    subtle: Platform.select({
      ios: {
        shadowColor: '#0A7F74',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
    elevated: Platform.select({
      ios: {
        shadowColor: '#0A7F74',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
    }),
  },
  animation: {
    duration: {
      fast: 150,
      normal: 250,
      slow: 400,
      entrance: 500,
      premium: 600,
    },
    spring: {
      default: {
        damping: 15,
        stiffness: 150,
      },
      bounce: {
        damping: 8,
        stiffness: 200,
      },
      gentle: {
        damping: 20,
        stiffness: 100,
      },
    },
  },
  typography: TYPOGRAPHY,
  spacing: SPACING,
} as const;

export const BRAND_MESSAGES = {
  proposal: {
    error: 'Pick 2–3 different times within the next 7 days.',
    busy: "You're at today's proposal limit. Improve acceptance to raise it.",
    expired: 'Expired.',
    expiredReceiver: 'Reopen & propose 2–3 times.',
    reminder: 'Pick one or send 2–3 times.',
  },
  speed: {
    dormant: 'Your Speed holds at 50. Send 4 likes today to re-enter discovery.',
  },
  report: {
    receipt: "We're reviewing your report. Typical response: 24h.",
  },
} as const;
