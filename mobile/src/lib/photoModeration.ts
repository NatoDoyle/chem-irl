// Photo-moderation client: typed POST wrapper for the moderate-photo edge
// function. One retry on transient 5xx. Mirrors the iris client pattern
// (lib/iris/client.ts) so the two AI features look the same to callers.

import { supabase } from './supabase/client';

export const PHOTO_DECISIONS = {
  Approved: 'approved',
  Review: 'review',
  Blocked: 'blocked',
} as const;
export type PhotoDecision = (typeof PHOTO_DECISIONS)[keyof typeof PHOTO_DECISIONS];

export const MATCH_DECISIONS = {
  Match: 'match',
  NoMatch: 'no_match',
  NoFaceDetected: 'no_face_detected',
} as const;
export type MatchDecision = (typeof MATCH_DECISIONS)[keyof typeof MATCH_DECISIONS];

export const SAFETY_CATEGORY_NAMES = [
  'sexual_nude',
  'violence',
  'weapons',
  'drugs',
  'hate',
  'minors',
  'spam_scam',
  'authenticity',
] as const;
export type SafetyCategoryName = (typeof SAFETY_CATEGORY_NAMES)[number];

export type SafetySeverity = 'none' | 'low' | 'medium' | 'high';

export interface SafetyCategory {
  name: SafetyCategoryName;
  severity: SafetySeverity;
  score: number;
  detected: boolean;
  notes: string;
}

export interface SafetyResult {
  kind: 'safety';
  decision: PhotoDecision;
  overallRiskScore: number;
  summary: string;
  containsPerson: boolean;
  isProfilePhotoSuitable: boolean;
  recommendedAction: string;
  categories: SafetyCategory[];
  checkId: string;
}

export interface MatchResult {
  kind: 'match';
  decision: MatchDecision;
  confidence: number;
  reasoning: string;
  checkId: string;
}

export type ModerationResult = SafetyResult | MatchResult;

interface SafetyArgs {
  kind: 'safety';
  photoPath: string;
}
interface MatchArgs {
  kind: 'match';
  photoPath: string;
  comparePath: string;
}
export type ModerationArgs = SafetyArgs | MatchArgs;

export class PhotoModerationError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'PhotoModerationError';
    this.status = status;
    this.payload = payload;
  }
}

const FUNCTION_NAME = 'moderate-photo';
const MAX_ATTEMPTS = 2; // initial + one retry on transient 5xx
const RETRY_BASE_MS = 500;

export async function moderatePhoto(args: ModerationArgs): Promise<ModerationResult> {
  const url = await resolveFunctionUrl(FUNCTION_NAME);
  const accessToken = await resolveAccessToken();

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(args),
      });

      if (!response.ok) {
        const payload = await safeJson(response);
        // Retry only transient 5xx. 4xx is a client problem; retrying just
        // burns budget.
        if (response.status >= 500 && attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_BASE_MS * attempt);
          continue;
        }
        throw new PhotoModerationError(
          typeof payload?.error === 'string' ? payload.error : 'moderation_failed',
          response.status,
          payload
        );
      }

      const result = (await response.json()) as unknown;
      if (!isValidResult(result)) {
        throw new PhotoModerationError('invalid_response_shape', 502, result);
      }
      return result;
    } catch (err) {
      lastErr = err;
      // Don't retry on deliberate client-side errors (e.g. JSON parse).
      if (err instanceof PhotoModerationError && err.status < 500) {
        throw err;
      }
      if (attempt === MAX_ATTEMPTS) {
        throw err;
      }
    }
  }
  // Defensive — the loop above always either returns or throws.
  throw lastErr instanceof Error ? lastErr : new PhotoModerationError('moderation_failed', 500);
}

// Exported for unit testing. Validates that a raw JSON response from the
// edge function is one of our two expected shapes. Cheap structural check —
// individual category names / decision strings are NOT validated here; the
// edge function already constrains them via Anthropic tool-use schemas.
export function isValidResult(r: unknown): r is ModerationResult {
  if (!r || typeof r !== 'object') return false;
  const obj = r as Record<string, unknown>;
  if (obj.kind === 'safety') {
    return (
      typeof obj.decision === 'string' &&
      Array.isArray(obj.categories) &&
      typeof obj.checkId === 'string' &&
      typeof obj.overallRiskScore === 'number' &&
      typeof obj.containsPerson === 'boolean' &&
      typeof obj.isProfilePhotoSuitable === 'boolean'
    );
  }
  if (obj.kind === 'match') {
    return (
      typeof obj.decision === 'string' &&
      typeof obj.confidence === 'number' &&
      typeof obj.checkId === 'string' &&
      typeof obj.reasoning === 'string'
    );
  }
  return false;
}

async function resolveAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new PhotoModerationError('no_session', 401, error ?? null);
  }
  return data.session.access_token;
}

async function resolveFunctionUrl(name: string): Promise<string> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new PhotoModerationError('missing_supabase_url_env', 500);
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
