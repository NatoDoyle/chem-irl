// Scrub Sentry event payloads for PII before transmission.
//
// Rules (must stay identical to supabase/functions/_shared/sentry-scrubber.ts):
//   - Drop keys: message, message_text, body, note, email, phone, phone_number
//   - Replace photo URL keys (photo_url, signed_url, avatar_url) with marker
//   - Hash matches of email regex and E.164-with-plus phone regex
//   - Truncate any string longer than 2048 chars
//   - Recurse through objects and arrays; cap recursion depth
//
// Pure function: returns a new value, never mutates input.
//
// PR-A only ships the helper. PR-B wires it into Sentry's `beforeSend` hook
// in mobile/index.ts; PR-C wires the edge mirror into the shared observability
// helper.

const DROP_KEYS = new Set([
  'message',
  'message_text',
  'body',
  'note',
  'email',
  'phone',
  'phone_number',
]);

const PHOTO_KEYS = new Set(['photo_url', 'signed_url', 'avatar_url']);

const PHOTO_PLACEHOLDER = '<scrubbed:photo>';
const TRUNCATE_AT = 2048;
const TRUNCATE_SUFFIX = '…[truncated]';
const MAX_DEPTH = 20;
const DEPTH_PLACEHOLDER = '<scrubbed:depth>';

const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Conservative phone match: must start with `+` to avoid false positives on
// timestamps, UUIDs without hyphens, and other long digit runs.
const PHONE_REGEX = /\+[1-9]\d{6,14}\b/g;

// FNV-1a 32-bit hash. Deterministic, no crypto dep, returns 6 hex chars.
function hashFragment(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

function scrubString(value: string): string {
  let out = value;
  out = out.replace(EMAIL_REGEX, (m) => `<email:${hashFragment(m)}>`);
  out = out.replace(PHONE_REGEX, (m) => `<phone:${hashFragment(m)}>`);
  if (out.length > TRUNCATE_AT) {
    out = out.slice(0, TRUNCATE_AT) + TRUNCATE_SUFFIX;
  }
  return out;
}

function scrub(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return DEPTH_PLACEHOLDER;
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DROP_KEYS.has(k)) continue;
      if (PHOTO_KEYS.has(k) && typeof v === 'string') {
        out[k] = PHOTO_PLACEHOLDER;
        continue;
      }
      out[k] = scrub(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function scrubSentryPayload<T>(payload: T): T {
  return scrub(payload, 0) as T;
}

// Exposed for the mirror drift check (PR-E) and direct unit testing.
export const SCRUBBER_RULES = {
  DROP_KEYS: Array.from(DROP_KEYS),
  PHOTO_KEYS: Array.from(PHOTO_KEYS),
  PHOTO_PLACEHOLDER,
  TRUNCATE_AT,
  TRUNCATE_SUFFIX,
  MAX_DEPTH,
  DEPTH_PLACEHOLDER,
} as const;
