// Supabase Edge Function: iris-chat
//
// Single endpoint, two operations selected by `op` in the request body:
//
//   { op: 'turn',
//     surface: 'interview' | 'profile_polish' | 'date_organiser' | 'chat_coach',
//     conversation_id?: uuid,    // null → start a new conversation
//     match_id?: uuid,           // required for chat_coach + date_organiser
//     message: string }
//
//     → text/event-stream of Anthropic's SSE events, transparently forwarded.
//       Persists the user message before streaming and the assistant message
//       after streaming completes (with token counts).
//
//   { op: 'finalize', conversation_id: uuid }
//
//     → application/json with the extracted memory patch. Runs a separate
//       (non-streaming) Anthropic call against the conversation transcript,
//       applies the patch via iris_apply_memory_patch, and marks the
//       conversation status='completed'.
//
// Auth: standard JWT (verify_jwt = true, the default — no override in
// supabase/config.toml). Entitlement gate is enforced via iris_can_use().
//
// Secrets required (Supabase project secrets):
//   ANTHROPIC_API_KEY      — Anthropic Messages API key
//   SUPABASE_URL           — pre-set
//   SUPABASE_ANON_KEY      — pre-set
//   SUPABASE_SERVICE_ROLE_KEY — pre-set

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  buildSystemPrompt,
  buildMemoryBlock,
  isIrisSurface,
  EXTRACTION_SYSTEM_PROMPT,
  type IrisSurface,
} from './system-prompt.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Model selection per surface. Interview gets the deeper model; everything
// else uses the cost/latency sweet spot. Centralised here so changing models
// is one edit, not a search.
const MODEL_BY_SURFACE: Record<IrisSurface, string> = {
  interview: 'claude-opus-4-7',
  profile_polish: 'claude-sonnet-4-6',
  date_organiser: 'claude-sonnet-4-6',
  chat_coach: 'claude-sonnet-4-6',
};

const MAX_TOKENS_BY_SURFACE: Record<IrisSurface, number> = {
  interview: 1024,
  profile_polish: 768,
  date_organiser: 512,
  chat_coach: 512,
};

// Hard cap on conversation length to bound cost. The interview prompt aims
// for ~15 turns; this lets us stop runaway loops without trusting the model.
const MAX_TURNS_PER_CONVERSATION = 50;
// Per-user, per-window rate limit. Subscribers should never feel this; it's
// a guardrail against bugs and abuse.
const RATE_LIMIT_TURNS = 60;
const RATE_LIMIT_WINDOW_SECONDS = 300;

type Json = Record<string, unknown>;

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // --- Auth: derive user from JWT (verify_jwt=true gives us a verified token) ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('iris-chat: missing supabase env');
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }
  if (!anthropicKey) {
    console.error('iris-chat: missing ANTHROPIC_API_KEY');
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

  // User-context client (RLS applies, auth.uid() resolves)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  // --- Entitlement check: can_use? ---
  const { data: canUseData, error: canUseError } = await userClient.rpc('iris_can_use');
  if (canUseError) {
    console.error('iris-chat: iris_can_use rpc failed', canUseError);
    return jsonResponse({ error: 'entitlement_check_failed' }, 500);
  }
  const canUse = canUseData as { allowed?: boolean; reason?: string } | null;
  if (!canUse?.allowed) {
    return jsonResponse(
      { error: 'not_entitled', reason: canUse?.reason ?? 'unknown' },
      402,
    );
  }

  // --- Body parse + dispatch ---
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  // Service-role client for writes that must bypass RLS (message persistence,
  // conversation upsert, memory read/write via SECURITY DEFINER RPCs).
  const admin = createClient(supabaseUrl, serviceKey);

  const op = body.op;
  try {
    if (op === 'finalize') {
      return await handleFinalize({ body, admin, userId: user.id, anthropicKey });
    }
    // Default to 'turn' for forward-compat.
    return await handleTurn({ body, admin, userId: user.id, anthropicKey });
  } catch (err) {
    console.error('iris-chat: unhandled error', err);
    return jsonResponse({ error: 'internal_error' }, 500);
  }
});

// ============================================================================
// Operation: turn (streaming)
// ============================================================================

interface TurnContext {
  body: Json;
  // deno-lint-ignore no-explicit-any
  admin: any;
  userId: string;
  anthropicKey: string;
}

async function handleTurn(ctx: TurnContext): Promise<Response> {
  const { body, admin, userId, anthropicKey } = ctx;

  const surfaceRaw = body.surface;
  if (!isIrisSurface(surfaceRaw)) {
    return jsonResponse({ error: 'invalid_surface' }, 400);
  }
  const surface: IrisSurface = surfaceRaw;

  const messageText = typeof body.message === 'string' ? body.message.trim() : '';
  if (!messageText) {
    return jsonResponse({ error: 'empty_message' }, 400);
  }
  if (messageText.length > 4000) {
    return jsonResponse({ error: 'message_too_long' }, 400);
  }

  const matchId =
    typeof body.match_id === 'string' && body.match_id.length > 0 ? body.match_id : null;

  // --- Match ownership: when match_id is supplied, the caller must be a
  //     participant of that match. RLS already prevents read-leakage of
  //     iris_conversations to other users, but without this check a
  //     malicious caller could create iris_conversations rows tagged with
  //     somebody else's match_id, and (more importantly) Phase 2's
  //     chat_coach surface will load match-thread context — that path
  //     MUST never see a thread the caller isn't part of.
  if (matchId) {
    if (!isUuid(matchId)) {
      return jsonResponse({ error: 'invalid_match_id' }, 400);
    }
    const { data: matchRow, error: matchErr } = await admin
      .from('matches')
      .select('match_id, user_a, user_b')
      .eq('match_id', matchId)
      .maybeSingle();
    if (matchErr) {
      console.error('iris-chat: match lookup failed', matchErr);
      return jsonResponse({ error: 'match_lookup_failed' }, 500);
    }
    if (!matchRow) {
      return jsonResponse({ error: 'match_not_found' }, 404);
    }
    if (matchRow.user_a !== userId && matchRow.user_b !== userId) {
      return jsonResponse({ error: 'forbidden_match' }, 403);
    }
  }

  // --- Rate limit per user per window ---
  const rateOk = await checkRateLimit(admin, userId);
  if (!rateOk) {
    return jsonResponse({ error: 'rate_limited' }, 429, {
      'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
    });
  }

  // --- Resolve or create the conversation ---
  let conversationId =
    typeof body.conversation_id === 'string' && body.conversation_id.length > 0
      ? body.conversation_id
      : null;

  // deno-lint-ignore no-explicit-any
  let conversation: any | null = null;

  if (conversationId) {
    const { data, error } = await admin
      .from('iris_conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) {
      return jsonResponse({ error: 'conversation_not_found' }, 404);
    }
    if (data.status !== 'active') {
      return jsonResponse({ error: 'conversation_not_active', status: data.status }, 409);
    }
    if (data.turn_count >= MAX_TURNS_PER_CONVERSATION) {
      return jsonResponse({ error: 'conversation_turn_cap_reached' }, 409);
    }
    conversation = data;
  } else {
    const { data, error } = await admin
      .from('iris_conversations')
      .insert({
        user_id: userId,
        surface,
        match_id: matchId,
        model: MODEL_BY_SURFACE[surface],
        status: 'active',
      })
      .select('*')
      .single();
    if (error || !data) {
      console.error('iris-chat: create conversation failed', error);
      return jsonResponse({ error: 'conversation_create_failed' }, 500);
    }
    conversation = data;
    conversationId = data.id;
  }

  // --- Persist the user turn before calling Anthropic so a server failure
  //     mid-stream doesn't lose the user's message ---
  const { error: userMsgError } = await admin.from('iris_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: { text: messageText },
  });
  if (userMsgError) {
    console.error('iris-chat: user message persist failed', userMsgError);
    return jsonResponse({ error: 'persist_user_failed' }, 500);
  }

  // --- Load prior turns for the model (excluding the one we just inserted —
  //     we'll append the current message to the messages array directly) ---
  const { data: priorMessagesRaw, error: priorErr } = await admin
    .from('iris_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (priorErr) {
    console.error('iris-chat: load prior messages failed', priorErr);
    return jsonResponse({ error: 'history_load_failed' }, 500);
  }
  const priorMessages = (priorMessagesRaw ?? []) as Array<{
    role: 'user' | 'assistant' | 'system';
    content: { text?: string };
  }>;

  // --- Load Iris's memory of this user (returns sane defaults if empty) ---
  const { data: memoryData, error: memoryErr } = await admin.rpc('iris_get_memory', {
    p_user_id: userId,
  });
  if (memoryErr) {
    console.error('iris-chat: memory load failed', memoryErr);
    // Non-fatal: proceed with empty memory.
  }

  // --- Build Anthropic request ---
  const systemPrompt = buildSystemPrompt(surface);
  const memoryBlock = buildMemoryBlock(memoryData);

  const anthropicMessages = priorMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content?.text === 'string' ? m.content.text : '',
    }));

  const anthropicRequest = {
    model: MODEL_BY_SURFACE[surface],
    max_tokens: MAX_TOKENS_BY_SURFACE[surface],
    stream: true,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: memoryBlock,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: anthropicMessages,
  };

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(anthropicRequest),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('iris-chat: anthropic upstream failed', upstream.status, detail);
    await admin
      .from('iris_conversations')
      .update({ status: 'errored' })
      .eq('id', conversationId);
    return jsonResponse({ error: 'upstream_failed', status: upstream.status }, 502);
  }

  // --- Tee the stream: forward to client, accumulate for DB persistence ---
  const decoder = new TextDecoder();
  let assistantBuffer = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;

  const reader = upstream.body.getReader();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          // Side-effect: persist the assistant message + token counts.
          // Use queueMicrotask to avoid blocking the stream close.
          queueMicrotask(() => {
            persistAssistantTurn({
              admin,
              conversationId: conversationId as string,
              text: assistantBuffer,
              inputTokens,
              outputTokens,
              cacheReadTokens,
              cacheWriteTokens,
            }).catch((err) =>
              console.error('iris-chat: persist assistant turn failed', err),
            );
          });
          return;
        }
        controller.enqueue(value);

        // Parse SSE chunk(s) for our bookkeeping. We don't break the
        // forwarded stream — clients see Anthropic's bytes verbatim.
        const chunkText = decoder.decode(value, { stream: true });
        for (const event of parseSseEvents(chunkText)) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta as { type?: string; text?: string } | undefined;
            if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
              assistantBuffer += delta.text;
            }
          } else if (event.type === 'message_start') {
            const usage = (event.message as { usage?: Json } | undefined)?.usage as
              | {
                  input_tokens?: number;
                  cache_creation_input_tokens?: number;
                  cache_read_input_tokens?: number;
                }
              | undefined;
            if (usage) {
              inputTokens += usage.input_tokens ?? 0;
              cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
              cacheReadTokens += usage.cache_read_input_tokens ?? 0;
            }
          } else if (event.type === 'message_delta') {
            const usage = (event.usage as { output_tokens?: number } | undefined) ?? null;
            if (usage) outputTokens += usage.output_tokens ?? 0;
          }
        }
      } catch (err) {
        console.error('iris-chat: stream pull failed', err);
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Iris-Conversation-Id': conversationId as string,
    },
  });
}

interface PersistAssistantTurnArgs {
  // deno-lint-ignore no-explicit-any
  admin: any;
  conversationId: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

async function persistAssistantTurn(args: PersistAssistantTurnArgs): Promise<void> {
  const {
    admin,
    conversationId,
    text,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
  } = args;

  await admin.from('iris_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: { text },
    tokens_in: inputTokens,
    tokens_out: outputTokens,
  });

  // Bump conversation aggregates. We accumulate input/output across the
  // whole conversation rather than overwriting; ditto cache hits.
  // RPC-free: a small SQL via the JS client is enough.
  const { data: conv } = await admin
    .from('iris_conversations')
    .select('turn_count, tokens_in, tokens_out, cache_read_tokens, cache_write_tokens')
    .eq('id', conversationId)
    .single();
  if (!conv) return;

  await admin
    .from('iris_conversations')
    .update({
      turn_count: (conv.turn_count ?? 0) + 1,
      tokens_in: (conv.tokens_in ?? 0) + inputTokens,
      tokens_out: (conv.tokens_out ?? 0) + outputTokens,
      cache_read_tokens: (conv.cache_read_tokens ?? 0) + cacheReadTokens,
      cache_write_tokens: (conv.cache_write_tokens ?? 0) + cacheWriteTokens,
    })
    .eq('id', conversationId);
}

// ============================================================================
// Operation: finalize (extraction + memory patch)
// ============================================================================

async function handleFinalize(ctx: TurnContext): Promise<Response> {
  const { body, admin, userId, anthropicKey } = ctx;

  const conversationId =
    typeof body.conversation_id === 'string' ? body.conversation_id : null;
  if (!conversationId) {
    return jsonResponse({ error: 'conversation_id_required' }, 400);
  }

  // Verify ownership and active status
  const { data: conversation, error: convErr } = await admin
    .from('iris_conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (convErr || !conversation) {
    return jsonResponse({ error: 'conversation_not_found' }, 404);
  }
  if (conversation.status === 'completed') {
    return jsonResponse({ ok: true, already_completed: true }, 200);
  }

  // Pull the full transcript
  const { data: messagesRaw, error: msgErr } = await admin
    .from('iris_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (msgErr) {
    console.error('iris-chat: finalize history load failed', msgErr);
    return jsonResponse({ error: 'history_load_failed' }, 500);
  }
  const messages = (messagesRaw ?? []) as Array<{
    role: 'user' | 'assistant' | 'system';
    content: { text?: string };
  }>;

  // Format the transcript as a single user message for the extractor
  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m, i) => `[turn ${i + 1}] ${m.role}: ${m.content?.text ?? ''}`)
    .join('\n\n');

  const extractionRequest = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM_PROMPT,
    tools: [
      {
        name: 'update_memory',
        description: 'Persist the structured memory patch derived from the conversation.',
        input_schema: {
          type: 'object',
          properties: {
            facts: { type: 'object' },
            ocean_scores: { type: 'object' },
            mark_interview_completed: { type: 'boolean' },
          },
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'update_memory' },
    messages: [
      {
        role: 'user',
        content: `Conversation surface: ${conversation.surface}\n\n${transcript}`,
      },
    ],
  };

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(extractionRequest),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('iris-chat: finalize upstream failed', upstream.status, detail);
    return jsonResponse({ error: 'extraction_failed' }, 502);
  }

  const json = (await upstream.json()) as {
    content?: Array<{ type: string; name?: string; input?: Json }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const toolCall = (json.content ?? []).find((b) => b.type === 'tool_use');
  if (!toolCall || !toolCall.input) {
    console.error('iris-chat: finalize did not return tool_use', json);
    // Still mark the conversation completed so we don't loop on it.
    await admin
      .from('iris_conversations')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', conversationId);
    return jsonResponse({ ok: true, patch: null, note: 'no_tool_call' }, 200);
  }

  // Apply the patch via the SECURITY DEFINER RPC
  const { error: patchErr } = await admin.rpc('iris_apply_memory_patch', {
    p_user_id: userId,
    p_patch: toolCall.input,
  });
  if (patchErr) {
    console.error('iris-chat: memory patch failed', patchErr);
    return jsonResponse({ error: 'memory_patch_failed' }, 500);
  }

  // Mark conversation completed and bump aggregates
  const inTokens = json.usage?.input_tokens ?? 0;
  const outTokens = json.usage?.output_tokens ?? 0;
  await admin
    .from('iris_conversations')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      tokens_in: (conversation.tokens_in ?? 0) + inTokens,
      tokens_out: (conversation.tokens_out ?? 0) + outTokens,
    })
    .eq('id', conversationId);

  return jsonResponse({ ok: true, patch: toolCall.input }, 200);
}

// ============================================================================
// Helpers
// ============================================================================

function jsonResponse(
  body: Json | { error: string } | { ok: boolean } | unknown,
  status: number,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
  });
}

// Cheap rate-limiting: count messages this user has *sent* (role='user')
// across all their conversations in the last window. Returns true if
// they're under the cap.
// deno-lint-ignore no-explicit-any
async function checkRateLimit(admin: any, userId: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
    // Two-step: list this user's conversations, count messages within them.
    // Cheap because indexes cover both lookups.
    const { data: convIds } = await admin
      .from('iris_conversations')
      .select('id')
      .eq('user_id', userId)
      .gte('started_at', since);
    if (!convIds || convIds.length === 0) return true;
    const { count } = await admin
      .from('iris_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', convIds.map((c: { id: string }) => c.id))
      .eq('role', 'user')
      .gte('created_at', since);
    return (count ?? 0) < RATE_LIMIT_TURNS;
  } catch (err) {
    // Fail open — never block legitimate users on a rate-limit query bug.
    console.error('iris-chat: rate limit query failed (failing open)', err);
    return true;
  }
}

// Cheap UUID syntax check — guards against junk match_id values being passed
// to the matches lookup. We only care about format; ownership is verified
// by the actual SELECT against the matches table.
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

// Minimal SSE parser: splits by double-newline, extracts `data:` JSON. Used
// only for our own bookkeeping; the raw stream goes to the client untouched.
function parseSseEvents(text: string): Array<Json & { type?: string }> {
  const events: Array<Json & { type?: string }> = [];
  for (const block of text.split('\n\n')) {
    const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
    if (!dataLine) continue;
    const payload = dataLine.slice('data:'.length).trim();
    if (!payload) continue;
    try {
      events.push(JSON.parse(payload) as Json & { type?: string });
    } catch {
      // skip non-JSON
    }
  }
  return events;
}
