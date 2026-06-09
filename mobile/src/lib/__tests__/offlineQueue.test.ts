// Mock AsyncStorage before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock the supabase client so importing offlineQueue doesn't init the real one
jest.mock('../supabase/client', () => ({
  supabase: { from: jest.fn() },
}));

// eslint-disable-next-line import/first
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line import/first
import { clearQueue } from '../offlineQueue';

const QUEUE_STORAGE_KEY = '@chemirl:offline_queue';

describe('offlineQueue.clearQueue', () => {
  beforeEach(() => {
    (AsyncStorage.removeItem as jest.Mock).mockClear();
  });

  it('removes the offline queue storage key', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    await clearQueue();

    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(QUEUE_STORAGE_KEY);
  });

  it('is best-effort: swallows storage errors so sign-out is not blocked', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('storage unavailable'));

    await expect(clearQueue()).resolves.toBeUndefined();
  });
});
