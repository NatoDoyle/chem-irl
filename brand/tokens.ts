// Canonical source of truth for Chem IRL design tokens.
//
// Edit this file, then run `bun run brand:tokens` to regenerate:
//   - mobile/src/config/brand.ts
//   - web/src/config/brand.ts
//   - web/src/app/globals.css (@theme block between BRAND-TOKENS markers)
//
// Consumed by scripts/generate-brand-tokens.ts.
// Do not import this file directly from app code — import from the per-app
// generated brand.ts instead.

// === Core identity (shared) ===

export const BRAND = {
  name: 'Chem IRL',
  domain: 'chemirl.app',
  url: 'https://chemirl.app',
  tagline: 'Spend less time texting. Test chemistry IRL.',
  description: "Chemistry and vibe aren't on a screen. Meet face to face.",
} as const;

// === Color palette (shared raw scales) ===

export const PALETTE = {
  aqua: {
    50: '#E9FFFD',
    100: '#D1FFFB',
    200: '#A6FBF4',
    300: '#74F0E7',
    400: '#3FE0D6',
    500: '#0B9A8D',
    600: '#0A7F74', // PRIMARY
    700: '#08655D', // PRESSED
    800: '#064C46',
    900: '#043533',
  },
  gold: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#EAB308',
    600: '#CA8A04', // PRIMARY GOLD ACCENT
    700: '#A16207',
    800: '#854D0E',
    900: '#713F12',
  },
  ink: {
    900: '#0B1220',
    700: '#374151',
    500: '#6B7280',
    400: '#94A3B8',
  },
  coral: '#F97316',
  white: '#FFFFFF',
} as const;

// === Semantic colors (shared) ===

export const SEMANTIC = {
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2563EB',
} as const;

// === Mobile palette (dark / midnight theme defaults) ===
// Shape matches the legacy mobile BRAND_COLORS export.

export const MOBILE_PALETTE = {
  primary: PALETTE.aqua[600],
  primaryPressed: PALETTE.aqua[700],
  primarySoft: 'rgba(10, 127, 116, 0.15)',
  primaryLight: '#34D399',
  primaryHover: PALETTE.aqua[700],
  surface: '#111318',
  border: '#1a1f2e',
  text: {
    900: '#F5F5F5',
    700: '#D1D5DB',
    600: '#9CA3AF',
    500: '#6B7280',
    400: '#4B5563',
    100: '#1a1f2e',
  },
  background: {
    50: '#111318',
    0: '#0D0F14',
  },
  onPrimary: PALETTE.white,
} as const;

// === Web palette (light / warm theme defaults) ===
// Shape matches the legacy web BRAND_COLORS export.

export const WEB_PALETTE = {
  primary: PALETTE.aqua[600],
  primaryPressed: PALETTE.aqua[700],
  primarySoft: PALETTE.aqua[100],
  primaryHover: PALETTE.aqua[700],
  surface: PALETTE.white,
  border: '#D7F5F0',
  text: {
    900: PALETTE.ink[900],
    700: PALETTE.ink[700],
    600: PALETTE.ink[500],
    500: PALETTE.ink[500],
    400: PALETTE.ink[400],
    100: '#F1F5F9',
  },
  background: {
    50: '#F7FFFE',
    0: PALETTE.white,
  },
  onPrimary: PALETTE.white,
  accentWarm: PALETTE.coral,
  backgroundWarm: '#FFFBF7',
  goldAccent: PALETTE.gold[600],
} as const;

// === Midnight tokens (mobile dark surfaces) ===

export const MIDNIGHT_TOKENS = {
  bg: '#0D0F14',
  surface: '#111318',
  inputBg: '#161922',
  borderDefault: '#1a1f2e',
  coral: PALETTE.coral,
  radius: { sm: 8, md: 14, lg: 20, full: 9999 },
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
} as const;

// === Mobile shadow specs ===
// Raw platform-neutral specs. The generator wraps each in Platform.select({
//   ios: { shadowColor, shadowOffset: { width: 0, height: offsetY }, shadowOpacity: opacity, shadowRadius: radius },
//   android: { elevation: androidElevation }
// }) when emitting mobile/src/config/brand.ts.

export type MobileShadowSpec = {
  color: string;
  offsetY: number;
  opacity: number;
  radius: number;
  androidElevation: number;
};

export const MOBILE_SHADOWS = {
  // MIDNIGHT.shadow.*
  warm: { color: PALETTE.aqua[600], offsetY: 0, opacity: 0.15, radius: 12, androidElevation: 4 },
  warmLg: { color: PALETTE.aqua[600], offsetY: 0, opacity: 0.25, radius: 20, androidElevation: 8 },
  // MIDNIGHT.glow.*
  glowPrimary: { color: PALETTE.aqua[600], offsetY: 0, opacity: 0.4, radius: 20, androidElevation: 8 },
  glowGold: { color: PALETTE.gold[600], offsetY: 4, opacity: 0.5, radius: 20, androidElevation: 8 },
  glowSelected: { color: PALETTE.aqua[600], offsetY: 0, opacity: 0.3, radius: 15, androidElevation: 6 },
  // REFINED_WARMTH.shadow.* (extensions beyond MIDNIGHT.shadow)
  subtle: { color: PALETTE.aqua[600], offsetY: 0, opacity: 0.06, radius: 8, androidElevation: 2 },
  elevated: { color: PALETTE.aqua[600], offsetY: 4, opacity: 0.2, radius: 24, androidElevation: 12 },
} as const satisfies Record<string, MobileShadowSpec>;

// === Mobile gradients (LinearGradient tuple pairs) ===

export const MOBILE_GRADIENTS = {
  warmSurface: ['#0D0F14', '#111318'],
  premium: [PALETTE.aqua[600], '#086E64'],
  celebration: [PALETTE.coral, PALETTE.gold[600]],
  cardOverlay: ['transparent', 'rgba(13, 15, 20, 0.85)'],
  midnightGlow: ['rgba(10, 127, 116, 0.08)', 'transparent'],
} as const;

// === Mobile animation ===

export const MOBILE_ANIMATION = {
  duration: { fast: 150, normal: 250, slow: 400, entrance: 500, premium: 600 },
  spring: {
    default: { damping: 15, stiffness: 150 },
    bounce: { damping: 8, stiffness: 200 },
    gentle: { damping: 20, stiffness: 100 },
  },
} as const;

// === Web gradients (CSS gradient strings) ===

export const WEB_GRADIENTS = {
  warmSurface: 'linear-gradient(135deg, #FFFBF7 0%, #FFF5EB 100%)',
  aquaPremium: `linear-gradient(135deg, ${PALETTE.aqua[600]} 0%, ${PALETTE.aqua[500]} 100%)`,
  coralGold: `linear-gradient(135deg, ${PALETTE.coral} 0%, ${PALETTE.gold[600]} 100%)`,
} as const;

// === Web CSS @theme block tokens ===
// Used by the generator to emit web/src/app/globals.css between markers.

export const WEB_CSS_THEME = {
  background: '#FFFBF7',
  foreground: PALETTE.ink[900],
  accentWarm: PALETTE.coral,
  surface: PALETTE.white,
  warmBg: '#FFFBF7',
  darkBg: PALETTE.ink[900],
  shadows: {
    warm: '0 8px 24px rgba(0, 0, 0, 0.06)',
    warmLg: '0 12px 32px rgba(0, 0, 0, 0.1)',
    nav: '0 1px 3px rgba(0, 0, 0, 0.08)',
    subtle: '0 2px 8px rgba(0, 0, 0, 0.04)',
    elevated: '0 16px 40px rgba(0, 0, 0, 0.12)',
  },
  radiusBrand: 20,
} as const;

// === Typography (unified Inter + Libre Caslon Text) ===

export const TYPOGRAPHY_TOKENS = {
  // Mobile uses these identifiers; matches expo-font registrations in
  // mobile/src/lib/fonts.ts. Do not change a name without updating fonts.ts.
  mobileFontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
    serif: 'LibreCaslonText-Regular',
    serifBold: 'LibreCaslonText-Bold',
    serifItalic: 'LibreCaslonText-Italic',
  },
  // Web uses CSS variables set by next/font/google in web/src/app/layout.tsx.
  webFontVars: {
    sans: 'var(--font-inter)',
    serif: 'var(--font-libre-caslon)',
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

// === Spacing (shared) ===

export const SPACING_TOKENS = {
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

// === Extended radius (mobile REFINED_WARMTH adds xl: 28) ===

export const EXTENDED_RADIUS = { xl: 28 } as const;

// === User-facing copy (shared, identical mobile + web) ===

export const MESSAGES_TOKENS = {
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

// === Web community (env-driven) ===

export const WEB_COMMUNITY_TOKENS = {
  discordUrlEnvVar: 'NEXT_PUBLIC_COMMUNITY_DISCORD_URL',
  supportEmail: 'hello@chemirl.app',
} as const;
