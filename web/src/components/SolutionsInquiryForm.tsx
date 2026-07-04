'use client';

// Early-access inquiry form for /solutions. Posts through the existing
// support-submit edge function as kind=contact / topic=partnership, so
// inquiries land in support_submissions and — once the support agent is
// live — flow into its review queue like any other message. No new backend.

import { useState } from 'react';
import { submitSupportRequest } from '@/lib/support';

const MODULES = [
  'AI support inbox',
  'Photo Safety API',
  'Autonomous marketing seat',
  'Outbound drafting (draft-only)',
  'Staff training',
  'Not sure yet — tell me more',
] as const;
type Module = (typeof MODULES)[number];

type Status =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'sent' };

export function SolutionsInquiryForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [moduleInterest, setModuleInterest] = useState<Module>(MODULES[0]);
  const [message, setMessage] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setStatus({ kind: 'idle' });

    const result = await submitSupportRequest({
      kind: 'contact',
      email,
      display_name: name,
      subject: `[solutions] ${moduleInterest} — ${company || 'unnamed business'}`,
      body: `Business: ${company || '(not given)'}\nModule: ${moduleInterest}\n\n${message}`,
      consent_privacy: consentPrivacy,
      metadata: { topic: 'partnership' },
      website,
    });

    setSubmitting(false);
    if (result.success) {
      setStatus({ kind: 'sent' });
    } else {
      setStatus({
        kind: 'error',
        message:
          result.error === 'rate_limited'
            ? 'Too many submissions from this connection — try again in an hour.'
            : 'Something went wrong. Email us instead: support@chemirl.app.',
      });
    }
  }

  if (status.kind === 'sent') {
    return (
      <div className="rounded-2xl border border-aqua-200 bg-white p-8 text-center">
        <p className="text-lg font-semibold text-ink-900 mb-2">Request received.</p>
        <p className="text-ink-700">
          Nathan reads every one of these. You&apos;ll get a reply within 48 hours —
          founding-partner slots are answered first.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sol-name" className="text-sm font-medium text-ink-700">
            Name *
          </label>
          <input
            id="sol-name"
            type="text"
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClasses}
            placeholder="Your name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sol-email" className="text-sm font-medium text-ink-700">
            Work email *
          </label>
          <input
            id="sol-email"
            type="email"
            required
            maxLength={320}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
            placeholder="you@yourcompany.com"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sol-company" className="text-sm font-medium text-ink-700">
            Business
          </label>
          <input
            id="sol-company"
            type="text"
            maxLength={120}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputClasses}
            placeholder="Company or project name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="sol-module" className="text-sm font-medium text-ink-700">
            What are you interested in? *
          </label>
          <select
            id="sol-module"
            required
            value={moduleInterest}
            onChange={(e) => setModuleInterest(e.target.value as Module)}
            className={inputClasses}
          >
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="sol-message" className="text-sm font-medium text-ink-700">
          What would you point it at? *
        </label>
        <textarea
          id="sol-message"
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${inputClasses} resize-y`}
          placeholder="One or two sentences about your support volume, marketing setup, or moderation needs."
        />
      </div>

      {/* Honeypot — hidden from real users */}
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

      <label className="flex items-start gap-3 text-sm text-ink-700">
        <input
          type="checkbox"
          required
          checked={consentPrivacy}
          onChange={(e) => setConsentPrivacy(e.target.checked)}
          className="mt-1"
        />
        <span>
          I agree to the{' '}
          <a href="/privacy" className="underline">
            privacy policy
          </a>
          . <span className="text-ink-500">(required)</span>
        </span>
      </label>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center bg-aqua-600 hover:bg-aqua-700 disabled:opacity-60 text-white font-medium px-6 py-3 rounded-xl transition-colors"
      >
        {submitting ? 'Sending…' : 'Request early access'}
      </button>
    </form>
  );
}

const inputClasses =
  'w-full rounded-xl border border-aqua-200 px-4 py-3 text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-aqua-500 focus:border-transparent';
