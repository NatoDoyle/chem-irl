// UTM capture for waitlist attribution (WAITLIST_AUDIT.md §4).
//
// Campaign links can land anywhere (most often `/`), but the signup form
// lives on `/download` — and the `/` → `/download` CTAs are plain links that
// forward no query string. So we capture utm_* into sessionStorage the moment
// any page loads (via <UtmCapture /> in the root layout) and the form reads
// them back at submit time. First-touch wins within a session: a stored
// attribution is not overwritten by a later landing, so the channel that
// actually brought the visitor gets the credit.
//
// No PII: these are campaign labels from the URL, length-clamped to match the
// DB CHECK constraints (≤120 chars).

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

const STORAGE_KEY = 'chem_utm';
const MAX_LEN = 120;

/**
 * Read utm_* from the current URL and persist to sessionStorage.
 * First-touch: does nothing if an attribution is already stored this session.
 * SSR-safe and exception-safe (sessionStorage can throw in private modes).
 */
export function captureUtmParams(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY)) return;
    const params = new URL(window.location.href).searchParams;
    const captured: UtmParams = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key)?.trim();
      if (value) captured[key] = value.slice(0, MAX_LEN);
    }
    if (Object.keys(captured).length === 0) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(captured));
  } catch {
    // Storage unavailable (private mode, quota) — attribution is best-effort.
  }
}

/**
 * Read the stored attribution back for the signup payload. Returns only
 * whitelisted keys with clamped string values, or null when nothing was
 * captured this session.
 */
export function getStoredUtmParams(): UtmParams | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;
    const result: UtmParams = {};
    for (const key of UTM_KEYS) {
      const value = obj[key];
      if (typeof value === 'string' && value.trim()) {
        result[key] = value.trim().slice(0, MAX_LEN);
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
