/**
 * Push notifications utilities
 *
 * Handles device token registration, notification permissions,
 * and notification handling. Integrates with Supabase for
 * server-side notification triggers via webhooks.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_TOKEN_KEY = 'notification_token';
const NOTIFICATION_TOKEN_SENT_KEY = 'notification_token_sent';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get or register device push token
 */
export async function getPushToken(): Promise<string | null> {
  try {
    // Check if we already have a token stored
    const storedToken = await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
    if (storedToken) {
      return storedToken;
    }

    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.warn('Notification permissions not granted');
      return null;
    }

    // Get device push token
    let token: string | null = null;
    if (Platform.OS === 'android') {
      // Android requires a notification channel
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID || undefined,
    });

    token = tokenData.data;

    // Store token locally
    if (token) {
      await AsyncStorage.setItem(NOTIFICATION_TOKEN_KEY, token);
    }

    return token;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
}

/**
 * Register device token with Supabase
 * This should be called after user logs in
 * The token is stored in push_tokens table
 */
export async function registerDeviceToken(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    const token = await getPushToken();
    if (!token) {
      return false;
    }

    // Check if we've already registered this exact token
    const tokenSent = await AsyncStorage.getItem(NOTIFICATION_TOKEN_SENT_KEY);
    if (tokenSent === token) {
      // Token already registered - verify it still exists in DB
      const { error: checkError } = await supabase
        .from('push_tokens')
        .select('id')
        .eq('expo_push_token', token)
        .eq('user_id', user.id)
        .eq('enabled', true)
        .limit(1)
        .single();

      if (!checkError) {
        // Token exists and is enabled, skip re-registration
        return true;
      }
      // Token not found in DB, re-register
    }

    // Upsert token to push_tokens table
    const { error: upsertError } = await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        expo_push_token: token,
        platform: Platform.OS,
        enabled: true,
      },
      {
        onConflict: 'expo_push_token',
      }
    );

    if (upsertError) {
      console.error('Error upserting push token:', upsertError);
      return false;
    }

    // Mark as sent
    await AsyncStorage.setItem(NOTIFICATION_TOKEN_SENT_KEY, token);
    return true;
  } catch (error) {
    console.error('Error registering device token:', error);
    return false;
  }
}

/**
 * Unregister device token (on logout)
 * Marks token as disabled in database and clears local storage
 */
export async function unregisterDeviceToken(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      // Even if no user, clear local storage
      await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
      await AsyncStorage.removeItem(NOTIFICATION_TOKEN_SENT_KEY);
      return;
    }

    const token = await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
    if (token) {
      // Mark token as disabled in database (don't delete, allows re-enabling)
      await supabase
        .from('push_tokens')
        .update({ enabled: false })
        .eq('expo_push_token', token)
        .eq('user_id', user.id);
    }

    // Clear local storage
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_SENT_KEY);
  } catch (error) {
    console.error('Error unregistering device token:', error);
    // Still clear local storage even if DB update fails
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_SENT_KEY);
  }
}

/**
 * Handle notification tap (deep link to relevant screen)
 * This should be called from App.tsx when app receives a notification
 *
 * Navigation structure:
 * - Main (Tab Navigator)
 *   - MatchesStack (Stack Navigator)
 *     - MatchDetail
 *     - Chat
 */
export function handleNotificationTap(
  notification: Notifications.Notification,
  navigation?: any
): void {
  if (!navigation) {
    console.warn('Navigation ref not available for notification deep link');
    return;
  }

  const data = notification.request.content.data;

  // Deep link based on notification type
  if (data?.type === 'match' && data?.matchId) {
    // Navigate to Main tab, then to MatchDetail
    navigation.navigate('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'MatchDetail',
        params: { matchId: data.matchId },
      },
    });
  } else if (data?.type === 'message' && data?.matchId) {
    // Navigate to Main tab, then to Chat
    navigation.navigate('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'Chat',
        params: { matchId: data.matchId },
      },
    });
  } else if (data?.type === 'proposal' && data?.matchId) {
    // Navigate to Main tab, then to MatchDetail (proposals are shown there)
    navigation.navigate('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'MatchDetail',
        params: { matchId: data.matchId },
      },
    });
  } else if (data?.type === 'confirm' && data?.matchId) {
    // Navigate to Main tab, then to MatchDetail
    navigation.navigate('Main', {
      screen: 'MatchesStack',
      params: {
        screen: 'MatchDetail',
        params: { matchId: data.matchId },
      },
    });
  }
}

/**
 * Setup notification listeners
 * Returns cleanup function
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (notification: Notifications.Notification) => void
): () => void {
  // Listener for notifications received while app is foregrounded
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    onNotificationReceived?.(notification);
  });

  // Listener for notification taps
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    onNotificationTapped?.(response.notification);
  });

  // Return cleanup function
  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
}
