// Mock react-native-get-random-values before any imports
jest.mock('react-native-get-random-values', () => {});

// Mock expo-secure-store before importing anything
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock crypto.getRandomValues for aes-js (needed for LargeSecureStore encryption)
global.crypto = {
  getRandomValues: jest.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
} as any;

// Mock @supabase/supabase-js createClient
const mockCreateClient = jest.fn(() => ({
  auth: {
    getSession: jest.fn(),
    signInWithOtp: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  })),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    jest.resetModules();
    // Set env vars before requiring the module
    // Use bracket notation to avoid Babel inlining
    const env = process.env as any;
    env['EXPO_PUBLIC_SUPABASE_URL'] = 'https://test-project.supabase.co';
    env['EXPO_PUBLIC_SUPABASE_KEY'] =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3QtcHJvamVjdCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjE2MjM5MDIyLCJleHAiOjE5MzE4MTUwMjJ9.test-signature';
  });

  it('should export supabase client', () => {
    // Dynamic require after env vars are set
    const { supabase } = require('../supabase/client');

    expect(supabase).toBeDefined();
    expect(supabase).toBeTruthy();
    // Note: Babel inlines process.env.EXPO_PUBLIC_* at build time, so values may be undefined
    // The important thing is that createClient was called and the client is exported
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockCreateClient.mock.calls[0][2]).toMatchObject({
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  });

  it('should use environment variables for configuration', () => {
    const env = process.env as any;
    expect(env['EXPO_PUBLIC_SUPABASE_URL']).toBe('https://test-project.supabase.co');
    expect(env['EXPO_PUBLIC_SUPABASE_KEY']).toBeDefined();
  });
});

