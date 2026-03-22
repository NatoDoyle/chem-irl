// Mock sentry before importing errors module
jest.mock('../sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

// Mock @sentry/react-native to prevent lazy require from loading it
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
}));

// eslint-disable-next-line import/first
import {
  formatError,
  isRecoverableError,
  isSessionExpiredError,
  getUserErrorMessage,
  getErrorAlert,
} from '../errors';
// eslint-disable-next-line import/first
import { addBreadcrumb } from '../sentry';

describe('Error Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('formatError', () => {
    it('should return the message from an Error instance', () => {
      const error = new Error('Something went wrong');
      expect(formatError(error)).toBe('Something went wrong');
    });

    it('should return a string error directly', () => {
      expect(formatError('Network timeout')).toBe('Network timeout');
    });

    it('should return a generic message for null', () => {
      expect(formatError(null)).toBe('An unexpected error occurred');
    });

    it('should return a generic message for undefined', () => {
      expect(formatError(undefined)).toBe('An unexpected error occurred');
    });

    it('should return a generic message for numeric values', () => {
      expect(formatError(500)).toBe('An unexpected error occurred');
    });

    it('should return a generic message for object errors without message property', () => {
      expect(formatError({ code: 'ERR_UNKNOWN' })).toBe('An unexpected error occurred');
    });
  });

  describe('isRecoverableError', () => {
    it('should return true for network errors', () => {
      const error = new Error('network request failed');
      expect(isRecoverableError(error)).toBe(true);
    });

    it('should return true for fetch errors', () => {
      const error = new Error('Failed to fetch');
      expect(isRecoverableError(error)).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isRecoverableError('network error')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isRecoverableError(null)).toBe(false);
    });

    it('should return false for auth errors', () => {
      const error = new Error('Invalid login credentials');
      expect(isRecoverableError(error)).toBe(false);
    });

    it('should return false for generic errors without network/fetch keywords', () => {
      const error = new Error('Something unexpected happened');
      expect(isRecoverableError(error)).toBe(false);
    });
  });

  describe('isSessionExpiredError', () => {
    it('should return true for jwt expired errors', () => {
      const error = new Error('JWT expired');
      expect(isSessionExpiredError(error)).toBe(true);
    });

    it('should return true for invalid refresh token errors', () => {
      const error = new Error('Invalid refresh token');
      expect(isSessionExpiredError(error)).toBe(true);
    });

    it('should return true for session-related errors', () => {
      const error = new Error('Session not found');
      expect(isSessionExpiredError(error)).toBe(true);
    });

    it('should return true for token errors', () => {
      const error = new Error('Token has been revoked');
      expect(isSessionExpiredError(error)).toBe(true);
    });

    it('should return true for expired errors', () => {
      const error = new Error('Your access has expired');
      expect(isSessionExpiredError(error)).toBe(true);
    });

    it('should return true for errors with invalid_grant code', () => {
      const error = new Error('auth error');
      (error as any).code = 'invalid_grant';
      expect(isSessionExpiredError(error)).toBe(true);
    });

    it('should return true for errors with token_expired code', () => {
      const error = new Error('auth error');
      (error as any).code = 'token_expired';
      expect(isSessionExpiredError(error)).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isSessionExpiredError('session expired')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isSessionExpiredError(null)).toBe(false);
    });

    it('should return false for unrelated errors', () => {
      const error = new Error('Network request failed');
      expect(isSessionExpiredError(error)).toBe(false);
    });
  });

  describe('getUserErrorMessage', () => {
    it('should map "Failed to fetch" to a user-friendly network message', () => {
      const error = new Error('Failed to fetch');
      expect(getUserErrorMessage(error)).toBe('Network error. Please check your connection.');
    });

    it('should map "Network request failed" to a user-friendly network message', () => {
      const error = new Error('Network request failed');
      expect(getUserErrorMessage(error)).toBe('Network error. Please check your connection.');
    });

    it('should map "Invalid login credentials" to a user-friendly message', () => {
      const error = new Error('Invalid login credentials');
      expect(getUserErrorMessage(error)).toBe('Invalid email or password.');
    });

    it('should map "User already registered" to a user-friendly message', () => {
      const error = new Error('User already registered');
      expect(getUserErrorMessage(error)).toBe('This email is already registered.');
    });

    it('should map "Email not confirmed" to a user-friendly message', () => {
      const error = new Error('Email not confirmed');
      expect(getUserErrorMessage(error)).toBe('Please check your email and confirm your account.');
    });

    it('should return the original message for unmapped errors', () => {
      const error = new Error('Some obscure database error');
      expect(getUserErrorMessage(error)).toBe('Some obscure database error');
    });

    it('should handle string error input', () => {
      expect(getUserErrorMessage('Failed to fetch data')).toBe(
        'Network error. Please check your connection.'
      );
    });
  });

  describe('getErrorAlert', () => {
    it('should return title and user-friendly message', () => {
      const error = new Error('Failed to fetch');
      const result = getErrorAlert(error, 'Load Failed');

      expect(result.title).toBe('Load Failed');
      expect(result.message).toBe('Network error. Please check your connection.');
    });

    it('should use default title when not provided', () => {
      const error = new Error('Something happened');
      const result = getErrorAlert(error);

      expect(result.title).toBe('Error');
    });

    it('should add a breadcrumb for the error', () => {
      const error = new Error('Test error');
      getErrorAlert(error, 'Test Title');

      expect(addBreadcrumb).toHaveBeenCalledWith('Error: Test Title', 'error', 'error', {
        errorMessage: 'Test error',
      });
    });

    it('should handle non-Error values in breadcrumb', () => {
      getErrorAlert('raw string error', 'String Error');

      expect(addBreadcrumb).toHaveBeenCalledWith('Error: String Error', 'error', 'error', {
        errorMessage: 'raw string error',
      });
    });

    it('should return the mapped message for known error patterns', () => {
      const error = new Error('Invalid login credentials for user@example.com');
      const result = getErrorAlert(error, 'Login Error');

      expect(result.message).toBe('Invalid email or password.');
    });
  });
});
