// Bronto ingest helper — the app-wide "what happened, when, how, where"
// event stream (service/dataset: chem-irl-app), additive to Sentry.
//
// Ingest mechanics follow the org convention established by the CMO/CSO
// agents and .github/workflows/blog-sync.yml:
//   POST $BRONTO_INGEST_URL (default https://ingestion.eu.bronto.io)
//   headers: x-bronto-api-key, x-bronto-service-name, Content-Type
//   body: NDJSON (one JSON object per line)
//
// Strictly fail-open: BRONTO_API_KEY unset → silent skip; Bronto outage →
// bounded timeout, one structured console.error line, never a thrown error.
// Nothing user-facing may ever break because of telemetry.
//
// Every event is scrubbed with the shared PII rules before it leaves the
// process. Reserved fields are spread last so caller extras can't clobber
// them.

import { scrubSentryPayload } from './sentry-scrubber.ts';

const DEFAULT_INGEST_URL = 'https://ingestion.eu.bronto.io';
const DEFAULT_SERVICE = 'chem-irl-app';
const SHIP_TIMEOUT_MS = 2000;

export type BrontoLayer = 'edge' | 'db' | 'mobile' | 'ci';
export type BrontoLevel = 'debug' | 'info' | 'warn' | 'error';
export type BrontoStatus = 'ok' | 'warn' | 'error';

function serviceName(): string {
  return Deno.env.get('BRONTO_SERVICE') ?? DEFAULT_SERVICE;
}

function statusForLevel(level: BrontoLevel): BrontoStatus {
  if (level === 'error') return 'error';
  if (level === 'warn') return 'warn';
  return 'ok';
}

export function buildEvent(args: {
  event: string;
  level?: BrontoLevel;
  layer?: BrontoLayer;
  fn?: string;
  request_id?: string;
  user_id?: string | null;
  timestamp?: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const level = args.level ?? 'info';
  return scrubSentryPayload({
    ...(args.extra ?? {}),
    timestamp: args.timestamp ?? new Date().toISOString(),
    service: serviceName(),
    env: Deno.env.get('SENTRY_ENV') ?? 'production',
    layer: args.layer ?? 'edge',
    ...(args.fn ? { fn: args.fn } : {}),
    event: args.event,
    level,
    status: statusForLevel(level),
    ...(args.request_id ? { request_id: args.request_id } : {}),
    ...(args.user_id ? { user_id: args.user_id } : {}),
  }) as Record<string, unknown>;
}

// Ships a batch as one NDJSON POST. Never throws. Returns false on any
// failure so callers that need delivery guarantees (telemetry-ship's
// cursor) can hold position; fire-and-forget callers just ignore it.
export async function shipEvents(
  events: Record<string, unknown>[],
  opts?: { timeoutMs?: number }
): Promise<boolean> {
  if (events.length === 0) return true;
  const apiKey = Deno.env.get('BRONTO_API_KEY');
  if (!apiKey) return true;

  try {
    const res = await fetch(Deno.env.get('BRONTO_INGEST_URL') ?? DEFAULT_INGEST_URL, {
      method: 'POST',
      headers: {
        'x-bronto-api-key': apiKey,
        'x-bronto-service-name': serviceName(),
        'Content-Type': 'application/json',
      },
      body: events.map((e) => JSON.stringify(e)).join('\n'),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? SHIP_TIMEOUT_MS),
    });
    res.body?.cancel().catch(() => {});
    if (!res.ok) {
      logShipFailure({ http_status: res.status, count: events.length });
      return false;
    }
    return true;
  } catch (err) {
    logShipFailure({
      error_message: err instanceof Error ? err.message : String(err),
      count: events.length,
    });
    return false;
  }
}

function logShipFailure(extra: Record<string, unknown>): void {
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      msg: 'bronto_ship_failed',
      ...extra,
    })
  );
}
