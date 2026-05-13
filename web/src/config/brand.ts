// GENERATED — do not edit; run `bun run brand:tokens` to update.
// Canonical source: brand/tokens.ts

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
  primarySoft: '#D1FFFB',
  primaryHover: '#08655D',
  surface: '#FFFFFF',
  border: '#D7F5F0',
  text: {
    100: '#F1F5F9',
    400: '#94A3B8',
    500: '#6B7280',
    600: '#6B7280',
    700: '#374151',
    900: '#0B1220',
  },
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#2563EB',
  background: {
    0: '#FFFFFF',
    50: '#F7FFFE',
  },
  onPrimary: '#FFFFFF',
  accentWarm: '#F97316',
  backgroundWarm: '#FFFBF7',
  gold: {
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
  },
  goldAccent: '#CA8A04',
} as const;

export const BRAND_GRADIENTS = {
  warmSurface: 'linear-gradient(135deg, #FFFBF7 0%, #FFF5EB 100%)',
  aquaPremium: 'linear-gradient(135deg, #0A7F74 0%, #0B9A8D 100%)',
  coralGold: 'linear-gradient(135deg, #F97316 0%, #CA8A04 100%)',
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

// Community channels surfaced on the /support page. discordUrl is read
// from NEXT_PUBLIC_COMMUNITY_DISCORD_URL (exposed via web/next.config.ts).
// When unset, the support page hides the Community card and shows only
// the email contact.
export const COMMUNITY = {
  discordUrl: process.env.NEXT_PUBLIC_COMMUNITY_DISCORD_URL ?? '',
  supportEmail: 'hello@chemirl.app',
} as const;
