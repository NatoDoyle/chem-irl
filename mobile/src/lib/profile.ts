import { supabase } from './supabase/client';

/**
 * Ensure a profile row exists for the authenticated user.
 * If the profile doesn't exist, creates it with minimal defaults.
 * Safe to call multiple times (uses upsert).
 *
 * @param userId - The authenticated user's ID (from auth.users)
 * @returns Promise<{ success: boolean; error?: string }>
 */
export async function ensureProfileExists(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        // Minimal defaults - other fields will be set during onboarding
        prompts: {},
        availability: {},
        photos: [],
        completion_pct: 0,
        signup_completed: false,
        // Avoid NOT NULL violation if column exists
        favourite_first_dates: [],
      },
      {
        onConflict: 'id',
      }
    );

    if (error) {
      // Log full error details for debugging
      if (__DEV__) {
        console.error('[profile.ts] ensureProfileExists error:', {
          code: error.code,
          message: error.message,
          hint: error.hint,
          details: error.details,
          status: (error as any).status,
          statusText: (error as any).statusText,
        });
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to ensure profile exists' };
  }
}
