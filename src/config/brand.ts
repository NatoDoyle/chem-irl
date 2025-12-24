export const BRAND = {
  name: 'Chem IRL',
  domain: 'chemirl.app',
  url: 'https://chemirl.app',
  tagline: 'Spend less time texting. Test chemistry IRL.',
  description: 'Chemistry and vibe aren\'t on a screen. Meet face to face.',
} as const;

export const BRAND_COLORS = {
  primary: '#1453FF',
  primaryHover: '#0B2B8F',
  text: {
    900: '#0F172A',
    600: '#475569',
  },
  success: '#059669',
  warning: '#D97706',
  danger: '#DC2626',
  background: {
    50: '#F8FAFC',
    0: '#FFFFFF',
  },
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




