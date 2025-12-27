import { supabase } from './supabase/client';

/**
 * Extract storage path from Supabase public URL
 *
 * Supabase public URLs have format:
 * https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *
 * @param url - Public URL from Supabase Storage
 * @param bucket - Expected bucket name (default: 'profiles')
 * @returns Storage path or null if URL doesn't match expected format
 */
export function extractStoragePathFromUrl(url: string, bucket: string = 'profiles'): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');

    // Path should be: /storage/v1/object/public/<bucket>/<path>
    const publicIndex = pathParts.indexOf('public');
    if (publicIndex === -1 || publicIndex >= pathParts.length - 2) {
      return null;
    }

    const bucketIndex = publicIndex + 1;
    if (pathParts[bucketIndex] !== bucket) {
      return null;
    }

    // Everything after bucket is the path
    const path = pathParts.slice(bucketIndex + 1).join('/');
    return path || null;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Validate that a storage path belongs to a specific user
 *
 * @param path - Storage path (format: userId/filename)
 * @param userId - Expected user ID
 * @returns true if path belongs to user, false otherwise
 */
export function validatePathOwnership(path: string, userId: string): boolean {
  if (!path || !userId) {
    return false;
  }

  // Path format should be: userId/filename
  const pathParts = path.split('/');
  if (pathParts.length < 2) {
    return false;
  }

  return pathParts[0] === userId;
}

/**
 * Delete a photo from Supabase Storage
 *
 * @param photoUrl - Public URL of the photo
 * @param userId - Current user's ID (for ownership validation)
 * @param bucket - Storage bucket name (default: 'profiles')
 * @returns Success status and error message if failed
 */
export async function deletePhotoFromStorage(
  photoUrl: string,
  userId: string,
  bucket: string = 'profiles'
): Promise<{ success: boolean; error?: string }> {
  // Extract storage path from URL
  const path = extractStoragePathFromUrl(photoUrl, bucket);
  if (!path) {
    return {
      success: false,
      error: 'Invalid photo URL format',
    };
  }

  // Validate ownership
  if (!validatePathOwnership(path, userId)) {
    return {
      success: false,
      error: 'Photo does not belong to current user',
    };
  }

  // Delete from storage
  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  return { success: true };
}
