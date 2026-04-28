'use client';

import { useState } from 'react';
import { submitBlogSubscribe } from '@/lib/waitlist';

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

export function BlogEmailCTA() {
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === 'submitting') return;
    setStatus({ kind: 'submitting' });
    const result = await submitBlogSubscribe({
      email: email.trim().toLowerCase(),
      website: website || undefined,
    });
    if (result.success) {
      setStatus({ kind: 'success' });
      setEmail('');
      return;
    }
    setStatus({ kind: 'error', message: humanError(result.error) });
  }

  if (status.kind === 'success') {
    return (
      <section
        aria-labelledby="sidebar-subscribe-success"
        className="rounded-brand bg-aqua-50 border border-aqua-100 p-4"
      >
        <h3
          id="sidebar-subscribe-success"
          className="text-sm font-semibold text-aqua-900 mb-1"
        >
          You&apos;re in.
        </h3>
        <p className="text-sm text-ink-700">
          We&apos;ll send new posts to that inbox. Unsubscribe any time.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="sidebar-subscribe">
      <h3
        id="sidebar-subscribe"
        className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3"
      >
        Get new posts
      </h3>
      <form onSubmit={onSubmit} className="space-y-2">
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
          className="w-full px-3 py-2 rounded-brand border border-ink-100 bg-surface text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-aqua-500 focus:ring-2 focus:ring-aqua-100 transition"
        />
        {/* Honeypot — bots fill it; real users never see it. */}
        <div
          className="absolute left-[-10000px] top-0 h-0 w-0 overflow-hidden"
          aria-hidden="true"
        >
          <label>
            Don&apos;t fill this in:
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={status.kind === 'submitting'}
          className="w-full px-3 py-2 rounded-brand bg-aqua-600 hover:bg-aqua-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
        >
          {status.kind === 'submitting' ? 'Subscribing…' : 'Subscribe'}
        </button>
        {status.kind === 'error' && (
          <p role="alert" className="text-xs text-coral">
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}

function humanError(error: string): string {
  switch (error) {
    case 'invalid_email':
      return "That email doesn't look right.";
    case 'disposable_email':
      return 'Please use a non-disposable email.';
    case 'rate_limited':
      return "You're going too fast — try again in a bit.";
    case 'configuration_missing':
    case 'network_error':
      return 'Network hiccup. Try again in a moment.';
    default:
      return 'Something went wrong. Try again?';
  }
}
