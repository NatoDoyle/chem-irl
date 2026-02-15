import { supabase } from './supabase/client';
import { PostgrestError } from '@supabase/supabase-js';

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
