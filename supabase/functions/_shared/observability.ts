// Shared observability wrapper for Supabase edge functions.
//
// Goal: every edge-function failure produces (a) a structured JSON log line
// in `supabase functions logs` greppable by `request_id` / `fn` / `user_id`,
// and (b) a Bronto request_failed event tagged with kind / severity /
// http_status, scrubbed of PII and linked to the on-disk runbook for that
// kind. (Bronto is the sole telemetry platform — the inert Sentry seam was
// removed 2026-07-13; it never had a DSN.)
//
// Wraps a handler and:
//   - generates a per-request UUID
//   - logs request_start / request_complete / request_failed and mirrors
//     every line into one background Bronto POST per request
//   - catches unhandled errors and returns a generic 500 to the client
//     (with the request_id so support can correlate)
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
// to control the response status, the Bronto `kind`/`severity` fields,
// and the runbook URL. Plain `Error` works too — it lands as
// `severity:high`, `http_status:500`, no kind.

import { runbookUrl } from './runbook-url.ts';
import { buildEvent, shipEvents } from './bronto.ts';

// Severity matches mobile/src/lib/errors.ts ERROR_SEVERITIES so error
// events group consistently across layers in Bronto.
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
  // Bronto events buffered by logEvent; flushed once per request (see
  // flushToBronto) so telemetry costs at most one background POST.
  readonly pending: Record<string, unknown>[] = [];

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
      flushToBronto(ctx, req);
      return response;
    } catch (err) {
      const duration_ms = Math.round(performance.now() - start);
      const isEdge = err instanceof EdgeError;
      const status = isEdge ? err.status : 500;

      // The full classification rides on request_failed so Bronto (and
      // appwatch alerting) see kind/severity/runbook without any second
      // sink. EdgeError tags/extra spread first — computed keys must win
      // (reserved-key rule; and `status`/`level` are owned by buildEvent).
      logEvent('error', 'request_failed', ctx, {
        ...(isEdge ? err.tags : {}),
        ...(isEdge ? err.extra : {}),
        duration_ms,
        error_message: err instanceof Error ? err.message : String(err),
        error_name: err instanceof Error ? err.name : 'Unknown',
        severity: isEdge ? err.severity : 'high',
        http_status: status,
        ...(isEdge ? { kind: err.kind, runbook_url: runbookUrl(err.kind) } : {}),
      });

      flushToBronto(ctx, req);

      const responseBody: Record<string, unknown> = {
        error: isEdge ? err.kind : 'internal_error',
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

// One background NDJSON POST per request carrying everything logEvent
// buffered (request_start/complete/failed + handler events). user_id is
// stamped at flush so events logged pre-auth still correlate. Fail-open
// and never awaited on the request path; EdgeRuntime.waitUntil (when the
// runtime provides it) keeps the isolate alive until the POST settles.
// OPTIONS preflights are dropped as noise, as is any request whose handler
// set ctx.tags.bronto_suppress = '1' (heartbeat endpoints like
// telemetry-ship's idle minutes — console logs stay, nothing ships).
function flushToBronto(ctx: ObservabilityContext, req: Request): void {
  if (req.method === 'OPTIONS' || ctx.tags.bronto_suppress === '1') {
    ctx.pending.length = 0;
    return;
  }
  if (ctx.pending.length === 0) return;
  for (const e of ctx.pending) {
    if (ctx.user_id && e.user_id === undefined) e.user_id = ctx.user_id;
  }
  const flush = shipEvents(ctx.pending.splice(0)).catch(() => {});
  const runtime = (
    globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }
  ).EdgeRuntime;
  try {
    runtime?.waitUntil?.(flush);
  } catch {
    // waitUntil can throw outside a request scope; the flush promise is
    // already running regardless.
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

  // Mirror the line into the per-request Bronto buffer (scrubbed there;
  // shipped once per request by flushToBronto).
  ctx.pending.push(
    buildEvent({
      event: msg,
      level,
      fn: ctx.fn,
      request_id: ctx.request_id,
      user_id: ctx.user_id,
      extra,
    })
  );
}
