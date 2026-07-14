/**
 * Centralized error handling utilities for mobile app
 */

import { addBreadcrumb } from './sentry';
import { recordClientError } from './clientErrorEvents';

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
  // Add breadcrumb for error
  addBreadcrumb(`Error: ${title}`, 'error', 'error', {
    errorMessage: error instanceof Error ? error.message : String(error),
  });

  // Bronto is the telemetry platform of record (decision 2026-07-10) —
  // record a scrubbed client_error row (default severity: medium).
  recordClientError(error, {
    source: 'alert',
    tags: { error_title: title },
  });

  return {
    title,
    message: getUserErrorMessage(error),
  };
}

// === Error taxonomy (kinds / severities / layers) ==================
// Drives client_error tagging in Bronto (see clientErrorEvents.ts).
// Defines the shape PR-B will populate from raw errors. Existing helpers
// above (formatError, getUserErrorMessage, isRecoverableError,
// isSessionExpiredError, getErrorAlert) keep their current signatures and
// behavior in this PR; PR-B rewrites them to produce a NormalizedError
// internally while preserving the public API.

export const ERROR_KINDS = {
  AuthSessionExpired: 'auth.session_expired',
  AuthUnauthorized: 'auth.unauthorized',
  AuthRateLimited: 'auth.rate_limited',
  NetworkOffline: 'network.offline',
  NetworkTimeout: 'network.timeout',
  NetworkFetchFailed: 'network.fetch_failed',
  RpcInvalidInput: 'rpc.invalid_input',
  RpcNotFound: 'rpc.not_found',
  RpcServerError: 'rpc.server_error',
  RpcRateLimited: 'rpc.rate_limited',
  IapReceiptInvalid: 'iap.receipt_invalid',
  IapUserCancelled: 'iap.user_cancelled',
  IapStoreUnavailable: 'iap.store_unavailable',
  OfflineQueueDropped: 'offline_queue.dropped',
  StorageUploadFailed: 'storage.upload_failed',
  StorageReadFailed: 'storage.read_failed',
  ModerationBlocked: 'moderation.blocked',
  ModerationReviewRequired: 'moderation.review_required',
  RealtimeDisconnect: 'realtime.disconnect',
  Unknown: 'unknown',
} as const;
export type ErrorKind = (typeof ERROR_KINDS)[keyof typeof ERROR_KINDS];

export const ERROR_SEVERITIES = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
} as const;
export type ErrorSeverity = (typeof ERROR_SEVERITIES)[keyof typeof ERROR_SEVERITIES];

export const ERROR_LAYERS = {
  Mobile: 'mobile',
  Edge: 'edge',
  Db: 'db',
} as const;
export type ErrorLayer = (typeof ERROR_LAYERS)[keyof typeof ERROR_LAYERS];

export interface NormalizedError {
  kind: ErrorKind;
  severity: ErrorSeverity;
  layer: ErrorLayer;
  retryable: boolean;
  // Sentry tags. Always includes `kind`, `severity`, `layer`; PR-B adds
  // call-site tags like `screen`, `rpc`, `action`.
  tags: Record<string, string>;
  // Sentry `extra` data; will be passed through scrubSentryPayload before send.
  extra?: Record<string, unknown>;
  // The original thrown value preserved for Sentry.captureException.
  cause: unknown;
  // Copy safe to show the user. May be the same as the technical message.
  userMessage: string;
}
