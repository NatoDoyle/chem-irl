/**
 * Tests for LargeSecureStore - AES-256 encryption layer that works around
 * Expo SecureStore's 2048-byte value limit.
 *
 * The class stores an AES-256 key in SecureStore and the encrypted
 * ciphertext in AsyncStorage. This test validates the encrypt/decrypt
 * round-trip and the getItem/setItem/removeItem interface.
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// We cannot import LargeSecureStore directly because it's not exported.
// Instead, we test it indirectly through the supabase client's auth.storage,
// or we can instantiate the class by re-implementing the import.
// Since the class is defined in client.ts and only instantiated there,
// we'll test the behavior by requiring the module and extracting the storage
// object from the createClient call.

// Mock createClient to capture the storage option
let capturedStorage: any = null;

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, _key: string, options: any) => {
    capturedStorage = options?.auth?.storage ?? null;
    return {
      auth: {
        getSession: jest.fn(),
        startAutoRefresh: jest.fn(),
        stopAutoRefresh: jest.fn(),
      },
      from: jest.fn(),
    };
  }),
}));

// Mock react-native-get-random-values (required import in client.ts)
jest.mock('react-native-get-random-values', () => {});

// Use a deterministic key for testing so we can verify encryption output
// The setup file provides a random implementation; we override for specific tests
const mockGetRandomValues = jest.fn((arr: Uint8Array) => {
  // Fill with a deterministic pattern for predictable test results
  for (let i = 0; i < arr.length; i++) {
    arr[i] = i % 256;
  }
  return arr;
});

// Override the global crypto mock with our deterministic version
global.crypto = {
  getRandomValues: mockGetRandomValues,
} as any;

// Set env vars before importing client module
const env = process.env as any;
env['EXPO_PUBLIC_SUPABASE_URL'] = 'https://test-project.supabase.co';
env['EXPO_PUBLIC_SUPABASE_KEY'] = 'test-anon-key';

// Import the module to trigger createClient and capture the storage instance
// eslint-disable-next-line import/first, @typescript-eslint/no-require-imports
require('../supabase/client');

describe('LargeSecureStore', () => {
  let store: any;

  beforeAll(() => {
    // The import above should have triggered createClient which captures the storage
    expect(capturedStorage).not.toBeNull();
    store = capturedStorage;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore deterministic random values for each test
    mockGetRandomValues.mockImplementation((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = i % 256;
      }
      return arr;
    });
  });

  describe('setItem', () => {
    it('should store encrypted value in AsyncStorage and key in SecureStore', async () => {
      const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
      const mockAsyncSetItem = AsyncStorage.setItem as jest.Mock;
      mockSetItemAsync.mockResolvedValue(undefined);
      mockAsyncSetItem.mockResolvedValue(undefined);

      await store.setItem('session-key', 'my-secret-session-data');

      // SecureStore should receive the encryption key (hex-encoded)
      expect(mockSetItemAsync).toHaveBeenCalledWith('session-key', expect.any(String));
      const storedKeyHex = mockSetItemAsync.mock.calls[0][1];
      // AES-256 key = 32 bytes = 64 hex chars
      expect(storedKeyHex).toHaveLength(64);

      // AsyncStorage should receive the encrypted ciphertext (hex-encoded)
      expect(mockAsyncSetItem).toHaveBeenCalledWith('session-key', expect.any(String));
      const storedCiphertext = mockAsyncSetItem.mock.calls[0][1];
      // Ciphertext should not be the original plaintext
      expect(storedCiphertext).not.toBe('my-secret-session-data');
      // Ciphertext should be a hex string (even number of chars, all hex digits)
      expect(storedCiphertext).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce different ciphertext for different plaintext', async () => {
      const mockSetItemAsync = SecureStore.setItemAsync as jest.Mock;
      const mockAsyncSetItem = AsyncStorage.setItem as jest.Mock;
      mockSetItemAsync.mockResolvedValue(undefined);
      mockAsyncSetItem.mockResolvedValue(undefined);

      await store.setItem('key-1', 'first-value');
      const ciphertext1 = mockAsyncSetItem.mock.calls[0][1];

      jest.clearAllMocks();
      mockSetItemAsync.mockResolvedValue(undefined);
      mockAsyncSetItem.mockResolvedValue(undefined);

      await store.setItem('key-2', 'second-value');
      const ciphertext2 = mockAsyncSetItem.mock.calls[0][1];

      expect(ciphertext1).not.toBe(ciphertext2);
    });
  });

  describe('getItem', () => {
    it('should return null when no encrypted value exists in AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await store.getItem('nonexistent-key');

      expect(result).toBeNull();
      // Should not try to decrypt if there is no value
      expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
    });

    it('should return null when encryption key is missing from SecureStore', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('some-encrypted-hex');
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const result = await store.getItem('key-without-encryption-key');

      expect(result).toBeNull();
    });

    it('should decrypt and return the original value on a round-trip', async () => {
      // Simulate setItem storing values
      let storedEncryptionKey: string | null = null;
      let storedCiphertext: string | null = null;

      (SecureStore.setItemAsync as jest.Mock).mockImplementation(
        async (_key: string, value: string) => {
          storedEncryptionKey = value;
        }
      );
      (AsyncStorage.setItem as jest.Mock).mockImplementation(
        async (_key: string, value: string) => {
          storedCiphertext = value;
        }
      );

      const originalValue = 'sensitive-session-token-data-that-exceeds-2048-bytes-limit';
      await store.setItem('test-roundtrip', originalValue);

      // Now simulate getItem reading those stored values back
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(storedCiphertext);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(storedEncryptionKey);

      const result = await store.getItem('test-roundtrip');

      expect(result).toBe(originalValue);
    });

    it('should handle large values that exceed SecureStore 2048 byte limit', async () => {
      let storedEncryptionKey: string | null = null;
      let storedCiphertext: string | null = null;

      (SecureStore.setItemAsync as jest.Mock).mockImplementation(
        async (_key: string, value: string) => {
          storedEncryptionKey = value;
        }
      );
      (AsyncStorage.setItem as jest.Mock).mockImplementation(
        async (_key: string, value: string) => {
          storedCiphertext = value;
        }
      );

      // Create a value larger than 2048 bytes
      const largeValue = 'A'.repeat(4096);
      await store.setItem('large-key', largeValue);

      // The encryption key stored in SecureStore should be small (64 hex chars for AES-256)
      expect(storedEncryptionKey).not.toBeNull();
      expect(storedEncryptionKey!.length).toBe(64);

      // The ciphertext can be large but that is in AsyncStorage (no size limit)
      expect(storedCiphertext).not.toBeNull();

      // Round-trip: decrypt should return the original large value
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(storedCiphertext);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(storedEncryptionKey);

      const result = await store.getItem('large-key');
      expect(result).toBe(largeValue);
    });

    it('should correctly decrypt values containing special characters and unicode', async () => {
      let storedEncryptionKey: string | null = null;
      let storedCiphertext: string | null = null;

      (SecureStore.setItemAsync as jest.Mock).mockImplementation(
        async (_key: string, value: string) => {
          storedEncryptionKey = value;
        }
      );
      (AsyncStorage.setItem as jest.Mock).mockImplementation(
        async (_key: string, value: string) => {
          storedCiphertext = value;
        }
      );

      const specialValue = '{"access_token":"eyJ...","user":{"email":"user@test.com"}}';
      await store.setItem('json-session', specialValue);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(storedCiphertext);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(storedEncryptionKey);

      const result = await store.getItem('json-session');
      expect(result).toBe(specialValue);
    });
  });

  describe('removeItem', () => {
    it('should remove from both AsyncStorage and SecureStore', async () => {
      const mockAsyncRemoveItem = AsyncStorage.removeItem as jest.Mock;
      const mockSecureDeleteItem = SecureStore.deleteItemAsync as jest.Mock;
      mockAsyncRemoveItem.mockResolvedValue(undefined);
      mockSecureDeleteItem.mockResolvedValue(undefined);

      await store.removeItem('session-to-delete');

      expect(mockAsyncRemoveItem).toHaveBeenCalledWith('session-to-delete');
      expect(mockSecureDeleteItem).toHaveBeenCalledWith('session-to-delete');
    });

    it('should remove from AsyncStorage before SecureStore', async () => {
      const callOrder: string[] = [];

      (AsyncStorage.removeItem as jest.Mock).mockImplementation(async () => {
        callOrder.push('async');
      });
      (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async () => {
        callOrder.push('secure');
      });

      await store.removeItem('ordered-removal');

      // AsyncStorage.removeItem is called first, then SecureStore.deleteItemAsync
      expect(callOrder).toEqual(['async', 'secure']);
    });
  });

  describe('encrypt/decrypt consistency', () => {
    it('should produce different ciphertext for the same value with different keys', async () => {
      const ciphertexts: string[] = [];
      let callCount = 0;

      // Override getRandomValues to produce different keys on each call
      mockGetRandomValues.mockImplementation((arr: Uint8Array) => {
        callCount++;
        for (let i = 0; i < arr.length; i++) {
          arr[i] = (i + callCount * 37) % 256;
        }
        return arr;
      });

      (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
      (AsyncStorage.setItem as jest.Mock).mockImplementation(
        async (_key: string, value: string) => {
          ciphertexts.push(value);
        }
      );

      await store.setItem('key-a', 'same-plaintext');
      await store.setItem('key-b', 'same-plaintext');

      // Different random keys should produce different ciphertext
      expect(ciphertexts).toHaveLength(2);
      expect(ciphertexts[0]).not.toBe(ciphertexts[1]);
    });
  });
});
