import { supabase } from './supabase/client';

/** Get the current user's token balance */
export async function getTokenBalance(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data, error } = await supabase
    .from('tokens')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return 0;
  return data.balance;
}

/** Reactivate an expired match using 1 token */
export async function reactivateMatch(
  matchId: string
): Promise<{ success: boolean; error?: string; newExpiresAt?: string }> {
  const { data, error } = await supabase.rpc('reactivate_match', {
    p_match_id: matchId,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  // The RPC returns jsonb: { success: boolean, error?: string, new_expires_at?: string }
  const result = data as { success: boolean; error?: string; new_expires_at?: string };
  return {
    success: result.success,
    error: result.error,
    newExpiresAt: result.new_expires_at,
  };
}
