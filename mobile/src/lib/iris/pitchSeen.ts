// Tracks whether the current user has already seen the post-signup
// "Iris is part of Chem Plus" pitch screen on this device.
//
// Stored per-user in AsyncStorage rather than in `profiles` to avoid a
// schema migration for a one-time UI flag. Worst case on device switch /
// reinstall: the user sees the pitch a second time and dismisses it.
//
// Both IrisPitchScreen (writer) and OnboardingNavigator's initial-route
// resolver (reader) import from this file so the storage key is defined
// in exactly one place.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = '@chemirl/iris_pitch_seen_';

const keyFor = (userId: string) => `${KEY_PREFIX}${userId}`;

export async function hasSeenPitch(userId: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(keyFor(userId));
    return value !== null;
  } catch {
    // Fail open — if storage is unreadable, prefer showing the pitch
    // (one extra tap to dismiss) over silently swallowing it.
    return false;
  }
}

export async function markPitchSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), new Date().toISOString());
  } catch {
    // Best-effort. If this fails, the user sees the pitch again on the
    // next OnboardingNavigator mount. Acceptable.
  }
}
