// Jest setup file for React Native/Expo tests
// This is loaded by jest-expo preset and any config that includes it

process.env.EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://test.supabase.co';

// Standardize on EXPO_PUBLIC_SUPABASE_KEY with backwards compatibility
process.env.EXPO_PUBLIC_SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  'test-publishable-key';

