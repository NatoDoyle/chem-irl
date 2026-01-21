/**
 * Push notifications utilities
 *
 * Handles device token registration, notification permissions,
 * and notification handling. Integrates with Supabase for
 * server-side notification triggers via webhooks.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIFICATION_TOKEN_KEY = 'notification_token';
const NOTIFICATION_TOKEN_SENT_KEY = 'notification_token_sent';

/**
 * Validate UUID format (v4)
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Get EAS project ID from Constants
 * Checks expoConfig.extra.eas.projectId OR easConfig.projectId
 * Validates UUID format and returns null if invalid or not found
 * Returns null if not found (logs warning, doesn't throw)
 */
function getEASProjectId(): string | null {
  try {
    // Try expoConfig.extra.eas.projectId first
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      process.env.EXPO_PUBLIC_PROJECT_ID ||
      null;

    if (!projectId) {
      console.warn(
        '⚠️  EAS projectId not found. Push notifications may not work. ' +
          'Set expo.extra.eas.projectId in app.json or EXPO_PUBLIC_PROJECT_ID in environment. ' +
          'Run `npx eas-cli@latest init` (or `npm install -g eas-cli && eas init`) to generate a project ID.'
      );
      return null;
    }

    // Validate UUID format
    if (!isValidUUID(projectId)) {
      console.warn(
        `⚠️  EAS projectId is not a valid UUID: "${projectId}". Push notifications will not work. ` +
          'Update expo.extra.eas.projectId in app.json with a valid UUID. ' +
          'Run `npx eas-cli@latest init` (or `npm install -g eas-cli && eas init`) to generate a project ID.'
      );
      return null;
    }

    return projectId;
  } catch (error) {
    console.warn('⚠️  Error reading EAS projectId:', error);
    return null;
  }
}

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

    const projectId = getEASProjectId();
    if (!projectId) {
      console.warn('Skipping push token registration: EAS projectId not found or invalid');
      return null;
    }

    // Log projectId for debugging (first 8 chars only for security)
    console.log(`📱 Fetching push token with projectId: ${projectId.substring(0, 8)}...`);

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      token = tokenData.data;
    } catch (error: any) {
      // Handle invalid UUID or other push token errors gracefully
      if (error?.message?.includes('Invalid uuid') || error?.message?.includes('projectId')) {
        console.error(
          `❌ Push token error: Invalid projectId "${projectId.substring(0, 8)}...". ` +
            'Update expo.extra.eas.projectId in app.json with a valid UUID. ' +
            'Run `npx eas-cli@latest init` (or `npm install -g eas-cli && eas init`) to generate a project ID.'
        );
      } else {
        console.error('Error fetching push token:', error);
      }
      return null;
    }

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
        .eq('id', user.id)
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
        id: user.id,
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
        .eq('id', user.id);
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
