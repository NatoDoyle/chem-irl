import { supabase } from './supabase/client';
import { PostgrestError } from '@supabase/supabase-js';
import { isSessionExpiredError } from './errors';

/**
 * Resolved profile state for navigation decisions in App.tsx.
 * Both checkSessionAndProfile and onAuthStateChange derive state from this.
 */
export type ProfileState =
  | { kind: 'complete' }
  | { kind: 'onboarding' }
  | { kind: 'signup-incomplete' }
  | { kind: 'session-expired' }
  | { kind: 'error'; message: string };

/**
 * Fetches the profile for a user and determines the navigation state.
 * Creates the profile row if it doesn't exist yet.
 */
export async function resolveProfileState(userId: string): Promise<ProfileState> {
  let { data: profile, error } = await supabase
    .from('profiles')
    .select('completion_pct, signup_completed')
    .eq('id', userId)
    .maybeSingle();

  if (profile === null && !error) {
    await ensureProfileExists(userId);
    const next = await supabase
      .from('profiles')
      .select('completion_pct, signup_completed')
      .eq('id', userId)
      .maybeSingle();
    profile = next.data;
    error = next.error;
  }

  if (error && isSessionExpiredError(error)) {
    return { kind: 'session-expired' };
  }

  if (error) {
    return { kind: 'error', message: error.message };
  }

  const isSignupComplete = profile?.signup_completed === true;
  const isProfileComplete = profile?.completion_pct >= 100;

  if (isSignupComplete && isProfileComplete) return { kind: 'complete' };
  if (isSignupComplete) return { kind: 'onboarding' };
  return { kind: 'signup-incomplete' };
}

/**
 * Ensures a profile row exists for the user. Upserts with default values if missing.
 * Use when .maybeSingle() returns null so bootstrap can re-select.
 * Returns the upsert error if any; caller should log in __DEV__ and may reselect.
 */
export async function ensureProfileExists(userId: string): Promise<PostgrestError | null> {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      prompts: {},
      availability: {},
      photos: [],
      completion_pct: 0,
      signup_completed: false,
      favourite_first_dates: [],
    },
    { onConflict: 'id' }
  );
  if (error && __DEV__) {
    const e = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
      status?: number;
      statusText?: string;
    };
    console.warn('[profile] ensureProfileExists upsert failed', {
      code: e?.code,
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      status: e?.status,
      statusText: e?.statusText,
    });
  }
  return error;
}
