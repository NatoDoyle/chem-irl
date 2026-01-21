import { sendEmailOTP, verifyEmailOTP, completeSignup } from '../auth';
import { supabase } from '../supabase/client';

// Mock Supabase client
jest.mock('../supabase/client', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      updateUser: jest.fn(),
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

describe('Auth Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendEmailOTP', () => {
    it('should call supabase.auth.signInWithOtp with correct email and shouldCreateUser (no emailRedirectTo)', async () => {
      jest
        .spyOn(supabase.auth, 'signInWithOtp')
        .mockResolvedValue({ data: {} as any, error: null } as any);

      const result = await sendEmailOTP('test@example.com', true);

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          shouldCreateUser: true,
        },
      });
      // Verify NO emailRedirectTo or redirectUrl is passed
      const callArgs = (supabase.auth.signInWithOtp as jest.Mock).mock.calls[0][0];
      expect(callArgs.emailRedirectTo).toBeUndefined();
      expect(callArgs.redirectTo).toBeUndefined();
      expect(callArgs.options?.emailRedirectTo).toBeUndefined();
      expect(result.success).toBe(true);
    });

    it('should use shouldCreateUser: false for login', async () => {
      jest
        .spyOn(supabase.auth, 'signInWithOtp')
        .mockResolvedValue({ data: {} as any, error: null } as any);

      await sendEmailOTP('test@example.com', false);

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        options: {
          shouldCreateUser: false,
        },
      });
    });
  });

  describe('verifyEmailOTP', () => {
    it('should verify email OTP code', async () => {
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };
      jest
        .spyOn(supabase.auth, 'verifyOtp')
        .mockResolvedValue({ data: { session: mockSession }, error: null } as any);

      const result = await verifyEmailOTP('test@example.com', '123456', true);

      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.com',
        token: '123456',
        type: 'email',
      });
      expect(result.success).toBe(true);
      expect(result.session).toBe(mockSession);
    });
  });

  describe('completeSignup', () => {
    it('should update profile with full_name and signup_completed', async () => {
      const mockUser = { id: 'user-123' };
      const mockUpsert = jest.fn().mockResolvedValue({ error: null });

      jest.spyOn(supabase.auth, 'getUser').mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);
      jest.spyOn(supabase, 'from').mockReturnValue({
        upsert: mockUpsert,
      } as any);

      const result = await completeSignup('John Doe');

      expect(supabase.from).toHaveBeenCalledWith('profiles');
      expect(mockUpsert).toHaveBeenCalledWith({
        id: 'user-123',
        full_name: 'John Doe',
        signup_completed: true,
      });
      expect(result.success).toBe(true);
    });
  });
});
