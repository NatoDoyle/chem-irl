// Unit tests for the Bronto ingest helper (pure event building + the
// fail-open ship path with fetch stubbed).
//
// Run ad hoc (not part of CI):
//   deno test --allow-env supabase/functions/_shared/bronto.test.ts

import { assert, assertEquals, assertFalse, assertMatch } from 'jsr:@std/assert@1';
import { buildEvent, coerceLevel, rowLevel, shipEvents, toIsoUtc } from './bronto.ts';

// --- helpers ---------------------------------------------------------------

async function withEnv(
  vars: Record<string, string | null>,
  fn: () => void | Promise<void>
): Promise<void> {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(vars)) {
    saved.set(k, Deno.env.get(k));
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    await fn();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

interface FetchCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

function stubFetch(responder: () => Response) {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? init.body : '',
    });
    return Promise.resolve(responder());
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const CLEAN_ENV = {
  BRONTO_API_KEY: null,
  BRONTO_INGEST_URL: null,
  BRONTO_SERVICE: null,
  SENTRY_ENV: null,
} as const;

// --- buildEvent ------------------------------------------------------------

Deno.test('buildEvent: defaults (service, env, layer, level, status, timestamp)', async () => {
  await withEnv(CLEAN_ENV, () => {
    const e = buildEvent({ event: 'request_start' });
    assertEquals(e.service, 'chem-irl-app');
    assertEquals(e.env, 'production');
    assertEquals(e.layer, 'edge');
    assertEquals(e.event, 'request_start');
    assertEquals(e.level, 'info');
    assertEquals(e.status, 'ok');
    assert(typeof e.timestamp === 'string');
    assertFalse(Number.isNaN(Date.parse(e.timestamp as string)));
    assertFalse('fn' in e);
    assertFalse('request_id' in e);
    assertFalse('user_id' in e);
  });
});

Deno.test('buildEvent: BRONTO_SERVICE and SENTRY_ENV drive service/env fields', async () => {
  await withEnv({ ...CLEAN_ENV, BRONTO_SERVICE: 'custom-svc', SENTRY_ENV: 'staging' }, () => {
    const e = buildEvent({ event: 'x' });
    assertEquals(e.service, 'custom-svc');
    assertEquals(e.env, 'staging');
  });
});

Deno.test('buildEvent: status derives from level', async () => {
  await withEnv(CLEAN_ENV, () => {
    assertEquals(buildEvent({ event: 'x', level: 'error' }).status, 'error');
    assertEquals(buildEvent({ event: 'x', level: 'warn' }).status, 'warn');
    assertEquals(buildEvent({ event: 'x', level: 'info' }).status, 'ok');
    assertEquals(buildEvent({ event: 'x', level: 'debug' }).status, 'ok');
  });
});

Deno.test('buildEvent: reserved keys cannot be clobbered by extra', async () => {
  await withEnv(CLEAN_ENV, () => {
    const e = buildEvent({
      event: 'real_event',
      level: 'warn',
      extra: {
        service: 'evil',
        env: 'evil',
        layer: 'evil',
        event: 'evil',
        level: 'evil',
        status: 'evil',
        detail: 'kept',
      },
    });
    assertEquals(e.service, 'chem-irl-app');
    assertEquals(e.env, 'production');
    assertEquals(e.layer, 'edge');
    assertEquals(e.event, 'real_event');
    assertEquals(e.level, 'warn');
    assertEquals(e.status, 'warn');
    assertEquals(e.detail, 'kept');
  });
});

Deno.test('buildEvent: extras are scrubbed (email key dropped, email value hashed, photo masked)', async () => {
  await withEnv(CLEAN_ENV, () => {
    const e = buildEvent({
      event: 'x',
      extra: {
        email: 'x@y.com',
        contact: 'reach me at foo@bar.com',
        photo_url: 'https://cdn.example.com/p.jpg',
        meta: { count: 2 },
      },
    });
    assertFalse('email' in e);
    assertMatch(e.contact as string, /^reach me at <email:[0-9a-f]{6}>$/);
    assertEquals(e.photo_url, '<scrubbed:photo>');
    assertEquals((e.meta as Record<string, unknown>).count, 2);
  });
});

Deno.test('buildEvent: identifiers included when provided, user_id omitted when null', async () => {
  await withEnv(CLEAN_ENV, () => {
    const withIds = buildEvent({
      event: 'x',
      fn: 'validate-receipt',
      request_id: 'req-1',
      user_id: 'user-1',
      layer: 'db',
    });
    assertEquals(withIds.fn, 'validate-receipt');
    assertEquals(withIds.request_id, 'req-1');
    assertEquals(withIds.user_id, 'user-1');
    assertEquals(withIds.layer, 'db');

    const nullUser = buildEvent({ event: 'x', user_id: null });
    assertFalse('user_id' in nullUser);
  });
});

Deno.test('buildEvent: explicit timestamp is used verbatim', async () => {
  await withEnv(CLEAN_ENV, () => {
    const e = buildEvent({ event: 'x', timestamp: '2026-07-01T00:00:00.000Z' });
    assertEquals(e.timestamp, '2026-07-01T00:00:00.000Z');
  });
});

// --- toIsoUtc ----------------------------------------------------------------

Deno.test('toIsoUtc: normalizes PostgREST timestamp formats to ISO-8601 Z', () => {
  // PostgREST offset format (microseconds + +00:00) — the shape Bronto
  // failed to index as event time.
  assertEquals(toIsoUtc('2026-06-12T14:21:59.237561+00:00'), '2026-06-12T14:21:59.237Z');
  // Plain Postgres text format.
  assertEquals(toIsoUtc('2026-06-12 14:21:59+00'), '2026-06-12T14:21:59.000Z');
  // Non-UTC offset converts to UTC.
  assertEquals(toIsoUtc('2026-06-12T15:21:59+01:00'), '2026-06-12T14:21:59.000Z');
  // Already-normalized input is a fixpoint.
  assertEquals(toIsoUtc('2026-07-09T20:12:00.974Z'), '2026-07-09T20:12:00.974Z');
});

Deno.test('toIsoUtc: unparseable input falls back to the raw string', () => {
  assertEquals(toIsoUtc('not-a-date'), 'not-a-date');
  assertEquals(toIsoUtc(null), 'null');
  assertEquals(toIsoUtc(12345), new Date(12345).toISOString());
});

// --- coerceLevel -------------------------------------------------------------

Deno.test('coerceLevel: passes through each valid BrontoLevel', () => {
  assertEquals(coerceLevel('debug'), 'debug');
  assertEquals(coerceLevel('info'), 'info');
  assertEquals(coerceLevel('warn'), 'warn');
  assertEquals(coerceLevel('error'), 'error');
});

Deno.test('coerceLevel: rejects unknown strings (no case folding, no severity names)', () => {
  assertEquals(coerceLevel('ERROR'), undefined);
  assertEquals(coerceLevel('warning'), undefined);
  assertEquals(coerceLevel('critical'), undefined);
  assertEquals(coerceLevel(''), undefined);
});

Deno.test('coerceLevel: rejects non-string values', () => {
  assertEquals(coerceLevel(undefined), undefined);
  assertEquals(coerceLevel(null), undefined);
  assertEquals(coerceLevel(3), undefined);
  assertEquals(coerceLevel({ level: 'error' }), undefined);
  assertEquals(coerceLevel(['error']), undefined);
});

// --- rowLevel ----------------------------------------------------------------

Deno.test('rowLevel: levelFromStatus maps row.status error/ok', () => {
  const spec = { levelFromStatus: true };
  assertEquals(rowLevel(spec, { status: 'error' }, {}), 'error');
  assertEquals(rowLevel(spec, { status: 'ok' }, {}), 'info');
  assertEquals(rowLevel(spec, {}, {}), 'info');
});

Deno.test('rowLevel: levelFromPayload honors a valid payload.level', () => {
  const spec = { levelFromPayload: true };
  assertEquals(rowLevel(spec, {}, { level: 'error' }), 'error');
  assertEquals(rowLevel(spec, {}, { level: 'warn' }), 'warn');
  assertEquals(rowLevel(spec, {}, { level: 'info' }), 'info');
});

Deno.test('rowLevel: levelFromPayload falls back to info on missing/invalid level', () => {
  const spec = { levelFromPayload: true };
  assertEquals(rowLevel(spec, {}, {}), 'info');
  assertEquals(rowLevel(spec, {}, { level: 'critical' }), 'info');
  assertEquals(rowLevel(spec, {}, { level: 3 }), 'info');
});

Deno.test('rowLevel: sources that opt into neither flag are always info', () => {
  // A scoring_events payload must not be able to elevate its own level.
  assertEquals(rowLevel({}, { status: 'error' }, { level: 'error' }), 'info');
});

// --- shipEvents ------------------------------------------------------------

Deno.test('shipEvents: empty batch returns true without fetching', async () => {
  const stub = stubFetch(() => new Response('ok'));
  try {
    await withEnv({ ...CLEAN_ENV, BRONTO_API_KEY: 'k' }, async () => {
      assert(await shipEvents([]));
      assertEquals(stub.calls.length, 0);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('shipEvents: missing BRONTO_API_KEY skips silently and returns true', async () => {
  const stub = stubFetch(() => new Response('ok'));
  try {
    await withEnv(CLEAN_ENV, async () => {
      assert(await shipEvents([{ event: 'x' }]));
      assertEquals(stub.calls.length, 0);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('shipEvents: POSTs NDJSON with the Bronto headers and returns true on 2xx', async () => {
  const stub = stubFetch(() => new Response('ok', { status: 200 }));
  try {
    await withEnv({ ...CLEAN_ENV, BRONTO_API_KEY: 'test-key' }, async () => {
      const ok = await shipEvents([{ event: 'a', n: 1 }, { event: 'b', n: 2 }]);
      assert(ok);
      assertEquals(stub.calls.length, 1);
      const call = stub.calls[0];
      assertEquals(call.url, 'https://ingestion.eu.bronto.io');
      assertEquals(call.method, 'POST');
      assertEquals(call.headers['x-bronto-api-key'], 'test-key');
      assertEquals(call.headers['x-bronto-service-name'], 'chem-irl-app');
      assertEquals(call.headers['content-type'], 'application/json');
      const lines = call.body.split('\n');
      assertEquals(lines.length, 2);
      assertEquals(JSON.parse(lines[0]).event, 'a');
      assertEquals(JSON.parse(lines[1]).n, 2);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('shipEvents: BRONTO_INGEST_URL and BRONTO_SERVICE overrides are respected', async () => {
  const stub = stubFetch(() => new Response('ok'));
  try {
    await withEnv(
      {
        ...CLEAN_ENV,
        BRONTO_API_KEY: 'k',
        BRONTO_INGEST_URL: 'https://ingest.example.test',
        BRONTO_SERVICE: 'other-svc',
      },
      async () => {
        assert(await shipEvents([{ event: 'x' }]));
        assertEquals(stub.calls[0].url, 'https://ingest.example.test');
        assertEquals(stub.calls[0].headers['x-bronto-service-name'], 'other-svc');
      }
    );
  } finally {
    stub.restore();
  }
});

Deno.test('shipEvents: non-2xx response returns false without throwing', async () => {
  const stub = stubFetch(() => new Response('nope', { status: 500 }));
  try {
    await withEnv({ ...CLEAN_ENV, BRONTO_API_KEY: 'k' }, async () => {
      assertFalse(await shipEvents([{ event: 'x' }]));
    });
  } finally {
    stub.restore();
  }
});

Deno.test('shipEvents: network failure returns false without throwing', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new TypeError('connection refused'))) as typeof fetch;
  try {
    await withEnv({ ...CLEAN_ENV, BRONTO_API_KEY: 'k' }, async () => {
      assertFalse(await shipEvents([{ event: 'x' }]));
    });
  } finally {
    globalThis.fetch = original;
  }
});
