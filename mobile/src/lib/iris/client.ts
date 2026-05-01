// Iris client: streaming consumer for the iris-chat edge function plus
// a simple finalize wrapper.
//
// The Supabase JS client's functions.invoke() does not expose the
// streaming response body, so we call the function URL directly with
// fetch and parse Anthropic-style SSE ourselves.
//
// Auth uses the same access token Supabase issued to the current
// session — no separate API key needed.

import { supabase } from '../supabase/client';
import {
  type IrisOp,
  type IrisStreamEvent,
  type IrisSurface,
  IRIS_OPS,
} from './types';

const FUNCTION_NAME = 'iris-chat';

interface StreamTurnArgs {
  surface: IrisSurface;
  message: string;
  conversationId?: string;
  matchId?: string;
  signal?: AbortSignal;
}

/**
 * Stream a single turn from Iris. Yields parsed events until the upstream
 * stream closes. Caller is responsible for awaiting completion if they
 * want to know when the stream is fully drained.
 */
export async function* streamIrisTurn(args: StreamTurnArgs): AsyncGenerator<IrisStreamEvent> {
  const url = await resolveFunctionUrl(FUNCTION_NAME);
  const accessToken = await resolveAccessToken();

  const body: Record<string, unknown> = {
    op: IRIS_OPS.Turn,
    surface: args.surface,
    message: args.message,
  };
  if (args.conversationId) body.conversation_id = args.conversationId;
  if (args.matchId) body.match_id = args.matchId;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
    signal: args.signal,
  });

  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new IrisError(
      typeof errorPayload?.error === 'string' ? errorPayload.error : 'iris_chat_failed',
      response.status,
      errorPayload,
    );
  }

  const conversationId = response.headers.get('x-iris-conversation-id') ?? args.conversationId ?? '';

  const body$ = response.body;
  if (!body$) {
    throw new IrisError('no_response_body', response.status);
  }

  const reader = body$.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Track in-flight tool_use blocks while we accumulate input_json_delta
  // chunks. content_block_index → { name, accumulatedJson }.
  const toolBlocks = new Map<number, { name: string; json: string }>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE separates events by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = parseSseBlock(block);
        if (!event) continue;

        for (const out of interpretAnthropicEvent(event, toolBlocks)) {
          yield out;
        }
      }
    }
    // Drain any final event left without a trailing blank line.
    if (buffer.trim().length > 0) {
      const event = parseSseBlock(buffer);
      if (event) {
        for (const out of interpretAnthropicEvent(event, toolBlocks)) {
          yield out;
        }
      }
    }
  } finally {
    yield { type: 'done', conversationId };
  }
}

/**
 * Run the finalize / extraction pass on a completed conversation. Marks
 * the conversation status='completed' server-side and returns the memory
 * patch (or null if the model didn't emit one).
 */
export async function finalizeIris(conversationId: string): Promise<Record<string, unknown> | null> {
  const url = await resolveFunctionUrl(FUNCTION_NAME);
  const accessToken = await resolveAccessToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      op: IRIS_OPS.Finalize as IrisOp,
      conversation_id: conversationId,
    }),
  });

  if (!response.ok) {
    const errorPayload = await safeJson(response);
    throw new IrisError(
      typeof errorPayload?.error === 'string' ? errorPayload.error : 'iris_finalize_failed',
      response.status,
      errorPayload,
    );
  }

  const json = (await response.json()) as { ok?: boolean; patch?: Record<string, unknown> | null };
  return json.patch ?? null;
}

// ============================================================================
// Helpers
// ============================================================================

export class IrisError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'IrisError';
    this.status = status;
    this.payload = payload;
  }
}

async function resolveAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new IrisError('no_session', 401, error ?? null);
  }
  return data.session.access_token;
}

async function resolveFunctionUrl(name: string): Promise<string> {
  // Same env var used by the supabase client; reusing keeps a single
  // source of truth for the project URL.
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new IrisError('missing_supabase_url_env', 500);
  }
  return `${base.replace(/\/$/, '')}/functions/v1/${name}`;
}

async function safeJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface SseEvent {
  event?: string;
  data?: Record<string, unknown>;
}

function parseSseBlock(block: string): SseEvent | null {
  const lines = block.split('\n');
  let eventName: string | undefined;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join('\n');
  try {
    return { event: eventName, data: JSON.parse(raw) as Record<string, unknown> };
  } catch {
    return null;
  }
}

// Translate Anthropic's wire events into our consumer-facing IrisStreamEvent
// shape. Returns 0..N events per upstream event.
function interpretAnthropicEvent(
  evt: SseEvent,
  toolBlocks: Map<number, { name: string; json: string }>,
): IrisStreamEvent[] {
  const data = evt.data ?? {};
  const type = typeof data.type === 'string' ? data.type : '';

  if (type === 'content_block_start') {
    const idx = (data.index as number | undefined) ?? -1;
    const block = data.content_block as { type?: string; name?: string } | undefined;
    if (idx >= 0 && block?.type === 'tool_use' && typeof block.name === 'string') {
      toolBlocks.set(idx, { name: block.name, json: '' });
    }
    return [];
  }

  if (type === 'content_block_delta') {
    const idx = (data.index as number | undefined) ?? -1;
    const delta = data.delta as
      | { type?: string; text?: string; partial_json?: string }
      | undefined;
    if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
      return [{ type: 'text', text: delta.text }];
    }
    if (delta?.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
      const block = toolBlocks.get(idx);
      if (block) block.json += delta.partial_json;
    }
    return [];
  }

  if (type === 'content_block_stop') {
    const idx = (data.index as number | undefined) ?? -1;
    const block = toolBlocks.get(idx);
    if (block) {
      toolBlocks.delete(idx);
      let input: Record<string, unknown> = {};
      try {
        input = block.json.length > 0 ? (JSON.parse(block.json) as Record<string, unknown>) : {};
      } catch {
        return [{ type: 'warning', message: `tool_input_parse_failed:${block.name}` }];
      }
      return [{ type: 'tool_use', name: block.name, input }];
    }
    return [];
  }

  // We ignore message_start / message_delta / message_stop on the client —
  // the server already reads usage off them for accounting. The 'done'
  // event is emitted by streamIrisTurn's finally block.
  return [];
}
