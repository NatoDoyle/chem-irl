/**
 * Mobile client errors → Bronto (via analytics_events).
 *
 * Bronto (dataset chem-irl-app) is the app's sole telemetry platform —
 * decision 2026-07-10; the Sentry SDK has no DSN and sends nothing. This
 * module records handled errors and render crashes as `client_error`
 * analytics rows, which telemetry-ship forwards to Bronto (layer: mobile)
 * within ~2 minutes. It is called from both error chokepoints
 * (`captureWithTags` in sentry.ts, `getErrorAlert` in errors.ts), never
 * from screens directly.
 *
 * Guarantees, in priority order:
 *   1. Never throws or blocks — this runs inside error paths.
 *   2. Bounded volume — per-signature dedupe window + per-session cap.
 *   3. No PII — the message is scrubbed on-device before it is stored.
 *
 * Known limits (accepted pre-launch): pre-auth errors are not recorded
 * (analytics is authenticated-only by Decision D1), and native hard
 * crashes never reach JS at all.
 */

import { scrubSentryPayload } from './sentry-scrubber';
// Type-only on purpose: errors.ts imports this module at runtime, so a
// value import here would create an import cycle.
import type { ErrorKind, ErrorLayer, ErrorSeverity } from './errors';

const DEDUPE_WINDOW_MS = 60_000;
const SESSION_CAP = 40;
const MESSAGE_MAX_CHARS = 300;
const DEDUPE_MAP_MAX = 64;

// telemetry-ship maps properties.level onto the shipped Bronto event's
// level/status — which is what appwatch alerting keys on. critical/high
// alert on the next daily run; medium only above the warn noise floor.
const LEVEL_BY_SEVERITY: Record<ErrorSeverity, 'error' | 'warn' | 'info'> = {
  critical: 'error',
  high: 'error',
  medium: 'warn',
  low: 'info',
};

export interface ClientErrorContext {
  // Which chokepoint recorded it: captureWithTags or getErrorAlert.
  source: 'capture' | 'alert';
  severity?: ErrorSeverity; // defaults to medium (level: warn)
  kind?: ErrorKind;
  // Attributed origin of the failure (mobile/edge/db). Stored as
  // `error_layer` — `layer` is a reserved Bronto field the shipper owns.
  layer?: ErrorLayer;
  // Call-site tags (screen, rpc, action, fn, job, boundary, …).
  tags?: Record<string, string>;
}

let sentThisSession = 0;
const lastSentAt = new Map<string, number>();

export function recordClientError(error: unknown, context: ClientErrorContext): void {
  try {
    if (error == null) return;
    if (sentThisSession >= SESSION_CAP) return;

    // Lazy require, inside the try: errors.ts is imported app-wide, and a
    // static import here would make it pull the supabase client (via
    // analytics) at module-init time. This also swallows a broken
    // analytics/client init instead of crashing an error path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { trackEvent } = require('./analytics') as typeof import('./analytics');

    const name = error instanceof Error ? error.name : typeof error;
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = scrubSentryPayload(rawMessage).slice(0, MESSAGE_MAX_CHARS);

    const signature = `${name}|${message}`;
    const now = Date.now();
    const last = lastSentAt.get(signature);
    if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return;
    if (lastSentAt.size >= DEDUPE_MAP_MAX) lastSentAt.clear();
    lastSentAt.set(signature, now);
    sentThisSession += 1;

    const severity = context.severity ?? 'medium';
    // Computed keys spread last so a caller tag can't clobber them
    // (mirrors buildEvent's reserved-keys rule in _shared/bronto.ts).
    trackEvent('client_error', {
      ...(context.tags ?? {}),
      level: LEVEL_BY_SEVERITY[severity],
      severity,
      error_name: name,
      error_message: message,
      // Not `source`: telemetry-ship reserves source/source_id for the
      // forwarded-row dedupe key and would silently clobber it in Bronto.
      recorded_via: context.source,
      ...(context.kind ? { kind: context.kind } : {}),
      ...(context.layer ? { error_layer: context.layer } : {}),
    });
  } catch {
    // Telemetry must never throw inside an error path.
  }
}
