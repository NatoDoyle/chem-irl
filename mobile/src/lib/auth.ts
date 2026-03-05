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

    // Update profile with full_name and signup_completed
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName.trim(),
      signup_completed: true,
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
