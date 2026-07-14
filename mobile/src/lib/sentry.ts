/**
 * Error-capture surface for the mobile app (Bronto-backed).
 *
 * Historical filename: this module once fed the Sentry SDK, which was
 * removed 2026-07-13 — it never had a DSN and never sent a single event
 * (Bronto is the sole telemetry platform, decision 2026-07-10). The
 * module keeps its name and public surface so the 15+ call sites stay
 * untouched:
 *
 *   - addBreadcrumb() feeds the in-memory trail that clientErrorEvents
 *     attaches to the next client_error ("how it happened" context).
 *   - captureWithTags() records a scrubbed client_error analytics row,
 *     forwarded to Bronto by telemetry-ship within ~2 minutes.
 *
 * Renaming this file (and sentry-scrubber.ts) is a wider import churn —
 * do it only as an explicitly requested cleanup.
 */

import {
  ERROR_LAYERS,
  ERROR_SEVERITIES,
  type ErrorKind,
  type ErrorLayer,
  type ErrorSeverity,
} from './errors';
import { recordBreadcrumb, recordClientError } from './clientErrorEvents';

/**
 * Record a breadcrumb into the client_error trail. The signature is kept
 * from the Sentry era; `level` and `data` are accepted for call-site
 * compatibility but not recorded — the trail is a compact
 * `category:message` ring (and `data` never left the device before
 * either, since the SDK was inert).
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  _level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  _data?: Record<string, unknown>
): void {
  recordBreadcrumb(message, category);
}

export interface CaptureOptions {
  layer: ErrorLayer;
  // Optional but strongly encouraged: identifies the failure class
  // (e.g. ERROR_KINDS.RpcInvalidInput). Drives the runbook_url on the
  // Bronto event.
  kind?: ErrorKind;
  // Defaults to 'medium' (Bronto level: warn). high/critical map to
  // level error, which the daily appwatch alert pages on.
  severity?: ErrorSeverity;
  // Call-site tags. Reserved keys: screen, fn, job, rpc, action.
  tags?: Record<string, string>;
  // Free-form structured context (stored as scrubbed, truncated
  // extra_head — e.g. the error boundary's componentStack).
  extra?: Record<string, unknown>;
}

export function captureWithTags(error: unknown, options: CaptureOptions): void {
  if (error == null) return;

  recordClientError(error, {
    source: 'capture',
    severity: options.severity,
    kind: options.kind,
    layer: options.layer,
    tags: options.tags,
    extra: options.extra,
  });
}

// Re-exported convenience values so call sites don't have to import both
// the layer constants and this helper.
export { ERROR_LAYERS, ERROR_SEVERITIES };
