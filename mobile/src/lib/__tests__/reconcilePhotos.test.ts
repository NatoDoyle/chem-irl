// Mock AsyncStorage before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock supabase client
const mockList = jest.fn();

jest.mock('../supabase/client', () => ({
  supabase: {
    storage: {
      from: jest.fn(() => ({
        list: mockList,
      })),
    },
  },
}));

// eslint-disable-next-line import/first
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line import/first
import {
  reconcilePhotos,
  shouldRunReconciliation,
  markReconciliationComplete,
} from '../reconcilePhotos';

describe('reconcilePhotos', () => {
  beforeEach(() => {
    mockList.mockClear();
  });

  it('should return all valid URLs when all photos exist', async () => {
    mockList.mockResolvedValue({
      data: [{ name: '1234567890.jpg' }],
      error: null,
    });

    const urls = [
      'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/1234567890.jpg',
    ];
    const result = await reconcilePhotos(urls, 'user-id-123');

    expect(result.validUrls).toHaveLength(1);
    expect(result.invalidUrls).toHaveLength(0);
    expect(result.hadNetworkError).toBe(false);
  });

  it('should mark photos as invalid when they do not exist in storage', async () => {
    mockList.mockResolvedValue({
      data: [],
      error: null,
    });

    const urls = [
      'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/missing.jpg',
    ];
    const result = await reconcilePhotos(urls, 'user-id-123');

    expect(result.validUrls).toHaveLength(0);
    expect(result.invalidUrls).toHaveLength(1);
    expect(result.invalidUrls[0]).toBe(urls[0]);
    expect(result.hadNetworkError).toBe(false);
  });

  it('should mark photos as invalid when URL format is invalid', async () => {
    const urls = ['https://example.com/invalid.jpg'];
    const result = await reconcilePhotos(urls, 'user-id-123');

    expect(result.validUrls).toHaveLength(0);
    expect(result.invalidUrls).toHaveLength(1);
    expect(result.invalidUrls[0]).toBe(urls[0]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('should mark photos as invalid when they belong to different user', async () => {
    const urls = [
      'https://abc123.supabase.co/storage/v1/object/public/profiles/other-user/image.jpg',
    ];
    const result = await reconcilePhotos(urls, 'user-id-123');

    expect(result.validUrls).toHaveLength(0);
    expect(result.invalidUrls).toHaveLength(1);
    expect(result.invalidUrls[0]).toBe(urls[0]);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('should handle network errors gracefully', async () => {
    mockList.mockResolvedValue({
      data: null,
      error: { message: 'Network timeout' },
    });

    const urls = [
      'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/image.jpg',
    ];
    const result = await reconcilePhotos(urls, 'user-id-123');

    expect(result.validUrls).toHaveLength(1);
    expect(result.invalidUrls).toHaveLength(0);
    expect(result.hadNetworkError).toBe(true);
  });

  it('should handle multiple photos correctly', async () => {
    mockList
      .mockResolvedValueOnce({
        data: [{ name: 'photo1.jpg' }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ name: 'photo3.jpg' }],
        error: null,
      });

    const urls = [
      'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/photo1.jpg',
      'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/photo2.jpg',
      'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/photo3.jpg',
    ];
    const result = await reconcilePhotos(urls, 'user-id-123');

    expect(result.validUrls).toHaveLength(2);
    expect(result.invalidUrls).toHaveLength(1);
    expect(result.invalidUrls[0]).toBe(urls[1]);
  });

  it('should handle empty photo array', async () => {
    const result = await reconcilePhotos([], 'user-id-123');

    expect(result.validUrls).toHaveLength(0);
    expect(result.invalidUrls).toHaveLength(0);
    expect(result.hadNetworkError).toBe(false);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('should handle unexpected errors gracefully', async () => {
    mockList.mockRejectedValue(new Error('Unexpected error'));

    const urls = [
      'https://abc123.supabase.co/storage/v1/object/public/profiles/user-id-123/image.jpg',
    ];
    const result = await reconcilePhotos(urls, 'user-id-123');

    expect(result.validUrls).toHaveLength(1);
    expect(result.hadNetworkError).toBe(true);
  });
});

describe('shouldRunReconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true if never run before', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const result = await shouldRunReconciliation();
    expect(result).toBe(true);
  });

  it('should return false if run within 24 hours', async () => {
    const recentTimestamp = (Date.now() - 12 * 60 * 60 * 1000).toString(); // 12 hours ago
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(recentTimestamp);

    const result = await shouldRunReconciliation();
    expect(result).toBe(false);
  });

  it('should return true if run more than 24 hours ago', async () => {
    const oldTimestamp = (Date.now() - 25 * 60 * 60 * 1000).toString(); // 25 hours ago
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(oldTimestamp);

    const result = await shouldRunReconciliation();
    expect(result).toBe(true);
  });

  it('should return true on error (safe default)', async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

    const result = await shouldRunReconciliation();
    expect(result).toBe(true);
  });
});

describe('markReconciliationComplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should store current timestamp', async () => {
    const mockSetItem = AsyncStorage.setItem as jest.Mock;
    mockSetItem.mockResolvedValue(undefined);

    await markReconciliationComplete();

    expect(mockSetItem).toHaveBeenCalledWith('profile_photos_last_reconcile', expect.any(String));
    const storedTimestamp = parseInt(mockSetItem.mock.calls[0][1], 10);
    const now = Date.now();
    expect(Math.abs(now - storedTimestamp)).toBeLessThan(1000); // Within 1 second
  });

  it('should handle errors gracefully', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

    // Should not throw
    await expect(markReconciliationComplete()).resolves.toBeUndefined();
  });
});
