/**
 * Tests for analytics utility functions.
 *
 * The analytics module provides trackEvent, identifyUser, and resetUser.
 * In dev mode (__DEV__), events are logged to console. In production, they would
 * be sent to an analytics SDK.
 */

import { trackEvent, identifyUser, resetUser } from '../analytics';

describe('Analytics', () => {
  let consoleLogSpy: jest.SpyInstance;
  const originalDev = (global as any).__DEV__;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    (global as any).__DEV__ = originalDev;
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
