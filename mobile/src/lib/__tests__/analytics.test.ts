/**
 * Tests for analytics utility functions.
 *
 * The analytics module provides trackEvent, identifyUser, resetUser, and
 * recordEvent. In dev mode (__DEV__) trackEvent logs to console only; in
 * production it writes to the Supabase-native `analytics_events` table via
 * recordEvent (fire-and-forget).
 */

import { trackEvent, identifyUser, resetUser, recordEvent } from '../analytics';
import { supabase } from '../supabase/client';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

jest.mock('../supabase/client', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
    from: jest.fn(),
  },
}));

describe('Analytics', () => {
  let consoleLogSpy: jest.SpyInstance;
  const originalDev = (global as any).__DEV__;
  let insertMock: jest.Mock;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    insertMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });
    // Default: no session → recordEvent no-ops (keeps the existing
    // production-mode trackEvent tests from touching the DB).
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    (global as any).__DEV__ = originalDev;
    jest.clearAllMocks();
  });

  describe('trackEvent', () => {
    it('should log events to console in dev mode', () => {
      (global as any).__DEV__ = true;

      trackEvent('user_signed_up', { userId: 'abc12345', method: 'email_otp' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics]', 'user_signed_up', {
        userId: 'abc12345',
        method: 'email_otp',
      });
    });

    it('should log events with empty properties when none provided in dev mode', () => {
      (global as any).__DEV__ = true;

      trackEvent('match_created');

      expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics]', 'match_created', {});
    });

    it('should not log events when not in dev mode', () => {
      (global as any).__DEV__ = false;

      trackEvent('user_signed_in', { userId: 'def45678' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('recordEvent', () => {
    it('inserts the event for the authenticated user', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      await recordEvent('like_sent', { target: 'abc' });

      expect(supabase.from).toHaveBeenCalledWith('analytics_events');
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          event: 'like_sent',
          properties: { target: 'abc' },
        })
      );
    });

    it('defaults properties to an empty object', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });

      await recordEvent('match_created');

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'match_created', properties: {} })
      );
    });

    it('no-ops when there is no session', async () => {
      await recordEvent('like_sent');

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('never throws if the insert fails', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: 'user-123' } } },
      });
      insertMock.mockRejectedValue(new Error('db down'));

      await expect(recordEvent('like_sent')).resolves.toBeUndefined();
    });
  });

  describe('identifyUser', () => {
    it('should log user identification in dev mode', () => {
      (global as any).__DEV__ = true;

      identifyUser('user-123', { email: 'test@example.com' });

      expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics] Identify user:', 'user-123', {
        email: 'test@example.com',
      });
    });

    it('should log with empty properties when none provided in dev mode', () => {
      (global as any).__DEV__ = true;

      identifyUser('user-456');

      expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics] Identify user:', 'user-456', {});
    });

    it('should not log when not in dev mode', () => {
      (global as any).__DEV__ = false;

      identifyUser('user-123');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('resetUser', () => {
    it('should log reset in dev mode', () => {
      (global as any).__DEV__ = true;

      resetUser();

      expect(consoleLogSpy).toHaveBeenCalledWith('[Analytics] Reset user');
    });

    it('should not log when not in dev mode', () => {
      (global as any).__DEV__ = false;

      resetUser();

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
