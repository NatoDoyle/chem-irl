/**
 * Tests for enhanced storage path validation
 */

// Mock supabase client before importing
jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    storage: {
      from: jest.fn(),
    },
  },
}));

// eslint-disable-next-line import/first
import { extractStoragePathFromUrl, validatePathOwnership } from '../storage';

describe('Storage Path Validation', () => {
  describe('extractStoragePathFromUrl', () => {
    it('should reject URLs without http:// or https://', () => {
      expect(extractStoragePathFromUrl('invalid-url')).toBeNull();
      expect(extractStoragePathFromUrl('ftp://example.com/path')).toBeNull();
      expect(extractStoragePathFromUrl('//example.com/path')).toBeNull();
    });

    it('should reject URLs without supabase.co domain', () => {
      expect(
        extractStoragePathFromUrl(
          'https://example.com/storage/v1/object/public/profiles/user/file.jpg'
        )
      ).toBeNull();
    });

    it('should reject URLs without expected path structure', () => {
      expect(extractStoragePathFromUrl('https://abc123.supabase.co/invalid/path')).toBeNull();
    });

    it('should extract path from valid Supabase URL', () => {
      const url = 'https://abc123.supabase.co/storage/v1/object/public/profiles/user-123/photo.jpg';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-123/photo.jpg');
    });

    it('should handle URLs with query parameters', () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-123/photo.jpg?t=123456';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-123/photo.jpg');
    });

    it('should handle URLs with fragments', () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-123/photo.jpg#section';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-123/photo.jpg');
    });

    it('should validate bucket name matches', () => {
      const url = 'https://abc123.supabase.co/storage/v1/object/public/profiles/user-123/photo.jpg';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-123/photo.jpg');

      // Wrong bucket
      const wrongPath = extractStoragePathFromUrl(url, 'avatars');
      expect(wrongPath).toBeNull();
    });

    it('should handle nested paths', () => {
      const url =
        'https://abc123.supabase.co/storage/v1/object/public/profiles/user-123/folder/subfolder/photo.jpg';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-123/folder/subfolder/photo.jpg');
    });

    it('should trim whitespace from URL', () => {
      const url =
        '  https://abc123.supabase.co/storage/v1/object/public/profiles/user-123/photo.jpg  ';
      const path = extractStoragePathFromUrl(url, 'profiles');
      expect(path).toBe('user-123/photo.jpg');
    });
  });

  describe('validatePathOwnership', () => {
    it('should validate path belongs to user', () => {
      expect(validatePathOwnership('user-123/photo.jpg', 'user-123')).toBe(true);
      expect(validatePathOwnership('user-456/photo.jpg', 'user-123')).toBe(false);
    });

    it('should reject paths without user prefix', () => {
      expect(validatePathOwnership('photo.jpg', 'user-123')).toBe(false);
      expect(validatePathOwnership('folder/photo.jpg', 'user-123')).toBe(false);
    });

    it('should handle nested paths', () => {
      expect(validatePathOwnership('user-123/folder/photo.jpg', 'user-123')).toBe(true);
      expect(validatePathOwnership('user-456/folder/photo.jpg', 'user-123')).toBe(false);
    });

    it('should reject empty or invalid inputs', () => {
      expect(validatePathOwnership('', 'user-123')).toBe(false);
      expect(validatePathOwnership('user-123/photo.jpg', '')).toBe(false);
      expect(validatePathOwnership('', '')).toBe(false);
    });
  });
});
