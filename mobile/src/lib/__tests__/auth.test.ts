import {
  sendEmailOTP,
  verifyEmailOTP,
  sendPhoneOTP,
  verifyPhoneOTP,
  updatePhone,
  completeSignup,
} from '../auth';
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

  describe('sendPhoneOTP', () => {
    it('should call supabase.auth.signInWithOtp with phone', async () => {
      jest
        .spyOn(supabase.auth, 'signInWithOtp')
        .mockResolvedValue({ data: {} as any, error: null } as any);

      const result = await sendPhoneOTP('+1234567890', true);

      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        phone: '+1234567890',
        options: {
          shouldCreateUser: true,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('verifyPhoneOTP', () => {
    it('should verify phone OTP code', async () => {
      const mockSession = { access_token: 'token', refresh_token: 'refresh' };
      jest
        .spyOn(supabase.auth, 'verifyOtp')
        .mockResolvedValue({ data: { session: mockSession }, error: null } as any);

      const result = await verifyPhoneOTP('+1234567890', '123456', 'sms');

      expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
        phone: '+1234567890',
        token: '123456',
        type: 'sms',
      });
      expect(result.success).toBe(true);
      expect(result.session).toBe(mockSession);
    });
  });

  describe('updatePhone', () => {
    it('should update user phone number', async () => {
      const mockUser = { id: 'user-123', phone: '+1234567890' };
      jest
        .spyOn(supabase.auth, 'updateUser')
        .mockResolvedValue({ data: { user: mockUser }, error: null } as any);

      const result = await updatePhone('+1234567890');

      expect(supabase.auth.updateUser).toHaveBeenCalledWith({
        phone: '+1234567890',
      });
      expect(result.success).toBe(true);
      expect(result.user).toBe(mockUser);
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
        user_id: 'user-123',
        full_name: 'John Doe',
        signup_completed: true,
      });
      expect(result.success).toBe(true);
    });
  });
});
