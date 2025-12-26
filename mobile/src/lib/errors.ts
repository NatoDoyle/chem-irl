/**
 * Centralized error handling utilities for mobile app
 */

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
