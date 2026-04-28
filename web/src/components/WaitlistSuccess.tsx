'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ShareButtons } from '@/components/ShareButtons';
import { trackEvent } from '@/lib/analytics';
import {
  buildReferralUrl,
  getPositionForCode,
  type PositionLookupResult,
} from '@/lib/waitlist';

const REF_CODE_RE = /^[a-zA-Z0-9]{6,32}$/;
const noopSubscribe = () => () => {};

function getCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const code = new URL(window.location.href).searchParams.get('code');
  return code && REF_CODE_RE.test(code) ? code : null;
}
function getServerCode(): null {
  return null;
}

// `?confirmed=1` is set by the waitlist-confirm edge function's redirect
// after a successful email confirmation. We use it only to celebrate the
// freshly-completed click — the underlying email_confirmed state still
// comes from the RPC, not the URL.
function getJustConfirmedFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URL(window.location.href).searchParams.get('confirmed') === '1';
}
function getServerJustConfirmed(): false {
  return false;
}

// Effect-stored fetch result, paired with the code it was for so we don't
// flash stale data if the URL changes while a fetch is in flight.
interface FetchedFor {
  code: string;
  result: PositionLookupResult;
}

type DerivedState =
  | { kind: 'awaiting-hydration' }
  | { kind: 'loading'; code: string }
  | { kind: 'no-code' }
  | { kind: 'error'; message: string }
  | {
      kind: 'loaded';
      code: string;
      position: number | null;
      referredCount: number;
      score: number;
      emailConfirmed: boolean;
    };

export function WaitlistSuccess() {
  // SSR-safe URL reads.
  const code = useSyncExternalStore(noopSubscribe, getCodeFromUrl, getServerCode);
  const justConfirmed = useSyncExternalStore(
    noopSubscribe,
    getJustConfirmedFromUrl,
    getServerJustConfirmed,
  );
  const [hydrated, setHydrated] = useState(false);
  const [fetched, setFetched] = useState<FetchedFor | null>(null);

  // Mark the component hydrated on first client render. This is a
  // one-time SSR→CSR transition signal that prevents the server-rendered
  // "no-code" branch from flashing before useSyncExternalStore picks up
  // the URL on the client. The lint rule discourages setState in effects
  // because of cascading-render perf concerns; a single mount-only flag
  // doesn't trigger cascades.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  // Fire the RPC fetch whenever the URL code changes. Only setState
  // happens inside the async callback (subscribe-style — allowed).
  useEffect(() => {
    if (code === null) return;
    let cancelled = false;
    void getPositionForCode(code).then((result) => {
      if (!cancelled) setFetched({ code, result });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Fire `referral_landing_viewed` exactly once per page mount, the
  // first time the RPC returns a successful result. Re-renders don't
  // re-fire because of the ref guard.
  const viewedFired = useRef(false);
  useEffect(() => {
    if (viewedFired.current) return;
    if (!fetched || !fetched.result.success) return;
    viewedFired.current = true;
    trackEvent('referral_landing_viewed', {
      just_confirmed: justConfirmed,
      email_confirmed: fetched.result.email_confirmed,
    });
  }, [fetched, justConfirmed]);

  // Derive UI state from URL + fetch — no synchronous setState in effects.
  const state: DerivedState = !hydrated
    ? { kind: 'awaiting-hydration' }
    : code === null
      ? { kind: 'no-code' }
      : !fetched || fetched.code !== code
        ? { kind: 'loading', code }
        : !fetched.result.success
          ? { kind: 'error', message: humanError(fetched.result.error) }
          : {
              kind: 'loaded',
              code,
              position: fetched.result.position,
              referredCount: fetched.result.referred_count,
              score: fetched.result.gender_weighted_score,
              emailConfirmed: fetched.result.email_confirmed,
            };

  if (state.kind === 'awaiting-hydration' || state.kind === 'loading') {
    return <ShellSkeleton />;
  }

  if (state.kind === 'no-code') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-ink-900 mb-3">No referral code</h1>
        <p className="text-ink-700 mb-6">
          We couldn&apos;t find your spot from the URL. Sign up below and
          we&apos;ll send your confirmation link by email.
        </p>
        <Link
          href="/download"
          className="inline-flex items-center justify-center bg-aqua-600 hover:bg-aqua-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Join the waitlist →
        </Link>
      </Shell>
    );
  }

  if (state.kind === 'error') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-ink-900 mb-3">We hit a snag</h1>
        <p role="alert" className="text-coral mb-6">
          {state.message}
        </p>
        <Link
          href="/download"
          className="inline-flex items-center justify-center bg-aqua-600 hover:bg-aqua-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Try again →
        </Link>
      </Shell>
    );
  }

  // state.kind === 'loaded'
  const referralUrl = buildReferralUrl(state.code);
  const positionLabel = state.position !== null ? `#${state.position}` : 'on';

  return (
    <Shell>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-aqua-100 px-3 py-1 text-sm font-semibold text-aqua-700">
        {state.emailConfirmed
          ? justConfirmed
            ? '✓ Email confirmed'
            : 'Confirmed'
          : 'Almost there'}
      </div>

      <h1 className="text-3xl font-bold text-ink-900 mb-3">
        You&apos;re {positionLabel} on the Dublin list
      </h1>

      {state.emailConfirmed ? (
        <p className="text-ink-700 mb-6">
          We&apos;ll email you when Chem IRL opens the Dublin beta. In the
          meantime, send this link to single friends — every confirmed
          referral moves you up the list, and women referring women count
          double.
        </p>
      ) : (
        <p className="text-ink-700 mb-6">
          Check your inbox at the address you signed up with — we just sent a
          confirmation link from <span className="whitespace-nowrap">hello@chemirl.app</span>.
          Click it to lock in your spot.
        </p>
      )}

      <div className="mb-6 rounded-xl border border-aqua-200 bg-aqua-50 p-4">
        <h2 className="text-sm font-semibold text-ink-900 mb-2">
          Skip the line
        </h2>
        <p className="text-sm text-ink-700 mb-4">
          5 friends signed up through your link puts you in the top tier when
          we send beta invites. Female friends count double.
        </p>
        <ShareButtons referralUrl={referralUrl} />
      </div>

      {state.referredCount > 0 && (
        <p className="text-sm text-ink-500 mb-4">
          {state.referredCount} friend{state.referredCount === 1 ? '' : 's'}{' '}
          have signed up through your link so far.
        </p>
      )}

      <p className="text-xs text-ink-500">
        Referral score: {state.score.toFixed(2)} ·{' '}
        <Link href="/download" className="underline">
          Use a different email
        </Link>
      </p>
    </Shell>
  );
}

// --- Shells ---------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="py-20 px-4">
      <div className="max-w-md mx-auto bg-white rounded-brand p-8 shadow-warm">
        {children}
      </div>
    </section>
  );
}

function ShellSkeleton() {
  return (
    <Shell>
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-24 rounded-full bg-aqua-100" />
        <div className="h-8 w-3/4 rounded bg-aqua-100" />
        <div className="h-4 w-full rounded bg-aqua-50" />
        <div className="h-4 w-5/6 rounded bg-aqua-50" />
        <div className="h-32 w-full rounded-xl bg-aqua-50" />
      </div>
    </Shell>
  );
}

// --- Errors ---------------------------------------------------------------

function humanError(error: string): string {
  switch (error) {
    case 'invalid_code':
      return "That referral code doesn't look right. Try the link from your confirmation email.";
    case 'rpc_failed':
      return "We couldn't load your spot. Refresh the page in a moment.";
    case 'not_found':
      return "We couldn't find this referral code. It may have expired.";
    case 'configuration_missing':
      return "The page is misconfigured on our end. We're on it.";
    default:
      return 'Something went wrong on our end. Refresh and try again.';
  }
}
