import { supabase } from './supabase/client';
import { addBreadcrumb } from './sentry';
import { trackEvent } from './analytics';
import { markStepResolved } from './onboarding/flowGuard';

/**
 * Normalize email address (trim and lowercase)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize OTP token (remove non-digits, limit to 6 digits)
 */
export function normalizeOtpToken(token: string): string {
  return token.replace(/\D/g, '').slice(0, 6);
}

/**
 * Send email OTP for signup/login
 * Uses signInWithOtp (never signUp) to ensure OTP-based flow
 */
export async function sendEmailOTP(email: string, isSignup: boolean = true) {
  try {
    const normalizedEmail = normalizeEmail(email);

    // Temporary debug logging
    console.log(`[auth] signInWithOtp: email=${normalizedEmail}, isSignup=${isSignup}`);

    addBreadcrumb('Sending email OTP', 'auth', 'info', { email: normalizedEmail, isSignup });
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: isSignup,
        // Explicitly do NOT include emailRedirectTo or redirectTo to ensure OTP mode
      },
    });

    if (error) {
      // Check for rate limit errors (429)
      const isRateLimit =
        (error as any).status === 429 ||
        error.message?.toLowerCase().includes('too many requests') ||
        error.message?.toLowerCase().includes('rate limit');

      return {
        success: false,
        error: error.message,
        isRateLimit,
        status: (error as any).status,
        code: (error as any).code,
      };
    }

    return { success: true };
  } catch (error: any) {
    const isRateLimit =
      error.status === 429 ||
      error.message?.toLowerCase().includes('too many requests') ||
      error.message?.toLowerCase().includes('rate limit');

    return {
      success: false,
      error: error.message || 'Failed to send email OTP',
      isRateLimit,
      status: error.status,
      code: error.code,
    };
  }
}

/**
 * Verify email OTP code
 * Always uses type: 'email' (never 'signup' or 'magiclink') to ensure OTP-based flow
 */
export async function verifyEmailOTP(email: string, token: string, isSignup: boolean = true) {
  try {
    const normalizedEmail = normalizeEmail(email);
    const normalizedToken = normalizeOtpToken(token);

    // Temporary debug logging (mask token except last 2 digits)
    const maskedToken = normalizedToken.length >= 2 ? '****' + normalizedToken.slice(-2) : '****';
    console.log(
      `[auth] verifyOtp: email=${normalizedEmail}, token=${maskedToken}, isSignup=${isSignup}`
    );

    addBreadcrumb('Verifying email OTP', 'auth', 'info', { email: normalizedEmail, isSignup });

    // Check if user already has a session before verification (to detect new signups)
    const { data: existingSession } = await supabase.auth.getSession();
    const hadExistingSession = !!existingSession.session;

    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email', // Always use 'email' type, never 'signup' or 'magiclink'
    });

    if (error) {
      // Temporary debug logging (include status/code if present)
      const isInvalidToken =
        error.message?.toLowerCase().includes('invalid token') ||
        error.message?.toLowerCase().includes('token');
      const errorStatus = (error as any).status || 'unknown';
      const errorCode = (error as any).code || 'unknown';
      console.log(
        `[auth] verifyOtp result: ${isInvalidToken ? 'invalid token' : 'error'}, status=${errorStatus}, code=${errorCode}, message=${error.message}`
      );
      return { success: false, error: error.message };
    }

    // Temporary debug logging
    console.log(`[auth] verifyOtp result: success`);

    // Only emit user_signed_up if:
    // 1. isSignup is true (user initiated signup flow)
    // 2. No existing session before verification (new user creation, not session restore)
    // 3. Session was created (verification succeeded)
    const isNewSignup = isSignup && !hadExistingSession && !!data.session?.user;

    if (data.session?.user) {
      // Mark email_verification step as resolved (both signup and login)
      try {
        await markStepResolved('email_verification', 'completed');
      } catch (error) {
        // Non-fatal - log but don't fail verification
        console.error('Failed to mark email_verification step:', error);
      }

      if (isNewSignup) {
        // Mark account_creation step for new signups
        try {
          await markStepResolved('account_creation', 'completed');
          // Assume terms are accepted during signup (no separate terms screen yet)
          await markStepResolved('terms_acceptance', 'completed');
        } catch (error) {
          // Non-fatal - log but don't fail verification
          console.error('Failed to mark account_creation/terms_acceptance steps:', error);
        }

        trackEvent('user_signed_up', {
          userId: data.session.user.id.substring(0, 8),
          method: 'email_otp',
        });
      } else {
        trackEvent('user_signed_in', {
          userId: data.session.user.id.substring(0, 8),
          method: 'email_otp',
        });
      }
    }

    return { success: true, session: data.session };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to verify email OTP' };
  }
}

/**
 * Send phone OTP for signup/login
 */
export async function sendPhoneOTP(phone: string, isSignup: boolean = false) {
  try {
    addBreadcrumb('Sending phone OTP', 'auth', 'info', { phone, isSignup });
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
      options: {
        shouldCreateUser: isSignup,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send phone OTP' };
  }
}

/**
 * Verify phone OTP code
 */
export async function verifyPhoneOTP(
  phone: string,
  token: string,
  type: 'sms' | 'phone_change' = 'sms'
) {
  try {
    addBreadcrumb('Verifying phone OTP', 'auth', 'info', { phone, type });
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone.trim(),
      token,
      type,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.session?.user) {
      // Mark phone_verification step as resolved
      if (type === 'sms') {
        try {
          await markStepResolved('phone_verification', 'completed');
        } catch (error) {
          // Non-fatal - log but don't fail verification
          console.error('Failed to mark phone_verification step:', error);
        }
      }

      trackEvent(type === 'sms' ? 'user_signed_in' : 'phone_verified', {
        userId: data.session.user.id.substring(0, 8),
        method: 'phone_otp',
      });
    }

    return { success: true, session: data.session };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to verify phone OTP' };
  }
}

/**
 * Update user's phone number (for existing signed-in user)
 */
export async function updatePhone(phone: string) {
  try {
    addBreadcrumb('Updating phone number', 'auth', 'info', { phone });
    const { data, error } = await supabase.auth.updateUser({
      phone: phone.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update phone' };
  }
}

/**
 * Complete signup by updating profile with full_name and signup_completed
 * Idempotent: only updates full_name if it's currently empty/null
 */
export async function completeSignup(fullName: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No user session found' };
    }

    addBreadcrumb('Completing signup', 'auth', 'info', { userId: user.id });

    // First, check if profile exists and if full_name is already set
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    const trimmedName = fullName.trim();
    const shouldUpdateName = !existingProfile?.full_name || existingProfile.full_name.trim() === '';

    // Update profile with full_name (only if empty) and signup_completed
    const updateData: { id: string; signup_completed: boolean; full_name?: string } = {
      id: user.id,
      signup_completed: true,
    };

    if (shouldUpdateName) {
      updateData.full_name = trimmedName;
    }

    const { error } = await supabase.from('profiles').upsert(updateData);

    if (error) {
      // Temporary debug logging
      console.log(
        `[auth] completeSignup upsert failed: user_id=${user.id.substring(0, 8)}, error=${error.message}`
      );
      return { success: false, error: error.message };
    }

    // Temporary debug logging
    console.log(
      `[auth] completeSignup success: user_id=${user.id.substring(0, 8)}, name=${trimmedName}, updated=${shouldUpdateName}`
    );

    trackEvent('signup_completed', {
      userId: user.id.substring(0, 8),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to complete signup' };
  }
}

/**
 * Check if an email already exists in auth.users
 * Used to prevent duplicate signups
 */
export async function emailExists(email: string): Promise<{
  success: boolean;
  exists?: boolean;
  error?: string;
}> {
  try {
    const normalizedEmail = normalizeEmail(email);

    addBreadcrumb('Checking email existence', 'auth', 'info', { email: normalizedEmail });

    const { data, error } = await supabase.rpc('email_exists', {
      p_email: normalizedEmail,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, exists: data === true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to check email existence' };
  }
}
