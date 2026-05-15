// Shared observability wrapper for Supabase edge functions.
//
// Goal: every edge-function failure produces (a) a structured JSON log line
// in `supabase functions logs` greppable by `request_id` / `fn` / `user_id`,
// and (b) a Sentry event tagged with layer / fn / kind / severity, scrubbed
// of PII, fingerprinted for stable grouping, and linked to the on-disk
// runbook for that kind.
//
// Wraps a handler and:
//   - generates a per-request UUID
//   - logs request_start / request_complete / request_failed
//   - catches unhandled errors and returns a generic 500 to the client
//     (with the request_id so support can correlate)
//   - reports errors to Sentry if SENTRY_DSN_EDGE is set (lazy init —
//     functions that never throw never load the SDK)
//
// Usage (one-line replacement of the existing `serve(handler)` shape):
//
//   import { withObservability, type EdgeHandler } from '../_shared/observability.ts';
//
//   const handler: EdgeHandler = async (req, ctx) => {
//     // ...auth, then:
//     ctx.user_id = user.id;
//     // ...handler body...
//     return new Response(...);
//   };
//
//   serve(withObservability(handler, { name: 'validate-receipt' }));
//
// Handlers that want to raise classified errors can throw `EdgeError`
// to control the response status, the Sentry `kind` tag, and the
// runbook URL. Plain `Error` works too — it lands as `severity:high`,
// `status:500`, no kind tag.

import { scrubSentryPayload } from './sentry-scrubber.ts';
import { runbookUrl } from './runbook-url.ts';

// Severity matches mobile/src/lib/errors.ts ERROR_SEVERITIES so Sentry
// alert rules (defined once in PR-E) can fire across both layers.
export type EdgeSeverity = 'critical' | 'high' | 'medium' | 'low';

// Errors raised from inside a handler can carry classification by throwing
// this instead of a plain Error.
export class EdgeError extends Error {
  override name = 'EdgeError';
  readonly kind: string;
  readonly severity: EdgeSeverity;
  readonly status: number;
  readonly tags: Record<string, string>;
  readonly extra: Record<string, unknown>;

  constructor(opts: {
    kind: string;
    message: string;
    severity?: EdgeSeverity;
    status?: number;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }) {
    super(opts.message);
    this.kind = opts.kind;
    this.severity = opts.severity ?? 'high';
    this.status = opts.status ?? 500;
    this.tags = opts.tags ?? {};
    this.extra = opts.extra ?? {};
  }
}

export class ObservabilityContext {
  readonly request_id: string;
  readonly fn: string;
  user_id: string | null = null;
  // Free-form tags handlers can attach mid-request (e.g. step:auth → step:upstream).
  readonly tags: Record<string, string> = {};

  constructor(fn: string) {
    this.request_id = crypto.randomUUID();
    this.fn = fn;
  }
}

export type EdgeHandler = (req: Request, ctx: ObservabilityContext) => Promise<Response>;

interface WithObservabilityOptions {
  name: string;
}

export function withObservability(
  handler: EdgeHandler,
  options: WithObservabilityOptions
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const ctx = new ObservabilityContext(options.name);
    const start = performance.now();

    logEvent('info', 'request_start', ctx, {
      method: req.method,
      path: safePath(req.url),
    });

    try {
      const response = await handler(req, ctx);
      logEvent('info', 'request_complete', ctx, {
        status: response.status,
        duration_ms: Math.round(performance.now() - start),
      });
      return response;
    } catch (err) {
      const duration_ms = Math.round(performance.now() - start);
      logEvent('error', 'request_failed', ctx, {
        duration_ms,
        error_message: err instanceof Error ? err.message : String(err),
        error_name: err instanceof Error ? err.name : 'Unknown',
      });

      // Fire-and-forget Sentry capture. Don't await — we don't want a
      // slow Sentry endpoint to delay the client's 500 response.
      captureToSentry(err, ctx).catch((sentryErr) => {
        logEvent('error', 'sentry_capture_failed', ctx, {
          sentry_error: sentryErr instanceof Error ? sentryErr.message : String(sentryErr),
        });
      });

      const status = err instanceof EdgeError ? err.status : 500;
      const responseBody: Record<string, unknown> = {
        error: err instanceof EdgeError ? err.kind : 'internal_error',
        request_id: ctx.request_id,
      };
      return new Response(JSON.stringify(responseBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Single structured JSON line so `supabase functions logs --tail` is
// greppable. Note: logs are NOT scrubbed by sentry-scrubber — callers
// must never put PII (chat bodies, emails, photos) in `extra`. Use
// hashed identifiers if you need to correlate.
export function logEvent(
  level: LogLevel,
  msg: string,
  ctx: ObservabilityContext,
  extra?: Record<string, unknown>
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    fn: ctx.fn,
    request_id: ctx.request_id,
    user_id: ctx.user_id,
    ...(extra ?? {}),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

// --- Lazy Sentry init -----------------------------------------------------
// First failure of an instance pays the dynamic-import cost; subsequent
// failures hit the cached module. Functions that never throw never load it.

// deno-lint-ignore no-explicit-any
let sentryRef: any = null;
let sentryStatus: 'unknown' | 'ready' | 'unavailable' = 'unknown';

async function getSentry(): Promise<unknown> {
  if (sentryStatus === 'ready') return sentryRef;
  if (sentryStatus === 'unavailable') return null;

  const dsn = Deno.env.get('SENTRY_DSN_EDGE');
  if (!dsn) {
    sentryStatus = 'unavailable';
    return null;
  }

  try {
    // Dynamic import keeps cold-start fast for healthy requests.
    const Sentry = await import('https://esm.sh/@sentry/deno@8.40.0');
    Sentry.init({
      dsn,
      environment: Deno.env.get('SENTRY_ENV') ?? 'production',
      release: Deno.env.get('SENTRY_RELEASE') ?? undefined,
      // Edge tracing is OFF — Supabase already exposes per-fn latency
      // metrics. Re-enable here only if you need cross-service traces.
      tracesSampleRate: 0,
      // deno-lint-ignore no-explicit-any
      beforeSend: (event: any) => scrubSentryPayload(event),
      // deno-lint-ignore no-explicit-any
      beforeBreadcrumb: (b: any) => scrubSentryPayload(b),
    });
    sentryRef = Sentry;
    sentryStatus = 'ready';
    return Sentry;
  } catch (err) {
    // Don't loop forever if @sentry/deno is unreachable.
    sentryStatus = 'unavailable';
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: 'error',
        msg: 'sentry_init_failed',
        error_message: err instanceof Error ? err.message : String(err),
      })
    );
    return null;
  }
}

async function captureToSentry(err: unknown, ctx: ObservabilityContext): Promise<void> {
  const Sentry = (await getSentry()) as
    | {
        // deno-lint-ignore no-explicit-any
        withScope: (cb: (scope: any) => void) => void;
        captureException: (err: unknown) => void;
      }
    | null;
  if (!Sentry) return;

  const isEdge = err instanceof EdgeError;

  const tags: Record<string, string> = {
    layer: 'edge',
    fn: ctx.fn,
    severity: isEdge ? err.severity : 'high',
    ...(isEdge ? { kind: err.kind } : {}),
    ...ctx.tags,
    ...(isEdge ? err.tags : {}),
  };

  const baseExtra: Record<string, unknown> = {
    request_id: ctx.request_id,
    ...(ctx.user_id ? { user_id: ctx.user_id } : {}),
    ...(isEdge ? err.extra : {}),
  };

  const scrubbed = scrubSentryPayload(baseExtra) as Record<string, unknown>;
  if (isEdge) {
    scrubbed.runbook_url = runbookUrl(err.kind);
  }

  const fingerprint = [
    'edge',
    ctx.fn,
    isEdge ? err.kind : err instanceof Error ? err.name : 'unknown',
  ];

  Sentry.withScope((scope) => {
    scope.setTags(tags);
    scope.setExtras(scrubbed);
    scope.setFingerprint(fingerprint);
    Sentry.captureException(err);
  });
}
