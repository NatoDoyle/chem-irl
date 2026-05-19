/**
 * Sentry utilities for adding breadcrumbs and context
 *
 * Provides helper functions to add breadcrumbs and user context to Sentry.
 * All functions safely handle the case where Sentry is not available.
 */

import {
  ERROR_LAYERS,
  ERROR_SEVERITIES,
  type ErrorKind,
  type ErrorLayer,
  type ErrorSeverity,
} from './errors';
import { scrubSentryPayload } from './sentry-scrubber';
import { runbookUrl } from './runbook-url';

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

// === Tagged + scrubbed capture (PR-B) =============================
// Builds on the PR-A primitives. Use this instead of calling
// SentryModule.captureException directly so every event lands with:
//   - layer + severity + kind tags
//   - call-site tags (screen, rpc, action, fn, job)
//   - a stable fingerprint so duplicates collapse into one issue
//   - a runbook URL the dashboard links to
//   - an `extra` payload run through scrubSentryPayload so PII (chat
//     bodies, emails, photo URLs) never leaves the device.

export interface CaptureOptions {
  layer: ErrorLayer;
  // Optional but strongly encouraged: identifies the failure class
  // (e.g. ERROR_KINDS.RpcInvalidInput). Drives the fingerprint and the
  // runbook URL.
  kind?: ErrorKind;
  // Defaults to 'medium'. Sentry alert rules in PR-E key off this.
  severity?: ErrorSeverity;
  // Call-site tags. Reserved keys: screen, fn, job, rpc, action.
  tags?: Record<string, string>;
  // Free-form structured context. PII-scrubbed before send.
  extra?: Record<string, unknown>;
}

function buildFingerprint(error: unknown, options: CaptureOptions): string[] {
  const where = options.tags?.screen ?? options.tags?.fn ?? options.tags?.job ?? 'unknown';
  const action = options.tags?.rpc ?? options.tags?.action ?? null;
  const what = options.kind ?? (error instanceof Error ? error.name : 'unknown');
  return [options.layer, where, action, what].filter(
    (x): x is string => typeof x === 'string' && x.length > 0
  );
}

export function captureWithTags(error: unknown, options: CaptureOptions): void {
  if (!SentryModule || error == null) return;

  const tags: Record<string, string> = {
    layer: options.layer,
    severity: options.severity ?? ERROR_SEVERITIES.Medium,
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.tags ?? {}),
  };

  const scrubbedExtra = options.extra
    ? (scrubSentryPayload(options.extra) as Record<string, unknown>)
    : {};
  if (options.kind) {
    scrubbedExtra.runbook_url = runbookUrl(options.kind);
  }

  const fingerprint = buildFingerprint(error, options);

  const Sentry = SentryModule;
  Sentry.withScope((scope) => {
    scope.setTags(tags);
    scope.setExtras(scrubbedExtra);
    scope.setFingerprint(fingerprint);
    Sentry.captureException(error);
  });
}

// Re-exported convenience values so call sites don't have to import both
// the layer constants and this helper.
export { ERROR_LAYERS, ERROR_SEVERITIES };
