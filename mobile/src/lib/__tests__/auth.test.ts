import { sendMagicLink, handleMagicLink } from '../auth';
import { supabase } from '../supabase/client';

// Mock Supabase client
jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      setSession: jest.fn(),
    },
  },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `chemirl://${path}`),
  parse: jest.fn((url: string) => {
    const params = new URLSearchParams(url.split('?')[1] || '');
    return {
      queryParams: {
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token'),
      },
    };
  }),
}));

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variable before each test
    delete process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
  });

  describe('sendMagicLink', () => {
    it('should call supabase.auth.signInWithOtp with correct email', async () => {
      jest
        .spyOn(supabase.auth, 'signInWithOtp')
        .mockResolvedValue({ data: {} as any, error: null } as any);

      const result = await sendMagicLink('test@example.com');

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'chemirl:///auth/callback',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should use EXPO_PUBLIC_AUTH_REDIRECT_URL if set', async () => {
      jest
        .spyOn(supabase.auth, 'signInWithOtp')
        .mockResolvedValue({ data: {} as any, error: null } as any);

      // Set environment variable for this test
      process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL = 'custom://auth/callback';

      await sendMagicLink('test@example.com');

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'custom://auth/callback',
        },
      });
    });

    it('should trim and lowercase email', async () => {
      jest
        .spyOn(supabase.auth, 'signInWithOtp')
        .mockResolvedValue({ data: {} as any, error: null } as any);

      await sendMagicLink('  TEST@EXAMPLE.COM  ');

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        })
      );
    });
  });

  describe('handleMagicLink', () => {
    it('should extract tokens from URL and set session', async () => {
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };
      jest
        .spyOn(supabase.auth, 'setSession')
        .mockResolvedValue({ data: { session: mockSession }, error: null } as any);

      const url = 'chemirl://auth/callback?access_token=token123&refresh_token=refresh123';
      const result = await handleMagicLink(url);

      expect(supabase.auth.setSession).toHaveBeenCalledWith({
        access_token: 'token123',
        refresh_token: 'refresh123',
      });
      expect(result.success).toBe(true);
      expect(result.session).toBe(mockSession);
    });

    it('should return error if no tokens in URL', async () => {
      const url = 'chemirl://auth/callback';
      const result = await handleMagicLink(url);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No tokens in URL');
    });
  });
});
