// Client-side helpers for the /support page.
//
// The static marketing site posts to the deployed `support-submit` edge
// function (which wraps a service-role SECURITY DEFINER RPC), and reads
// the small set of moderator-published tips via the `list_published_tips`
// RPC using the publishable (anon) key. Service role never touches client
// code.
//
// See:
//   - supabase/functions/support-submit/index.ts (server side)
//   - supabase/migrations/<ts>_support_submissions.sql (table + RPCs)

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

let cachedClient: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  cachedClient ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export type SupportKind = 'bug' | 'feature' | 'contact' | 'tip';

// Per-kind metadata fields. Keep these in sync with the whitelist in
// supabase/functions/support-submit/index.ts (sanitizeMetadata).
export interface BugMetadata {
  app_version?: string;
  os?: 'ios' | 'android' | 'web' | 'other';
  steps_to_reproduce?: string;
}
export interface FeatureMetadata {
  use_case?: string;
}
export interface ContactMetadata {
  topic?: 'press' | 'partnership' | 'general' | 'other';
}
export interface TipMetadata {
  tip_topic?: string;
  source_url?: string;
}
export type SupportMetadata =
  | BugMetadata
  | FeatureMetadata
  | ContactMetadata
  | TipMetadata
  | Record<string, never>;

export interface SupportSubmitPayload {
  kind: SupportKind;
  email?: string;
  display_name?: string;
  subject: string;
  body: string;
  consent_privacy: boolean;
  metadata?: SupportMetadata;
  // Honeypot — set to non-empty to mark the submission as a bot.
  // Real users never see this field.
  website?: string;
}

export interface SupportSubmitSuccess {
  success: true;
  submission_id: string | null;
}
export interface SupportSubmitFailure {
  success: false;
  error: string;
}
export type SupportSubmitResult = SupportSubmitSuccess | SupportSubmitFailure;

/**
 * POSTs the support form payload to the support-submit edge function.
 * Returns a discriminated union — callers narrow on `result.success`.
 *
 * Errors are returned as data (never thrown) so callers can show inline
 * messages without wrapping in try/catch.
 */
export async function submitSupportRequest(
  payload: SupportSubmitPayload,
): Promise<SupportSubmitResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { success: false, error: 'configuration_missing' };
  }

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/support-submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return { success: false, error: 'network_error' };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { success: false, error: `http_${res.status}` };
  }

  if (!data || typeof data !== 'object') {
    return { success: false, error: `http_${res.status}` };
  }

  const obj = data as Record<string, unknown>;
  if (!res.ok || obj.success !== true) {
    const error = typeof obj.error === 'string' ? obj.error : `http_${res.status}`;
    return { success: false, error };
  }

  return {
    success: true,
    submission_id: typeof obj.submission_id === 'string' ? obj.submission_id : null,
  };
}

// --- Published tips (read path) -----------------------------------------

export interface PublishedTip {
  id: string;
  title: string;
  body: string;
  published_at: string;
  display_name: string | null;
}

export interface PublishedTipsSuccess {
  success: true;
  tips: PublishedTip[];
  total: number;
}
export interface PublishedTipsFailure {
  success: false;
  error: string;
}
export type PublishedTipsResult = PublishedTipsSuccess | PublishedTipsFailure;

/**
 * Calls the `list_published_tips` SECURITY DEFINER RPC. Returns only the
 * sanitized fields (id/title/body/published_at/display_name) — never email,
 * IP hash, or raw subject/body.
 */
export async function getPublishedTips(
  limit = 20,
  offset = 0,
): Promise<PublishedTipsResult> {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'configuration_missing' };

  const { data, error } = await client.rpc('list_published_tips', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) return { success: false, error: 'rpc_failed' };
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'unexpected_response' };
  }

  const obj = data as Record<string, unknown>;
  const rawTips = Array.isArray(obj.tips) ? obj.tips : [];
  const tips: PublishedTip[] = rawTips
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .map((t) => ({
      id: typeof t.id === 'string' ? t.id : '',
      title: typeof t.title === 'string' ? t.title : '',
      body: typeof t.body === 'string' ? t.body : '',
      published_at:
        typeof t.published_at === 'string' ? t.published_at : '',
      display_name:
        typeof t.display_name === 'string' ? t.display_name : null,
    }))
    .filter((t) => t.id && t.title && t.body);

  return {
    success: true,
    tips,
    total: typeof obj.total === 'number' ? obj.total : tips.length,
  };
}
