// Database types matching Supabase schema

export type UserGender = 'male' | 'female' | 'non_binary' | 'other';
export type UserOrientation =
  | 'straight'
  | 'gay'
  | 'lesbian'
  | 'bisexual'
  | 'pansexual'
  | 'asexual'
  | 'other';
export type MatchStatus = 'open' | 'expired' | 'closed' | 'unmatched';
export type ProposalStatus = 'active' | 'expired' | 'confirmed' | 'reopened';

// Safety: report categories. Must match the DB `report_category` enum exactly.
export type ReportCategory =
  | 'spam_scam'
  | 'fake_impersonation'
  | 'harassment_hate'
  | 'threat_coercion'
  | 'nudity'
  | 'minor'
  | 'off_platform_solicitation'
  | 'other';

// Ordered list of report categories with friendly labels for the report UI.
export const REPORT_CATEGORIES: readonly { value: ReportCategory; label: string }[] = [
  { value: 'spam_scam', label: 'Spam or scam' },
  { value: 'fake_impersonation', label: 'Fake profile or impersonation' },
  { value: 'harassment_hate', label: 'Harassment or hate' },
  { value: 'threat_coercion', label: 'Threats or coercion' },
  { value: 'nudity', label: 'Nudity or sexual content' },
  { value: 'minor', label: 'Underage user' },
  { value: 'off_platform_solicitation', label: 'Asking to move off-platform' },
  { value: 'other', label: 'Something else' },
];

export interface User {
  user_id: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at: string;
  dob: string;
  gender: UserGender;
  orientation: UserOrientation;
  city_id: string;
  timezone: string;
  last_active_at: string;
}

export interface Profile {
  user_id: string;
  prompts: Record<string, string>;
  availability: Record<string, any>;
  photos: string[];
  completion_pct: number;
  created_at: string;
  updated_at: string;
}

export interface FeedItem {
  user_id: string;
  full_name: string;
  bio: string;
  availability_summary: string;
  action_speed: number;
  attractiveness: number;
  reliability: number;
  composite_score: number;
  photos?: string[];
}

export interface Like {
  like_id: string;
  liker_id: string;
  likee_id: string;
  created_at: string;
}

export interface Match {
  match_id: string;
  user_a: string;
  user_b: string;
  created_at: string;
  expires_at: string;
  status: MatchStatus;
}

export interface Proposal {
  proposal_id: string;
  match_id: string;
  sender_id: string;
  windows: { start: string; end: string }[];
  date_types: string[];
  note?: string;
  created_at: string;
  expires_at: string;
  status: ProposalStatus;
}

export interface Confirm {
  confirm_id: string;
  proposal_id: string;
  match_id: string;
  confirmer_id: string;
  chosen_window: { start: string; end: string };
  created_at: string;
}

export const DayOfWeek = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: 'sunday',
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

export interface WeeklySlot {
  day: DayOfWeek;
  start_time: string; // "HH:MM" local time
  end_time: string; // "HH:MM" local time
}

export interface Message {
  message_id: string;
  match_id: string;
  sender_id: string;
  content: string;
  bytes: number;
  created_at: string;
  read_at?: string | null;
}
