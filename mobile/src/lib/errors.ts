/**
 * Centralized error handling utilities for mobile app
 */

// Lazy import Sentry to avoid requiring it when not configured
// eslint-disable-next-line @typescript-eslint/no-require-imports
let SentryModule: typeof import('@sentry/react-native') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SentryModule = require('@sentry/react-native');
} catch {
  // Sentry not installed or not available
}

export interface AppError {
  message: string;
  code?: string;
  recoverable?: boolean;
}

/**
 * Format error message for user display
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

/**
 * Check if error is recoverable (user can retry)
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors are usually recoverable
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return true;
    }
  }
  return false;
}

/**
 * Check if error indicates session expiry
 */
export function isSessionExpiredError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const code = (error as any).code?.toLowerCase() || '';
    // Common session expiry indicators
    return (
      message.includes('session') ||
      message.includes('expired') ||
      message.includes('token') ||
      message.includes('invalid refresh token') ||
      message.includes('jwt expired') ||
      code === 'invalid_grant' ||
      code === 'token_expired'
    );
  }
  return false;
}

/**
 * Get user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
  const message = formatError(error);

  // Map common error messages to user-friendly ones
  const errorMap: Record<string, string> = {
    'Failed to fetch': 'Network error. Please check your connection.',
    'Network request failed': 'Network error. Please check your connection.',
    'Invalid login credentials': 'Invalid email or password.',
    'User already registered': 'This email is already registered.',
    'Email not confirmed': 'Please check your email and confirm your account.',
  };

  for (const [key, value] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return message;
}

/**
 * Helper to get error message for Alert.alert
 * Returns { title, message } for use with Alert.alert(title, message)
 */
export function getErrorAlert(
  error: unknown,
  title: string = 'Error'
): { title: string; message: string } {
  // Capture error in Sentry if available
  if (SentryModule && error) {
    SentryModule.captureException(error, {
      tags: { errorTitle: title },
    });
  }

  return {
    title,
    message: getUserErrorMessage(error),
  };
}
