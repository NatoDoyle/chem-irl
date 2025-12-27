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
 * The token will be stored in a user_devices table (to be created in backend)
 */
export async function registerDeviceToken(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return false;
    }

    // Check if we've already sent this token
    const tokenSent = await AsyncStorage.getItem(NOTIFICATION_TOKEN_SENT_KEY);
    const token = await getPushToken();

    if (!token) {
      return false;
    }

    // If token hasn't changed and we've already sent it, skip
    if (tokenSent === token) {
      return true;
    }

    // TODO: Store token in Supabase user_devices table
    // For now, we'll just mark it as sent
    // In production, you would:
    // 1. Create a user_devices table with columns: user_id, device_token, platform, created_at
    // 2. Upsert the token: supabase.from('user_devices').upsert({ user_id: user.id, device_token: token, platform: Platform.OS })
    // 3. Set up Supabase webhooks to send notifications when matches/proposals/messages are created

    await AsyncStorage.setItem(NOTIFICATION_TOKEN_SENT_KEY, token);
    console.log('Device token registered (stored locally, backend integration pending)');

    return true;
  } catch (error) {
    console.error('Error registering device token:', error);
    return false;
  }
}

/**
 * Unregister device token (on logout)
 */
export async function unregisterDeviceToken(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return;
    }

    const token = await AsyncStorage.getItem(NOTIFICATION_TOKEN_KEY);
    if (!token) {
      return;
    }

    // TODO: Remove token from Supabase user_devices table
    // supabase.from('user_devices').delete().eq('user_id', user.id).eq('device_token', token);

    // Clear local storage
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_KEY);
    await AsyncStorage.removeItem(NOTIFICATION_TOKEN_SENT_KEY);
  } catch (error) {
    console.error('Error unregistering device token:', error);
  }
}

/**
 * Handle notification tap (deep link to relevant screen)
 * This should be called from App.tsx when app receives a notification
 */
export function handleNotificationTap(
  notification: Notifications.Notification,
  navigation?: any
): void {
  const data = notification.request.content.data;

  // Deep link based on notification type
  if (data?.type === 'match' && data?.matchId) {
    // Navigate to match detail
    navigation?.navigate('MatchesStack', {
      screen: 'MatchDetail',
      params: { matchId: data.matchId },
    });
  } else if (data?.type === 'message' && data?.matchId) {
    // Navigate to chat
    navigation?.navigate('MatchesStack', {
      screen: 'Chat',
      params: { matchId: data.matchId },
    });
  } else if (data?.type === 'proposal' && data?.matchId) {
    // Navigate to match detail (proposals are shown there)
    navigation?.navigate('MatchesStack', {
      screen: 'MatchDetail',
      params: { matchId: data.matchId },
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
