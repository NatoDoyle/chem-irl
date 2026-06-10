// Analytics event seam. Originally a wrapper around `window.plausible(...)`;
// Plausible was dropped on 2026-06-10 (see docs/infrastructure/
// OPENCLAW_CMO_VPS.md §7.2), so its script is never injected and every call
// here is a silent no-op. The wrapper and its call sites (form started/
// submitted, share clicks) are kept deliberately: they mark exactly where
// events fire, so a future provider (e.g. Vercel Analytics custom events)
// only has to reimplement this one function.

type EventProps = Record<string, string | number | boolean>;

type PlausibleFn = (
  name: string,
  options?: { props?: EventProps },
) => void;

export function trackEvent(name: string, props?: EventProps): void {
  if (typeof window === 'undefined') return;
  const plausible = (window as unknown as { plausible?: PlausibleFn })
    .plausible;
  plausible?.(name, props ? { props } : undefined);
}
