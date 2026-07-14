'use client';

import Link from 'next/link';

// Next.js App Router convention: error.tsx renders when an unhandled
// error is thrown anywhere below this segment in the route tree. Must
// be a Client Component because it receives a `reset` callback. Lives
// inside the root layout, so Nav + Footer still render around it.
//
// No error reporting here by decision: the marketing site has no
// client-side telemetry (Bronto covers the edge functions that carry
// every conversion; Vercel Analytics covers pageviews). The inert
// Sentry capture was removed 2026-07-13.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="pt-32 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-6">
          Something went sideways
        </h1>
        <p className="text-xl text-ink-500 mb-8">
          The page hit an unexpected error. Try again — and if it keeps
          happening, drop a line to{' '}
          <a
            href="mailto:hello@chemirl.app"
            className="text-aqua-600 underline hover:text-aqua-700"
          >
            hello@chemirl.app
          </a>{' '}
          and we&apos;ll sort it.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center bg-aqua-600 hover:bg-aqua-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center text-aqua-700 hover:text-aqua-800 font-semibold py-3 px-6 transition-colors"
          >
            Back to home →
          </Link>
        </div>
      </div>
    </section>
  );
}
