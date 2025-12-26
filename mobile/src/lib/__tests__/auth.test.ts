import { sendMagicLink, handleMagicLink } from '../auth';

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
  });

  describe('sendMagicLink', () => {
    it('should call supabase.auth.signInWithOtp with correct email', async () => {
      const { supabase } = require('../supabase/client');
      supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });

      const result = await sendMagicLink('test@example.com');

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          emailRedirectTo: 'chemirl:///auth/callback',
        },
      });
      expect(result.success).toBe(true);
    });

    it('should trim and lowercase email', async () => {
      const { supabase } = require('../supabase/client');
      supabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });

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
      const { supabase } = require('../supabase/client');
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };
      supabase.auth.setSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const url =
        'chemirl://auth/callback?access_token=token123&refresh_token=refresh123';
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

