// Minimal mocks for unit tests that don't need React Native setup
// This avoids parsing react-native/jest/** files entirely

// Note: We don't set EXPO_PUBLIC_* env vars here because Babel inlines them
// at transform time. Tests that need env vars should mock the modules that use them
// (see supabase-client.test.ts for an example)

// Mock react-native if any code imports it
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios ?? obj.default,
  },
}));

// Mock react-native-get-random-values (required by LargeSecureStore)
jest.mock('react-native-get-random-values', () => {});

// Mock expo-secure-store if used in supabase/auth layer
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock AsyncStorage (used by LargeSecureStore)
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock crypto.getRandomValues for aes-js
global.crypto = {
  getRandomValues: jest.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
};

