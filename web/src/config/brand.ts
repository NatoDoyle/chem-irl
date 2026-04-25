export const BRAND = {
  name: 'Chem IRL',
  domain: 'chemirl.app',
  url: 'https://chemirl.app',
  tagline: 'Spend less time texting. Test chemistry IRL.',
  description: 'Chemistry and vibe aren\'t on a screen. Meet face to face.',
} as const;

export const BRAND_COLORS = {
  // Aquamarine scale
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
  // Primary tokens
  primary: '#0A7F74', // aqua600
  primaryPressed: '#08655D', // aqua700
  primarySoft: '#D1FFFB', // aqua100
  primaryHover: '#08655D', // alias for primaryPressed
  // Neutral tokens
  surface: '#FFFFFF', // surface
  border: '#D7F5F0', // border
  text: {
    900: '#0B1220', // ink900
    700: '#374151', // ink700
    600: '#6B7280', // ink500 (using 600 key for backward compat)
    500: '#6B7280', // ink500
    400: '#94A3B8', // keeping for backward compat
    100: '#F1F5F9', // keeping for backward compat
  },
  // Semantic tokens
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2563EB',
  // Legacy background structure (for backward compat)
  background: {
    50: '#F7FFFE', // bg
    0: '#FFFFFF', // surface
  },
  // On-primary text (white for dark primary)
  onPrimary: '#FFFFFF',
  // Warm tokens (web Golden Hour direction)
  accentWarm: '#F97316',
  backgroundWarm: '#FFFBF7',
  // Gold scale (Refined Warmth tertiary)
  gold: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#EAB308',
    600: '#CA8A04', // PRIMARY GOLD
    700: '#A16207',
    800: '#854D0E',
    900: '#713F12',
  },
  goldAccent: '#CA8A04',
} as const;

export const BRAND_GRADIENTS = {
  // Warm surface background (#FFFBF7 → #FFF5EB)
  warmSurface: 'linear-gradient(135deg, #FFFBF7 0%, #FFF5EB 100%)',
  // Premium aquamarine
  aquaPremium: 'linear-gradient(135deg, #0A7F74 0%, #0B9A8D 100%)',
  // Celebration coral-to-gold
  coralGold: 'linear-gradient(135deg, #F97316 0%, #CA8A04 100%)',
} as const;

export const BRAND_MESSAGES = {
  proposal: {
    error: 'Pick 2–3 different times within the next 7 days.',
    busy: 'You\'re at today\'s proposal limit. Improve acceptance to raise it.',
    expired: 'Expired.',
    expiredReceiver: 'Reopen & propose 2–3 times.',
    reminder: 'Pick one or send 2–3 times.',
  },
  speed: {
    dormant: 'Your Speed holds at 50. Send 4 likes today to re-enter discovery.',
  },
  report: {
    receipt: 'We\'re reviewing your report. Typical response: 24h.',
  },
} as const;




