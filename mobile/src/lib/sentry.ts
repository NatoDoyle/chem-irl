/**
 * Sentry utilities for adding breadcrumbs and context
 *
 * Provides helper functions to add breadcrumbs and user context to Sentry.
 * All functions safely handle the case where Sentry is not available.
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

/**
 * Add a breadcrumb to Sentry for debugging
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  if (SentryModule) {
    SentryModule.addBreadcrumb({
      message,
      category: category || 'user',
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }
}

/**
 * Set user context in Sentry
 */
export function setUserContext(userId: string, email?: string): void {
  if (SentryModule) {
    SentryModule.setUser({
      id: userId,
      email,
    });
  }
}

/**
 * Clear user context in Sentry
 */
export function clearUserContext(): void {
  if (SentryModule) {
    SentryModule.setUser(null);
  }
}
