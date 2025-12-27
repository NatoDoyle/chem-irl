import { supabase } from './supabase/client';
import * as Linking from 'expo-linking';
import { addBreadcrumb } from './sentry';
import { trackEvent } from './analytics';

/**
 * Handle deep link for magic link authentication
 * Call this when app opens from a magic link
 */
export async function handleMagicLink(url: string) {
  try {
    // Extract token from URL
    const parsedUrl = Linking.parse(url);
    const accessToken = parsedUrl.queryParams?.access_token as string;
    const refreshToken = parsedUrl.queryParams?.refresh_token as string;

    if (accessToken && refreshToken) {
      // Set session with tokens
      addBreadcrumb('Handling magic link authentication', 'auth', 'info');
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('Error setting session:', error);
        return { success: false, error };
      }

      if (data.session?.user) {
        trackEvent('user_signed_up', {
          userId: data.session.user.id.substring(0, 8),
        });
      }
      return { success: true, session: data.session };
    }

    return { success: false, error: 'No tokens in URL' };
  } catch (error) {
    console.error('Error handling magic link:', error);
    return { success: false, error };
  }
}

/**
 * Send magic link to email
 */
export async function sendMagicLink(email: string) {
  try {
    // Use explicit redirect URL from env, or fallback to Linking.createURL
    const redirectUrl =
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || Linking.createURL('/auth/callback');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to send magic link' };
  }
}
