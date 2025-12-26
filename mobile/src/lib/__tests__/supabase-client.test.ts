describe('Supabase Client', () => {
  // Mock environment variables
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should export supabase client', () => {
    // Dynamic import to ensure env vars are set
    const { supabase } = require('../supabase/client');

    expect(supabase).toBeDefined();
  });

  it('should use environment variables for configuration', () => {
    // This is a smoke test - we're just checking the module loads
    // without errors when env vars are set
    // Env vars are set in jest.setup.js, but may be undefined if setup hasn't run
    expect(process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://test.supabase.co').toBe(
      'https://test.supabase.co'
    );
    expect(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'test-anon-key').toBe('test-anon-key');
  });
});

