import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase/client';
import { extractStoragePathFromUrl } from './storage';

const LAST_RECONCILE_KEY = 'profile_photos_last_reconcile';
const RECONCILE_CACHE_HOURS = 24;

export interface ReconcilePhotosResult {
  validUrls: string[];
  invalidUrls: string[];
  hadNetworkError: boolean;
}

/**
 * Reconcile profile photos by checking if storage objects exist
 *
 * @param photoUrls - Array of photo URLs to check
 * @param userId - Current user's ID (for ownership validation)
 * @param bucket - Storage bucket name (default: 'profiles')
 * @returns Result with valid/invalid URLs and network error flag
 */
export async function reconcilePhotos(
  photoUrls: string[],
  userId: string,
  bucket: string = 'profiles'
): Promise<ReconcilePhotosResult> {
  const validUrls: string[] = [];
  const invalidUrls: string[] = [];
  let hadNetworkError = false;

  if (!photoUrls || photoUrls.length === 0) {
    return { validUrls, invalidUrls, hadNetworkError };
  }

  // Check each photo URL
  const checkPromises = photoUrls.map(async (url) => {
    try {
      // Extract storage path from URL
      const path = extractStoragePathFromUrl(url, bucket);
      if (!path) {
        // Invalid URL format - mark as invalid
        invalidUrls.push(url);
        return;
      }

      // Validate ownership (path should start with userId/)
      if (!path.startsWith(`${userId}/`)) {
        // Photo doesn't belong to user - mark as invalid for safety
        invalidUrls.push(url);
        return;
      }

      // Check if file exists by attempting to list it
      // Using list with exact path prefix to verify existence
      const pathDir = path.substring(0, path.lastIndexOf('/'));
      const fileName = path.substring(path.lastIndexOf('/') + 1);
      const { data: files, error } = await supabase.storage.from(bucket).list(pathDir, {
        limit: 1000,
        search: fileName,
      });

      if (error) {
        // Check if it's a network error vs file not found
        const errorMessage = error.message?.toLowerCase() || '';
        if (
          errorMessage.includes('network') ||
          errorMessage.includes('timeout') ||
          errorMessage.includes('econnrefused') ||
          errorMessage.includes('failed to fetch')
        ) {
          // Network error - assume valid but mark flag
          validUrls.push(url);
          hadNetworkError = true;
        } else {
          // File not found or other error - mark as invalid
          invalidUrls.push(url);
        }
      } else if (files && files.length > 0 && files.some((f) => f.name === fileName)) {
        // File exists
        validUrls.push(url);
      } else {
        // File not found in list
        invalidUrls.push(url);
      }
    } catch (error) {
      // Unexpected error - assume network issue for safety
      console.error('Error checking photo:', url, error);
      validUrls.push(url);
      hadNetworkError = true;
    }
  });

  await Promise.all(checkPromises);

  return { validUrls, invalidUrls, hadNetworkError };
}

/**
 * Check if reconciliation should run based on cache
 * Returns true if reconciliation was never run or was run more than 24h ago
 */
export async function shouldRunReconciliation(): Promise<boolean> {
  try {
    const lastReconcileStr = await AsyncStorage.getItem(LAST_RECONCILE_KEY);
    if (!lastReconcileStr) {
      return true; // Never run before
    }

    const lastReconcile = parseInt(lastReconcileStr, 10);
    const now = Date.now();
    const hoursSinceReconcile = (now - lastReconcile) / (1000 * 60 * 60);

    return hoursSinceReconcile >= RECONCILE_CACHE_HOURS;
  } catch {
    // On error, allow reconciliation to run (safe default)
    return true;
  }
}

/**
 * Mark reconciliation as completed (update cache timestamp)
 */
export async function markReconciliationComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_RECONCILE_KEY, Date.now().toString());
  } catch {
    // Silently fail - cache update is not critical
  }
}
