// Client-side helpers for the Dublin waitlist.
//
// The static marketing site posts to the deployed `waitlist-signup` edge
// function, which wraps the SECURITY DEFINER RPC `claim_waitlist_signup`
// (granted only to service_role). This file only needs the publishable
// (anon) key — it never touches the service role.
//
// See:
//   - supabase/functions/waitlist-signup/index.ts (server side)
//   - docs/DUBLIN_LAUNCH_PLAN.md §2.4 (frontend wiring spec)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export type AgeBand = '18-21' | '22-26' | '27-31' | '32-36' | '37-44' | '45+';
export type Gender = 'female' | 'male' | 'nonbinary' | 'prefer_not_to_say';

export interface WaitlistSignupPayload {
  email: string;
  first_name?: string;
  age_band?: AgeBand;
  gender?: Gender;
  why_signup?: string;
  referred_by_code?: string;
  consent_marketing?: boolean;
  consent_privacy: boolean;
  // Honeypot — set to non-empty to mark the submission as a bot.
  // Real users never see this field.
  website?: string;
}

export interface WaitlistSignupSuccess {
  success: true;
  was_new: boolean;
  position: number | null;
  referral_code: string | null;
  email_confirmed: boolean;
}

export interface WaitlistSignupFailure {
  success: false;
  error: string;
}

export type WaitlistSignupResult = WaitlistSignupSuccess | WaitlistSignupFailure;

/**
 * POSTs the form payload to the waitlist-signup edge function. Returns
 * a discriminated union — callers narrow on `result.success`.
 *
 * Errors are returned as data (never thrown) so callers can show inline
 * messages without wrapping in try/catch.
 */
export async function submitWaitlistSignup(
  payload: WaitlistSignupPayload,
): Promise<WaitlistSignupResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'configuration_missing' };
  }

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/waitlist-signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { success: false, error: 'network_error' };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { success: false, error: `http_${res.status}` };
  }

  if (!data || typeof data !== 'object') {
    return { success: false, error: `http_${res.status}` };
  }

  const obj = data as Record<string, unknown>;

  if (!res.ok || obj.success !== true) {
    const error = typeof obj.error === 'string' ? obj.error : `http_${res.status}`;
    return { success: false, error };
  }

  return {
    success: true,
    was_new: obj.was_new === true,
    position: typeof obj.position === 'number' ? obj.position : null,
    referral_code: typeof obj.referral_code === 'string' ? obj.referral_code : null,
    email_confirmed: obj.email_confirmed === true,
  };
}
