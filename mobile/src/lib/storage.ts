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
  // Validate input
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return null;
  }

  // Enhanced validation: Check for valid URL format before parsing
  // Must start with http:// or https://
  const trimmedUrl = url.trim();
  if (!trimmedUrl.match(/^https?:\/\//i)) {
    return null;
  }

  // Basic validation: URL should contain supabase.co domain
  if (!trimmedUrl.includes('supabase.co')) {
    return null;
  }

  // Basic validation: URL should contain expected path segments
  if (!trimmedUrl.includes('/storage/v1/object/public/')) {
    return null;
  }

  try {
    const urlObj = new URL(trimmedUrl);

    // Validate URL has expected hostname pattern (contains .supabase.co)
    if (!urlObj.hostname.includes('.supabase.co')) {
      return null;
    }

    const pathParts = urlObj.pathname.split('/').filter((part) => part.length > 0);

    // Expected path structure: storage/v1/object/public/<bucket>/<path>
    // After split('/'), empty strings are filtered, so we look for: ['storage', 'v1', 'object', 'public', bucket, ...path]
    const storageIndex = pathParts.indexOf('storage');
    if (storageIndex === -1) {
      return null;
    }

    // Validate path structure: storage/v1/object/public
    const expectedStructure = ['storage', 'v1', 'object', 'public'];
    const actualStructure = pathParts.slice(storageIndex, storageIndex + 4);
    if (JSON.stringify(actualStructure) !== JSON.stringify(expectedStructure)) {
      return null;
    }

    // Find bucket (should be at index storageIndex + 4)
    const bucketIndex = storageIndex + 4;
    if (bucketIndex >= pathParts.length || pathParts[bucketIndex] !== bucket) {
      return null;
    }

    // Everything after bucket is the path
    const pathPartsAfterBucket = pathParts.slice(bucketIndex + 1);
    if (pathPartsAfterBucket.length === 0) {
      return null;
    }

    const path = pathPartsAfterBucket.join('/');
    return path || null;
  } catch {
    // Invalid URL format
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
  const { data, error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Verify deletion succeeded
  // Supabase remove() returns an array of FileObject[] with deleted file paths (as objects with 'name' property)
  // If data is null/undefined, deletion may have failed
  if (data === null || data === undefined) {
    return {
      success: false,
      error: 'Photo deletion failed. No response from storage.',
    };
  }

  // Verify that our specific path was actually deleted
  // The data array contains FileObject[] where each object has a 'name' property with the path
  const deletedFiles = data as { name: string }[];
  const wasDeleted = deletedFiles.some((file) => file.name === path);

  if (!wasDeleted && deletedFiles.length === 0) {
    // Empty array means no files were deleted (file may not have existed)
    return {
      success: false,
      error: 'Photo deletion failed. File may not exist in storage.',
    };
  }

  if (!wasDeleted) {
    // Files were deleted, but not our target path
    // This shouldn't happen, but handle it gracefully
    return {
      success: false,
      error: 'Photo deletion verification failed. Deleted file path does not match expected path.',
    };
  }

  // Success: Our specific path was confirmed deleted
  return { success: true };
}
