import { supabase } from './supabase/client';
import { addBreadcrumb } from './sentry';
import { trackEvent } from './analytics';

/**
 * Send email OTP for signup
 */
export async function sendEmailOTP(email: string, isSignup: boolean = true) {
  try {
    addBreadcrumb('Sending email OTP', 'auth', 'info', { email, isSignup });
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: isSignup,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send email OTP' };
  }
}

/**
 * Verify email OTP code
 */
export async function verifyEmailOTP(email: string, token: string, isSignup: boolean = true) {
  try {
    addBreadcrumb('Verifying email OTP', 'auth', 'info', { email, isSignup });
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data.session?.user) {
      trackEvent(isSignup ? 'user_signed_up' : 'user_signed_in', {
        userId: data.session.user.id.substring(0, 8),
        method: 'email_otp',
      });
    }

    return { success: true, session: data.session };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to verify email OTP' };
  }
}

/**
 * Complete signup by updating profile with full_name and signup_completed.
 * Also records terms acceptance: the SignUpEmail screen blocks Continue
 * until the 18+/Terms checkbox is ticked, so reaching this call is the
 * acceptance act — persisted here because no authed session exists earlier.
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

    // Update profile with full_name, signup_completed, and terms acceptance
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName.trim(),
      signup_completed: true,
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    trackEvent('signup_completed', {
      userId: user.id.substring(0, 8),
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to complete signup' };
  }
}
