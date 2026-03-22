import type { UserGender, UserOrientation, DayOfWeek } from '../lib/types';

export type { UserGender, UserOrientation };

export const DAY_OF_WEEK_OPTIONS: { value: DayOfWeek; label: string; shortLabel: string }[] = [
  { value: 'monday', label: 'Monday', shortLabel: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', shortLabel: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', shortLabel: 'Wed' },
  { value: 'thursday', label: 'Thursday', shortLabel: 'Thu' },
  { value: 'friday', label: 'Friday', shortLabel: 'Fri' },
  { value: 'saturday', label: 'Saturday', shortLabel: 'Sat' },
  { value: 'sunday', label: 'Sunday', shortLabel: 'Sun' },
];

export const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
];

export const ORIENTATION_OPTIONS: { value: UserOrientation; label: string }[] = [
  { value: 'straight', label: 'Straight' },
  { value: 'gay', label: 'Gay' },
  { value: 'lesbian', label: 'Lesbian' },
  { value: 'bisexual', label: 'Bisexual' },
  { value: 'pansexual', label: 'Pansexual' },
  { value: 'asexual', label: 'Asexual' },
  { value: 'other', label: 'Other' },
];

export const INTENT_OPTIONS = [
  { value: 'casual', label: 'Casual dating' },
  { value: 'dating_long_term', label: 'Dating → long-term' },
  { value: 'long_term', label: 'Long-term relationship' },
  { value: 'open', label: 'Open / exploring' },
];

export const FAMILY_PLANS_OPTIONS = [
  { value: 'wants_kids', label: 'Wants kids' },
  { value: 'no_kids', label: "Doesn't want kids" },
  { value: 'has_kids', label: 'Has kids' },
  { value: 'unsure', label: 'Unsure' },
];

export const PETS_OPTIONS = [
  { value: 'has_pets', label: 'Has pets' },
  { value: 'wants_pets', label: 'Wants pets' },
  { value: 'allergic', label: "Allergic / doesn't want" },
  { value: 'no_preference', label: 'No preference' },
];

export const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very_active', label: 'Very active' },
];

export const FREQUENCY_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not', label: 'Prefer not to say' },
];

export const LOVE_LANGUAGE_OPTIONS = [
  { value: 'words', label: 'Words of Affirmation' },
  { value: 'acts', label: 'Acts of Service' },
  { value: 'gifts', label: 'Receiving Gifts' },
  { value: 'time', label: 'Quality Time' },
  { value: 'touch', label: 'Physical Touch' },
];

export const ASTROLOGY_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
];

export const MBTI_OPTIONS = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
];

export const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Dutch',
  'Polish',
  'Russian',
  'Chinese',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Other',
];

export const PRESET_INTERESTS = [
  'Travel',
  'Music',
  'Movies',
  'Sports',
  'Cooking',
  'Reading',
  'Photography',
  'Art',
  'Dancing',
  'Gaming',
  'Hiking',
  'Yoga',
  'Fitness',
  'Writing',
  'Technology',
  'Fashion',
  'Food',
  'Wine',
  'Coffee',
  'Pets',
  'Volunteering',
  'Comedy',
  'Theater',
  'Concerts',
];
