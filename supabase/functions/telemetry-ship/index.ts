// Supabase Edge Function: telemetry-ship
//
// Drains DB event tables to Bronto (service chem-irl-app) in batches —
// this is how mobile client analytics (analytics_events, layer 'mobile')
// and DB-side domain/ops events (scoring_events / ops_events, layer 'db')
// reach the unified event stream without any client changes.
//
// Trigger: a minutely pg_cron job POSTs here via pg_net (see migration
// 20260709194434_telemetry_ship_pipeline.sql). Like `push` and
// `waitlist-nudge`, JWT verification is disabled and the caller
// authenticates with the x-webhook-secret header (TELEMETRY_SHIP_SECRET;
// the same value lives in Vault as telemetry_ship_secret for the cron job).
//
// Delivery semantics: AT-LEAST-ONCE. Per source, rows newer than the
// cursor are read in (created_at, id) keyset order (capped at BATCH_LIMIT,
// minus a 60s watermark against commit skew), shipped as one NDJSON POST,
// and only on ship success is the cursor advanced — with a compare-and-swap
// on the previous cursor value so an overlapping run can't double-advance.
// A crash between ship and advance re-ships the batch next minute;
// consumers dedupe on `source` + `source_id`. Cursors seeded at epoch mean
// the first runs drain all history (backfill): loop
//   curl -X POST .../telemetry-ship -H "x-webhook-secret: $SECRET"
// until the response reports done: true.
//
// Strictly fail-open: any failure holds position and responds 200 so the
// cron caller never sees noise; the backlog drains when Bronto recovers.
// Idle minutes suppress their own Bronto request events (bronto_suppress).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  type BrontoLayer,
  buildEvent,
  rowLevel,
  shipEvents,
  toIsoUtc,
} from '../_shared/bronto.ts';
import { type EdgeHandler, logEvent, withObservability } from '../_shared/observability.ts';

const BATCH_LIMIT = 500; // rows per source per run
const SAFETY_LAG_MS = 60_000; // skip rows younger than this (commit skew)
const SHIP_TIMEOUT_MS = 10_000;

interface SourceSpec {
  idColumn: string;
  layer: BrontoLayer;
  eventColumn: string;
  payloadColumn: string;
  hasUserId: boolean;
  // ops_events rows carry their own ok/error status.
  levelFromStatus?: boolean;
  // analytics_events rows may carry an explicit `level` in their payload
  // (mobile client errors ship as warn/error so appwatch alerting sees
  // them). Invalid/missing values fall back to info — see rowLevel.
  levelFromPayload?: boolean;
  // High-volume noise rows excluded in-query (e.g. ~20 feed_impression
  // rows per discovery-feed call).
  excludeEvents?: readonly string[];
}

// Which cursor rows this function knows how to drain. The cursor TABLE
// drives what actually runs — a cursor row without a spec is skipped with
// a warning, and a spec without a cursor row does nothing (that's how the
// ops_events source activates via a later migration, order-independent).
const SOURCES: Record<string, SourceSpec> = {
  analytics_events: {
    idColumn: 'id',
    layer: 'mobile',
    eventColumn: 'event',
    payloadColumn: 'properties',
    hasUserId: true,
    levelFromPayload: true,
  },
  scoring_events: {
    idColumn: 'event_id',
    layer: 'db',
    eventColumn: 'event_type',
    payloadColumn: 'payload',
    hasUserId: true,
    excludeEvents: ['feed_impression'],
  },
  ops_events: {
    idColumn: 'id',
    layer: 'db',
    eventColumn: 'event',
    payloadColumn: 'payload',
    hasUserId: false,
    levelFromStatus: true,
  },
};

interface CursorRow {
  source: string;
  last_created_at: string;
  last_id: string;
}

interface DrainResult {
  shipped: number;
  more: boolean;
  ok: boolean;
}

const handler: EdgeHandler = async (req, ctx) => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const secret = Deno.env.get('TELEMETRY_SHIP_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    logEvent('warn', 'ship_unauthorized', ctx);
    return json({ error: 'unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('telemetry-ship: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return json({ error: 'server_misconfigured' }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: cursors, error: curErr } = await admin
    .from('telemetry_ship_cursors')
    .select('source, last_created_at, last_id');
  if (curErr || !cursors) {
    logEvent('error', 'ship_cursors_read_failed', ctx, { message: curErr?.message });
    // 200 on purpose: the minutely cron caller should never see failures
    // for a self-healing condition (e.g. migration not applied yet).
    return json({ ok: false, error: 'cursors_unavailable' }, 200);
  }

  const shipped: Record<string, number> = {};
  let anyFailure = false;
  let more = false;

  for (const cur of cursors as CursorRow[]) {
    const spec = SOURCES[cur.source];
    if (!spec) {
      logEvent('warn', 'ship_unknown_source', ctx, { source: cur.source });
      continue;
    }
    const res = await drainSource(admin, ctx, cur, spec);
    shipped[cur.source] = res.shipped;
    if (!res.ok) anyFailure = true;
    if (res.more) more = true;
  }

  const total = Object.values(shipped).reduce((a, b) => a + b, 0);
  if (total > 0 || anyFailure) {
    logEvent(anyFailure ? 'warn' : 'info', 'ship_batch', ctx, {
      ...shipped,
      total,
      done: !more,
    });
  } else {
    // Idle minute: console logs stay; nothing ships to Bronto (see
    // flushToBronto in _shared/observability.ts).
    ctx.tags.bronto_suppress = '1';
  }

  return json({ ok: !anyFailure, shipped, done: !more }, 200);
};

serve(withObservability(handler, { name: 'telemetry-ship' }));

// --- Drain one source --------------------------------------------------------

async function drainSource(
  // deno-lint-ignore no-explicit-any
  admin: any,
  ctx: Parameters<EdgeHandler>[1],
  cur: CursorRow,
  spec: SourceSpec,
): Promise<DrainResult> {
  const watermark = new Date(Date.now() - SAFETY_LAG_MS).toISOString();

  // Keyset walk: strictly after (last_created_at, last_id), tuple
  // comparison emulated for PostgREST. The id filter literal is cast by
  // PostgREST to the column's type (uuid or bigint).
  let query = admin
    .from(cur.source)
    .select('*')
    .or(
      `created_at.gt.${cur.last_created_at},` +
        `and(created_at.eq.${cur.last_created_at},${spec.idColumn}.gt.${cur.last_id})`,
    )
    .lte('created_at', watermark);
  for (const excluded of spec.excludeEvents ?? []) {
    query = query.neq(spec.eventColumn, excluded);
  }
  const { data: rows, error } = await query
    .order('created_at', { ascending: true })
    .order(spec.idColumn, { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    // Also the expected path while the source's table doesn't exist yet
    // (cursor row seeded by a migration ahead of the table's).
    logEvent('warn', 'ship_source_read_failed', ctx, {
      source: cur.source,
      message: error.message,
    });
    return { shipped: 0, more: false, ok: false };
  }
  if (!rows || rows.length === 0) {
    return { shipped: 0, more: false, ok: true };
  }

  const events = rows.map((row: Record<string, unknown>) => rowToEvent(cur.source, spec, row));
  const shippedOk = await shipEvents(events, { timeoutMs: SHIP_TIMEOUT_MS });
  if (!shippedOk) {
    // Cursor holds position — the batch re-ships next run (at-least-once).
    logEvent('warn', 'ship_batch_failed', ctx, { source: cur.source, count: rows.length });
    return { shipped: 0, more: false, ok: false };
  }

  const last = rows[rows.length - 1] as Record<string, unknown>;
  const { data: updated, error: casErr } = await admin
    .from('telemetry_ship_cursors')
    .update({
      last_created_at: last.created_at,
      last_id: String(last[spec.idColumn]),
      updated_at: new Date().toISOString(),
    })
    .eq('source', cur.source)
    .eq('last_created_at', cur.last_created_at)
    .eq('last_id', cur.last_id)
    .select('source');

  if (casErr) {
    logEvent('warn', 'ship_cursor_update_failed', ctx, {
      source: cur.source,
      message: casErr.message,
    });
    return { shipped: rows.length, more: false, ok: false };
  }
  if (!updated || updated.length === 0) {
    // A concurrent run advanced this cursor first; our batch was a
    // duplicate ship (consumers dedupe on source + source_id).
    logEvent('warn', 'ship_cursor_conflict', ctx, { source: cur.source });
    return { shipped: rows.length, more: false, ok: true };
  }

  return { shipped: rows.length, more: rows.length === BATCH_LIMIT, ok: true };
}

// --- Row -> Bronto event ------------------------------------------------------

function rowToEvent(
  source: string,
  spec: SourceSpec,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const payload =
    row[spec.payloadColumn] && typeof row[spec.payloadColumn] === 'object'
      ? (row[spec.payloadColumn] as Record<string, unknown>)
      : {};

  return buildEvent({
    event: String(row[spec.eventColumn] ?? 'unknown'),
    level: rowLevel(spec, row, payload),
    layer: spec.layer,
    // The event's time is when it HAPPENED (row insert), not when it
    // shipped. Bronto's @time index is arrival regardless (verified
    // 2026-07-10) — origin time is queryable via this field.
    timestamp: toIsoUtc(row.created_at),
    user_id: spec.hasUserId && typeof row.user_id === 'string' ? row.user_id : null,
    extra: {
      ...payload,
      // analytics_events carries the client platform (ios/android).
      ...(typeof row.platform === 'string' ? { platform: row.platform } : {}),
      source,
      source_id: String(row[spec.idColumn]),
      shipped_at: new Date().toISOString(),
    },
  });
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
