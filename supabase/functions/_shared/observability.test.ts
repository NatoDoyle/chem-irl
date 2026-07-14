// Behavior tests for the withObservability → Bronto buffering integration:
// one NDJSON POST per request carrying request_start/request_complete (or
// request_failed) plus any handler logEvent calls, user_id stamped at flush,
// OPTIONS preflights excluded, and no ship at all without BRONTO_API_KEY.
//
// Run ad hoc (not part of CI):
//   deno test --allow-env supabase/functions/_shared/observability.test.ts

import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1';
import { EdgeError, type EdgeHandler, logEvent, withObservability } from './observability.ts';

// --- helpers (mirrors bronto.test.ts) ---------------------------------------

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
  headers: Record<string, string>;
  body: string;
}

function stubFetch() {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: typeof init?.body === 'string' ? init.body : '',
    });
    return Promise.resolve(new Response('ok', { status: 200 }));
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

async function waitFor(cond: () => boolean, ms = 1000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 10));
  }
}

function parseBatch(body: string): Record<string, unknown>[] {
  return body.split('\n').map((line) => JSON.parse(line));
}

const TEST_ENV = {
  BRONTO_API_KEY: 'test-key',
  BRONTO_INGEST_URL: null,
  BRONTO_SERVICE: null,
  SENTRY_ENV: null,
} as const;

// --- tests -------------------------------------------------------------------

Deno.test('withObservability: one batch per request with request_start + request_complete', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = (_req, _ctx) =>
        Promise.resolve(new Response('done', { status: 200 }));
      const wrapped = withObservability(handler, { name: 'test-fn' });

      const res = await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));
      assertEquals(res.status, 200);

      await waitFor(() => stub.calls.length === 1);
      const events = parseBatch(stub.calls[0].body);
      assertEquals(events.length, 2);
      assertEquals(events[0].event, 'request_start');
      assertEquals(events[0].fn, 'test-fn');
      assertEquals(events[0].layer, 'edge');
      assertEquals(events[0].service, 'chem-irl-app');
      assertEquals(events[1].event, 'request_complete');
      assertEquals(events[1].status, 'ok');
      assert(typeof events[1].duration_ms === 'number');
      // Both events share the request's correlation id.
      assert(typeof events[0].request_id === 'string');
      assertEquals(events[0].request_id, events[1].request_id);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: handler logEvent calls join the same batch', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = (_req, ctx) => {
        logEvent('warn', 'platform_forward', ctx, { target: 'photo_platform' });
        return Promise.resolve(new Response('ok'));
      };
      const wrapped = withObservability(handler, { name: 'test-fn' });
      await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));

      await waitFor(() => stub.calls.length === 1);
      const events = parseBatch(stub.calls[0].body);
      assertEquals(events.length, 3);
      assertEquals(events[1].event, 'platform_forward');
      assertEquals(events[1].level, 'warn');
      assertEquals(events[1].status, 'warn');
      assertEquals(events[1].target, 'photo_platform');
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: user_id set mid-handler is stamped onto earlier events', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = (_req, ctx) => {
        ctx.user_id = 'user-123';
        return Promise.resolve(new Response('ok'));
      };
      const wrapped = withObservability(handler, { name: 'test-fn' });
      await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));

      await waitFor(() => stub.calls.length === 1);
      const events = parseBatch(stub.calls[0].body);
      for (const e of events) assertEquals(e.user_id, 'user-123');
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: thrown error still flushes (request_failed) and returns 500', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = () => Promise.reject(new Error('boom'));
      const wrapped = withObservability(handler, { name: 'test-fn' });
      const res = await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));
      assertEquals(res.status, 500);

      await waitFor(() => stub.calls.length === 1);
      const events = parseBatch(stub.calls[0].body);
      const failed = events.find((e) => e.event === 'request_failed');
      assert(failed, 'request_failed event missing from batch');
      assertEquals(failed.level, 'error');
      assertEquals(failed.status, 'error');
      assertEquals(failed.error_message, 'boom');
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: EdgeError classification lands on request_failed', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = () =>
        Promise.reject(
          new EdgeError({
            kind: 'iap.receipt_invalid',
            message: 'bad receipt',
            severity: 'medium',
            status: 422,
            tags: { step: 'verify' },
            extra: { platform_hint: 'ios' },
          })
        );
      const wrapped = withObservability(handler, { name: 'test-fn' });
      const res = await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));
      assertEquals(res.status, 422);

      await waitFor(() => stub.calls.length === 1);
      const events = parseBatch(stub.calls[0].body);
      const failed = events.find((e) => e.event === 'request_failed');
      assert(failed, 'request_failed event missing from batch');
      assertEquals(failed.kind, 'iap.receipt_invalid');
      assertEquals(failed.severity, 'medium');
      assertEquals(failed.http_status, 422);
      assertEquals(failed.step, 'verify');
      assertEquals(failed.platform_hint, 'ios');
      assert(
        String(failed.runbook_url).endsWith('/docs/runbooks/iap.receipt_invalid.md'),
        `unexpected runbook_url: ${failed.runbook_url}`
      );
      // Reserved event fields must win over EdgeError tags/extra.
      assertEquals(failed.level, 'error');
      assertEquals(failed.status, 'error');
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: plain Error defaults to severity high, no kind', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = () => Promise.reject(new Error('boom'));
      const wrapped = withObservability(handler, { name: 'test-fn' });
      const res = await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));
      assertEquals(res.status, 500);

      await waitFor(() => stub.calls.length === 1);
      const events = parseBatch(stub.calls[0].body);
      const failed = events.find((e) => e.event === 'request_failed');
      assert(failed, 'request_failed event missing from batch');
      assertEquals(failed.severity, 'high');
      assertEquals(failed.http_status, 500);
      assertFalse('kind' in failed);
      assertFalse('runbook_url' in failed);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: OPTIONS preflights are not shipped', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = () => Promise.resolve(new Response(null, { status: 204 }));
      const wrapped = withObservability(handler, { name: 'test-fn' });
      await wrapped(new Request('https://x.test/test-fn', { method: 'OPTIONS' }));

      await new Promise((r) => setTimeout(r, 100));
      assertEquals(stub.calls.length, 0);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: no BRONTO_API_KEY → no fetch, request unaffected', async () => {
  const stub = stubFetch();
  try {
    await withEnv({ ...TEST_ENV, BRONTO_API_KEY: null }, async () => {
      const handler: EdgeHandler = () => Promise.resolve(new Response('ok'));
      const wrapped = withObservability(handler, { name: 'test-fn' });
      const res = await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));
      assertEquals(res.status, 200);

      await new Promise((r) => setTimeout(r, 100));
      assertEquals(stub.calls.length, 0);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: bronto_suppress tag drops the whole request from Bronto', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = (_req, ctx) => {
        logEvent('info', 'idle_heartbeat', ctx);
        ctx.tags.bronto_suppress = '1';
        return Promise.resolve(new Response('ok'));
      };
      const wrapped = withObservability(handler, { name: 'test-fn' });
      const res = await wrapped(new Request('https://x.test/test-fn', { method: 'POST' }));
      assertEquals(res.status, 200);

      await new Promise((r) => setTimeout(r, 100));
      assertEquals(stub.calls.length, 0);
    });
  } finally {
    stub.restore();
  }
});

Deno.test('withObservability: second request gets its own batch (buffer does not leak)', async () => {
  const stub = stubFetch();
  try {
    await withEnv(TEST_ENV, async () => {
      const handler: EdgeHandler = () => Promise.resolve(new Response('ok'));
      const wrapped = withObservability(handler, { name: 'test-fn' });
      await wrapped(new Request('https://x.test/a', { method: 'POST' }));
      await wrapped(new Request('https://x.test/b', { method: 'POST' }));

      await waitFor(() => stub.calls.length === 2);
      const first = parseBatch(stub.calls[0].body);
      const second = parseBatch(stub.calls[1].body);
      assertEquals(first.length, 2);
      assertEquals(second.length, 2);
      assertFalse(first[0].request_id === second[0].request_id);
    });
  } finally {
    stub.restore();
  }
});
