// Mock supabase client before importing storage
const mockRemove = jest.fn();

jest.mock('../supabase/client', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        remove: mockRemove,
      })),
    },
  },
}));

// eslint-disable-next-line import/first
import {
  extractStoragePathFromUrl,
  validatePathOwnership,
  deletePhotoFromStorage,
} from '../storage';

describe('Storage utilities', () => {
  describe('extractStoragePathFromUrl', () => {
    it('should extract path from valid Supabase public URL', () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/1234567890.jpg';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-id-123/1234567890.jpg');
    });

    it('should handle URLs with query parameters', () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/1234567890.jpg?token=xyz';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-id-123/1234567890.jpg');
    });

    it('should handle nested paths', () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/subfolder/image.jpg';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-id-123/subfolder/image.jpg');
    });

    it('should return null for invalid URL format', () => {
      const url = 'https://example.com/image.jpg';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBeNull();
    });

    it('should return null for wrong bucket', () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/avatars/user-id-123/image.jpg';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBeNull();
    });

    it('should return null for malformed URL', () => {
      const url = 'not-a-url';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBeNull();
    });
  });

  describe('validatePathOwnership', () => {
    it('should return true for matching user ID', () => {
      expect(validatePathOwnership('user-id-123/image.jpg', 'user-id-123')).toBe(true);
    });

    it('should return false for non-matching user ID', () => {
      expect(validatePathOwnership('user-id-123/image.jpg', 'user-id-456')).toBe(false);
    });

    it('should return false for path without user ID prefix', () => {
      expect(validatePathOwnership('image.jpg', 'user-id-123')).toBe(false);
    });

    it('should return false for empty path', () => {
      expect(validatePathOwnership('', 'user-id-123')).toBe(false);
    });

    it('should return false for empty user ID', () => {
      expect(validatePathOwnership('user-id-123/image.jpg', '')).toBe(false);
    });

    it('should handle nested paths correctly', () => {
      expect(validatePathOwnership('user-id-123/subfolder/image.jpg', 'user-id-123')).toBe(true);
      expect(validatePathOwnership('user-id-123/subfolder/image.jpg', 'user-id-456')).toBe(false);
    });
  });

  describe('deletePhotoFromStorage', () => {
    beforeEach(() => {
      mockRemove.mockClear();
    });

    it('should delete photo with valid URL and matching user ID', async () => {
      mockRemove.mockResolvedValue({ data: null, error: null });
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/image.jpg';

      const result = await deletePhotoFromStorage(url, 'user-id-123');

      expect(result.success).toBe(true);
      expect(mockRemove).toHaveBeenCalledWith(['user-id-123/image.jpg']);
    });

    it('should return error for invalid URL', async () => {
      const url = 'https://example.com/image.jpg';
      const result = await deletePhotoFromStorage(url, 'user-id-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid photo URL format');
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('should return error for non-matching user ID', async () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/image.jpg';
      const result = await deletePhotoFromStorage(url, 'user-id-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Photo does not belong to current user');
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('should return error when storage deletion fails', async () => {
      mockRemove.mockResolvedValue({
        data: null,
        error: { message: 'Storage error' },
      });
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/image.jpg';

      const result = await deletePhotoFromStorage(url, 'user-id-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
      expect(mockRemove).toHaveBeenCalledWith(['user-id-123/image.jpg']);
    });
  });
});
