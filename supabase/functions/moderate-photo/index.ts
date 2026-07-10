// Supabase Edge Function: moderate-photo
//
// Single endpoint, two operations selected by `kind` in the request body:
//
//   { kind: 'safety', photoPath: string }
//     → application/json:
//       { kind: 'safety',
//         decision: 'approved' | 'review' | 'blocked',
//         overallRiskScore, summary, containsPerson, isProfilePhotoSuitable,
//         recommendedAction, categories: [...8], checkId }
//
//   { kind: 'match', photoPath: string, comparePath: string }
//     → application/json:
//       { kind: 'match',
//         decision: 'match' | 'no_match' | 'no_face_detected',
//         confidence, reasoning, checkId }
//
// `photoPath` is a storage path within bucket `profiles`, scoped under the
// caller's auth.uid() — e.g. `<uuid>/1714600000000.jpg`. The function
// downloads bytes via the service-role client, sends to Claude with forced
// tool-use, persists an audit row in `photo_verification_checks`, and
// returns the structured result + the audit row id.
//
// Auth: standard JWT (verify_jwt = true, the default — no override in
// supabase/config.toml). No entitlement gate: verification is mandatory in
// onboarding and pre-paywall.
//
// Secrets required (Supabase project secrets):
//   ANTHROPIC_API_KEY      — Anthropic Messages API key
//   SUPABASE_URL           — pre-set
//   SUPABASE_ANON_KEY      — pre-set
//   SUPABASE_SERVICE_ROLE_KEY — pre-set
//
// Optional secrets (Chem IRL as a Photo Safety tenant of the Solutions
// platform — see chem-irl-solutions docs/DOMAINS.md and the platform's
// docs/CHEM_IRL_TENANT.md):
//   PHOTO_PLATFORM_URL — e.g. https://solutions.chemirl.app/api/v1/moderate
//   PHOTO_PLATFORM_KEY — workspace API key (cis_…)
// When BOTH are set, moderation is served by the platform (metered per
// call like any tenant); any platform failure falls back to the direct
// Anthropic path, so the cutover can never reduce availability.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

import {
  SAFETY_SYSTEM_PROMPT,
  MATCH_SYSTEM_PROMPT,
  SAFETY_TOOL_SCHEMA,
  MATCH_TOOL_SCHEMA,
} from './prompts.ts';
import {
  type EdgeHandler,
  logEvent,
  type ObservabilityContext,
  withObservability,
} from '../_shared/observability.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-6';
const STORAGE_BUCKET = 'profiles';
const MAX_TOKENS = 1024;

// Per-user, rolling 1-hour limit. Catches buggy retry loops without
// punishing a normal onboarding (6 safety + ~3 match = 9 calls).
const RATE_LIMIT_CALLS = 30;
const RATE_LIMIT_WINDOW_SECONDS = 3600;

// Anthropic vision input cap is ~3.75MB base64. Our compressed photos
// land ~250KB after q=0.8 resizing, so 5MB is a safety net.
const MAX_BYTES = 5 * 1024 * 1024;

type Json = Record<string, unknown>;

const handler: EdgeHandler = async (req, ctx) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // --- Auth: derive user from JWT ---
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_authorization' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

  if (!supabaseUrl || !anonKey || !serviceKey) {
    console.error('moderate-photo: missing supabase env');
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }
  if (!anthropicKey) {
    console.error('moderate-photo: missing ANTHROPIC_API_KEY');
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }

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
  ctx.user_id = user.id;

  // --- Body parse + validation ---
  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const kind = body.kind;
  if (kind !== 'safety' && kind !== 'match') {
    return jsonResponse({ error: 'invalid_kind' }, 400);
  }

  const photoPath = typeof body.photoPath === 'string' ? body.photoPath : '';
  if (!photoPath) {
    return jsonResponse({ error: 'photo_path_required' }, 400);
  }
  if (!isOwnPath(photoPath, user.id)) {
    return jsonResponse({ error: 'forbidden_path' }, 403);
  }

  let comparePath: string | null = null;
  if (kind === 'match') {
    const cp = typeof body.comparePath === 'string' ? body.comparePath : '';
    if (!cp) {
      return jsonResponse({ error: 'compare_path_required' }, 400);
    }
    if (!isOwnPath(cp, user.id)) {
      return jsonResponse({ error: 'forbidden_path' }, 403);
    }
    comparePath = cp;
  }

  // Service-role for storage download + audit insert
  const admin = createClient(supabaseUrl, serviceKey);

  // --- Rate limit ---
  const rateOk = await checkRateLimit(admin, user.id);
  if (!rateOk) {
    logEvent('warn', 'moderation_rate_limited', ctx, { kind });
    return jsonResponse({ error: 'rate_limited' }, 429, {
      'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS),
    });
  }

  // --- Fetch image(s) ---
  let primary: { bytes: Uint8Array; mediaType: string };
  try {
    primary = await downloadFromStorage(admin, photoPath);
  } catch (err) {
    console.error('moderate-photo: photo download failed', err);
    return jsonResponse({ error: 'photo_not_found' }, 404);
  }
  if (primary.bytes.byteLength > MAX_BYTES) {
    return jsonResponse({ error: 'image_too_large' }, 400);
  }

  let compare: { bytes: Uint8Array; mediaType: string } | null = null;
  if (kind === 'match' && comparePath) {
    try {
      compare = await downloadFromStorage(admin, comparePath);
    } catch (err) {
      console.error('moderate-photo: compare download failed', err);
      return jsonResponse({ error: 'compare_not_found' }, 404);
    }
    if (compare.bytes.byteLength > MAX_BYTES) {
      return jsonResponse({ error: 'image_too_large' }, 400);
    }
  }

  // --- Platform path: Chem IRL as a Photo Safety tenant ---
  const platform = await tryPlatformModeration(ctx, kind, primary, compare);
  if (platform) {
    const platformModel =
      typeof platform.model === 'string' ? `platform:${platform.model}` : 'platform';

    if (kind === 'safety') {
      const decision = String(platform.decision ?? 'review');
      const score = Math.max(0, Math.min(100, Number(platform.overall_risk_score ?? 50)));
      const checkId = await insertAuditRow(admin, ctx, {
        userId: user.id,
        kind: 'safety',
        photoPath,
        comparePath: null,
        decision,
        score,
        result: platform,
        tokensIn: null,
        tokensOut: null,
        model: platformModel,
      });
      logEvent('info', 'moderation_decision', ctx, {
        kind: 'safety',
        decision,
        backend: 'platform',
      });
      return jsonResponse(
        {
          kind: 'safety',
          decision,
          overallRiskScore: score,
          summary: String(platform.summary ?? ''),
          containsPerson: platform.contains_person === true,
          isProfilePhotoSuitable: platform.is_profile_photo_suitable === true,
          recommendedAction: String(platform.recommended_action ?? ''),
          categories: Array.isArray(platform.categories) ? platform.categories : [],
          checkId,
        },
        200,
      );
    }

    const decision = String(platform.decision ?? 'no_match');
    const confidence = Math.max(0, Math.min(1, Number(platform.confidence ?? 0)));
    const checkId = await insertAuditRow(admin, ctx, {
      userId: user.id,
      kind: 'match',
      photoPath,
      comparePath,
      decision,
      score: Math.round(confidence * 100),
      result: platform,
      tokensIn: null,
      tokensOut: null,
      model: platformModel,
    });
    logEvent('info', 'moderation_decision', ctx, {
      kind: 'match',
      decision,
      backend: 'platform',
    });
    return jsonResponse(
      {
        kind: 'match',
        decision,
        confidence,
        reasoning: String(platform.reasoning ?? ''),
        checkId,
      },
      200,
    );
  }

  // --- Call Claude ---
  const anthropicRequest =
    kind === 'safety'
      ? buildSafetyRequest(primary)
      : buildMatchRequest(primary, compare as { bytes: Uint8Array; mediaType: string });

  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(anthropicRequest),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    console.error('moderate-photo: anthropic upstream failed', upstream.status, detail);
    logEvent('error', 'moderation_upstream_failed', ctx, {
      kind,
      http_status: upstream.status,
    });
    return jsonResponse({ error: 'upstream_failed', status: upstream.status }, 502);
  }

  const json = (await upstream.json()) as {
    content?: Array<{ type: string; name?: string; input?: Json }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const toolName = kind === 'safety' ? 'record_safety_decision' : 'record_match_decision';
  const toolCall = (json.content ?? []).find((b) => b.type === 'tool_use' && b.name === toolName);

  const tokensIn = json.usage?.input_tokens ?? null;
  const tokensOut = json.usage?.output_tokens ?? null;

  // --- Tool-call missing: fall back to a 'review' verdict, log, audit ---
  if (!toolCall || !toolCall.input) {
    console.error('moderate-photo: tool_call missing', { kind, response: json });
    logEvent('warn', 'moderation_tool_missing', ctx, { kind });
    const fallbackInput =
      kind === 'safety'
        ? {
            decision: 'review',
            overallRiskScore: 50,
            summary: 'Automated screening was inconclusive.',
            containsPerson: false,
            isProfilePhotoSuitable: false,
            recommendedAction: 'Our team will review this photo.',
            categories: [],
            error: 'tool_call_missing',
          }
        : {
            decision: 'no_match',
            confidence: 0,
            reasoning: 'Automated screening was inconclusive.',
            error: 'tool_call_missing',
          };

    const fallbackScore = kind === 'safety' ? 50 : 0;
    const checkId = await insertAuditRow(admin, ctx, {
      userId: user.id,
      kind,
      photoPath,
      comparePath,
      decision: fallbackInput.decision as string,
      score: fallbackScore,
      result: fallbackInput as Json,
      tokensIn,
      tokensOut,
    });
    logEvent('info', 'moderation_decision', ctx, {
      kind,
      decision: fallbackInput.decision,
      backend: 'anthropic',
      fallback_verdict: true,
    });

    const payload =
      kind === 'safety'
        ? { kind, ...fallbackInput, checkId }
        : { kind, ...fallbackInput, checkId };
    return jsonResponse(payload, 200);
  }

  const input = toolCall.input as Json;

  if (kind === 'safety') {
    const decision = String(input.decision ?? 'review');
    const score = Math.max(0, Math.min(100, Number(input.overallRiskScore ?? 0)));
    const checkId = await insertAuditRow(admin, ctx, {
      userId: user.id,
      kind: 'safety',
      photoPath,
      comparePath: null,
      decision,
      score,
      result: input,
      tokensIn,
      tokensOut,
    });
    logEvent('info', 'moderation_decision', ctx, {
      kind: 'safety',
      decision,
      backend: 'anthropic',
    });
    return jsonResponse({ kind: 'safety', ...input, checkId }, 200);
  }

  // kind === 'match'
  const decision = String(input.decision ?? 'no_match');
  const confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0)));
  const score = Math.round(confidence * 100);
  const checkId = await insertAuditRow(admin, ctx, {
    userId: user.id,
    kind: 'match',
    photoPath,
    comparePath,
    decision,
    score,
    result: input,
    tokensIn,
    tokensOut,
  });
  logEvent('info', 'moderation_decision', ctx, {
    kind: 'match',
    decision,
    backend: 'anthropic',
  });
  return jsonResponse({ kind: 'match', ...input, checkId }, 200);
};

serve(withObservability(handler, { name: 'moderate-photo' }));

// ============================================================================
// Anthropic request builders
// ============================================================================

interface ImageContent {
  bytes: Uint8Array;
  mediaType: string;
}

function buildSafetyRequest(image: ImageContent): Json {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text', text: SAFETY_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    tools: [
      {
        name: 'record_safety_decision',
        description: 'Record the safety screening verdict for a profile photo.',
        input_schema: SAFETY_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'record_safety_decision' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Score this profile photo.' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mediaType,
              data: encodeBase64(image.bytes),
            },
          },
        ],
      },
    ],
  };
}

function buildMatchRequest(selfie: ImageContent, gallery: ImageContent): Json {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text', text: MATCH_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    tools: [
      {
        name: 'record_match_decision',
        description: 'Record the same-person decision for two photos.',
        input_schema: MATCH_TOOL_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: 'record_match_decision' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'IMAGE A: live selfie just taken by the user.' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: selfie.mediaType,
              data: encodeBase64(selfie.bytes),
            },
          },
          { type: 'text', text: 'IMAGE B: one of the user’s gallery photos.' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: gallery.mediaType,
              data: encodeBase64(gallery.bytes),
            },
          },
          { type: 'text', text: 'Decide whether the same person appears in both.' },
        ],
      },
    ],
  };
}

// ============================================================================
// Helpers
// ============================================================================

function jsonResponse(body: unknown, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
  });
}

// Path guard: storage paths in the `profiles` bucket are scoped under
// `<auth.uid()>/...`. Reject any path that doesn't start with the
// caller's user id. Prevents one user from triggering a moderation
// audit on another user's photo.
function isOwnPath(path: string, userId: string): boolean {
  return path.startsWith(`${userId}/`) && !path.includes('..');
}

// deno-lint-ignore no-explicit-any
async function downloadFromStorage(admin: any, path: string): Promise<ImageContent> {
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`storage download failed: ${error?.message ?? 'unknown'}`);
  }
  const buf = new Uint8Array(await data.arrayBuffer());
  const mediaType = inferMediaType(path);
  return { bytes: buf, mediaType };
}

function inferMediaType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

interface AuditRow {
  userId: string;
  kind: 'safety' | 'match';
  photoPath: string;
  comparePath: string | null;
  decision: string;
  score: number;
  result: Json;
  tokensIn: number | null;
  tokensOut: number | null;
  // Audit provenance: absent = direct Anthropic path; 'platform:<model>' =
  // served by the Solutions platform.
  model?: string;
}

// deno-lint-ignore no-explicit-any
async function insertAuditRow(admin: any, ctx: ObservabilityContext, row: AuditRow): Promise<string> {
  const { data, error } = await admin
    .from('photo_verification_checks')
    .insert({
      user_id: row.userId,
      kind: row.kind,
      photo_path: row.photoPath,
      compare_path: row.comparePath,
      decision: row.decision,
      score: row.score,
      result: row.result,
      model: row.model ?? MODEL,
      tokens_in: row.tokensIn,
      tokens_out: row.tokensOut,
    })
    .select('id')
    .single();
  if (error || !data) {
    // Audit failure is non-fatal — we still return the moderation result to
    // the client. The cost is a missing audit row; the alternative (failing
    // the whole call) would be worse for the user. Log loudly so we notice.
    console.error('moderate-photo: audit insert failed', error);
    logEvent('error', 'moderation_audit_insert_failed', ctx, { kind: row.kind });
    return '';
  }
  return data.id as string;
}

// Attempts moderation via the Solutions platform (/api/v1/moderate).
// Returns the platform's JSON verdict, or null when the platform path is
// disabled (env unset) or fails for any reason — the caller then falls
// back to the direct Anthropic path. Never throws.
async function tryPlatformModeration(
  ctx: ObservabilityContext,
  kind: 'safety' | 'match',
  primary: ImageContent,
  compare: ImageContent | null,
): Promise<Json | null> {
  const url = Deno.env.get('PHOTO_PLATFORM_URL');
  const key = Deno.env.get('PHOTO_PLATFORM_KEY');
  if (!url || !key) return null;

  const toImage = (img: ImageContent) => ({
    base64: encodeBase64(img.bytes),
    media_type: img.mediaType,
  });
  const body =
    kind === 'safety'
      ? { op: 'safety', image: toImage(primary) }
      : {
          op: 'match',
          selfie: toImage(primary),
          candidate: toImage(compare as ImageContent),
        };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.error(
        `moderate-photo: platform returned ${res.status} (falling back to direct)`,
      );
      // The fallback is deliberately invisible to the user — this event is
      // how operators learn the platform cutover is degraded.
      logEvent('warn', 'platform_forward', ctx, {
        target: 'photo_platform',
        kind,
        forward_status: 'error',
        http_status: res.status,
        fallback: 'anthropic',
      });
      return null;
    }
    logEvent('info', 'platform_forward', ctx, {
      target: 'photo_platform',
      kind,
      forward_status: 'ok',
    });
    return (await res.json()) as Json;
  } catch (err) {
    console.error('moderate-photo: platform errored (falling back to direct)', err);
    logEvent('warn', 'platform_forward', ctx, {
      target: 'photo_platform',
      kind,
      forward_status: 'error',
      error_message: err instanceof Error ? err.message : String(err),
      fallback: 'anthropic',
    });
    return null;
  }
}

// Rolling 1-hour cap on calls per user. Counts rows in
// photo_verification_checks regardless of kind.
// deno-lint-ignore no-explicit-any
async function checkRateLimit(admin: any, userId: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
    const { count } = await admin
      .from('photo_verification_checks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    return (count ?? 0) < RATE_LIMIT_CALLS;
  } catch (err) {
    // Fail open — never block a legitimate user on a rate-limit query bug.
    console.error('moderate-photo: rate limit query failed (failing open)', err);
    return true;
  }
}
