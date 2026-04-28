// Tiny wrapper around `window.plausible(...)` so callers don't have to
// guard for SSR or for environments where the Plausible script isn't
// loaded. When NEXT_PUBLIC_PLAUSIBLE_DOMAIN is unset (dev, preview,
// local builds), the script is never injected and `window.plausible`
// is undefined — calls are silent no-ops.
//
// Plausible's API:
//   window.plausible(eventName, { props: { key: value, ... } })

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
