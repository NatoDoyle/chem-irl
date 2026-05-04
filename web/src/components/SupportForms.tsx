'use client';

import { useEffect, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import {
  getPublishedTips,
  submitSupportRequest,
  type PublishedTip,
  type SupportKind,
  type SupportMetadata,
  type SupportSubmitPayload,
} from '@/lib/support';

// --- SupportFormPicker ---------------------------------------------------

const KINDS: { value: SupportKind; label: string; blurb: string }[] = [
  {
    value: 'bug',
    label: 'Report a bug',
    blurb: "Something's broken. Tell us what happened and we'll fix it.",
  },
  {
    value: 'feature',
    label: 'Suggest an improvement',
    blurb: "What's missing or could be better?",
  },
  {
    value: 'contact',
    label: 'Ask a question',
    blurb: "How-to, accounts, partnerships — anything else.",
  },
  {
    value: 'tip',
    label: 'Share a tip',
    blurb: 'Found something that worked? Share it. We publish the best.',
  },
];

export function SupportFormPicker() {
  const [active, setActive] = useState<SupportKind>('bug');
  const blurb = KINDS.find((k) => k.value === active)?.blurb ?? '';

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Type of submission"
      >
        {KINDS.map((k) => {
          const checked = active === k.value;
          return (
            <button
              key={k.value}
              type="button"
              role="tab"
              aria-selected={checked}
              onClick={() => setActive(k.value)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                checked
                  ? 'border-aqua-600 bg-aqua-600 text-white'
                  : 'border-aqua-200 bg-white text-ink-700 hover:border-aqua-400'
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-ink-500">{blurb}</p>
      <SupportForm kind={active} />
    </div>
  );
}

// --- SupportForm ---------------------------------------------------------

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string };

interface SupportFormProps {
  kind: SupportKind;
}

export function SupportForm({ kind }: SupportFormProps) {
  // Shared fields. Hoist all state at the form level so React keeps it
  // across re-renders triggered by `kind` changes; on kind change the
  // user keeps what they've typed.
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [tipTopic, setTipTopic] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Reset success state if the user switches kind after submitting.
  useEffect(() => {
    if (status.kind === 'success') setStatus({ kind: 'idle' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const submitting = status.kind === 'submitting';
  const succeeded = status.kind === 'success';

  // Fire `support_form_started` once on first interaction.
  const startedFired = useRef(false);
  function handleFirstFocus() {
    if (startedFired.current) return;
    startedFired.current = true;
    trackEvent('support_form_started');
  }

  function resetForm() {
    setSubject('');
    setBodyText('');
    setEmail('');
    setDisplayName('');
    setAppVersion('');
    setTipTopic('');
    setSourceUrl('');
    setConsentPrivacy(false);
    setWebsite('');
    setStatus({ kind: 'idle' });
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setStatus({ kind: 'submitting' });

    const metadata = buildMetadata(kind, {
      appVersion,
      tipTopic,
      sourceUrl,
    });

    const payload: SupportSubmitPayload = {
      kind,
      email: email.trim() || undefined,
      display_name: displayName.trim() || undefined,
      subject: subject.trim(),
      body: bodyText.trim(),
      consent_privacy: consentPrivacy,
      metadata,
      website: website || undefined,
    };

    const result = await submitSupportRequest(payload);
    if (result.success) {
      trackEvent('support_form_submitted', { kind });
      setStatus({ kind: 'success' });
      return;
    }
    setStatus({ kind: 'error', message: humanError(result.error) });
  }

  if (succeeded) {
    return (
      <div className="rounded-2xl border border-aqua-200 bg-aqua-50 p-6 text-ink-900">
        <h3 className="text-lg font-semibold">{successHeadline(kind)}</h3>
        <p className="mt-2 text-sm text-ink-700">{successBlurb(kind)}</p>
        <button
          type="button"
          onClick={resetForm}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-aqua-200 bg-white px-4 py-2 text-sm font-semibold text-ink-900 hover:border-aqua-400"
        >
          Submit another
        </button>
      </div>
    );
  }

  const emailRequired = kind !== 'tip';

  return (
    <form
      onSubmit={onSubmit}
      onFocus={handleFirstFocus}
      className="flex flex-col gap-5"
    >
      <Field label={subjectLabel(kind)} htmlFor="sup-subject" required>
        <input
          id="sup-subject"
          name="subject"
          type="text"
          required
          minLength={3}
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClasses}
          placeholder={subjectPlaceholder(kind)}
        />
      </Field>

      <Field label={bodyLabel(kind)} htmlFor="sup-body" required>
        <textarea
          id="sup-body"
          name="body"
          rows={6}
          required
          minLength={10}
          maxLength={5000}
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          className={`${inputClasses} resize-y`}
          placeholder={bodyPlaceholder(kind)}
        />
      </Field>

      {kind === 'bug' && (
        <Field label="App version (optional)" htmlFor="sup-app-version">
          <input
            id="sup-app-version"
            name="app_version"
            type="text"
            maxLength={40}
            value={appVersion}
            onChange={(e) => setAppVersion(e.target.value)}
            className={inputClasses}
            placeholder="e.g. 1.4.0 (or where you saw it — App Store / TestFlight)"
          />
        </Field>
      )}

      {kind === 'tip' && (
        <>
          <Field label="Topic (optional)" htmlFor="sup-tip-topic">
            <input
              id="sup-tip-topic"
              name="tip_topic"
              type="text"
              maxLength={80}
              value={tipTopic}
              onChange={(e) => setTipTopic(e.target.value)}
              className={inputClasses}
              placeholder="e.g. First date venues, Profile photos"
            />
          </Field>
          <Field label="Source URL (optional)" htmlFor="sup-source-url">
            <input
              id="sup-source-url"
              name="source_url"
              type="url"
              maxLength={500}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className={inputClasses}
              placeholder="https://…"
            />
          </Field>
        </>
      )}

      <Field
        label={emailRequired ? 'Email' : 'Email (optional)'}
        htmlFor="sup-email"
        required={emailRequired}
      >
        <input
          id="sup-email"
          name="email"
          type="email"
          required={emailRequired}
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          placeholder="you@example.com"
        />
      </Field>

      {kind === 'tip' && (
        <Field label="Display name (optional)" htmlFor="sup-display-name">
          <input
            id="sup-display-name"
            name="display_name"
            type="text"
            maxLength={80}
            autoComplete="given-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClasses}
            placeholder="Aoife — shown on the public tip if we publish it"
          />
        </Field>
      )}

      {/* Honeypot — must stay visually hidden but submittable. Bots fill
          it; real users never see it. */}
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
        className="rounded-xl bg-aqua-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-aqua-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Sending…' : submitLabel(kind)}
      </button>
    </form>
  );
}

// --- PublishedTips -------------------------------------------------------

type TipsState =
  | { kind: 'loading' }
  | { kind: 'ok'; tips: PublishedTip[]; total: number }
  | { kind: 'error' };

export function PublishedTips() {
  const [state, setState] = useState<TipsState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void getPublishedTips(20, 0).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setState({ kind: 'ok', tips: result.tips, total: result.total });
      } else {
        setState({ kind: 'error' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hide entirely when we have nothing to show — keeps the support page
  // tidy pre-launch when there are no approved tips yet.
  if (state.kind === 'loading' || state.kind === 'error') return null;
  if (state.tips.length === 0) return null;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold text-ink-900">
          Tips from the community
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Approved tips shared by other Chem IRL users.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {state.tips.map((tip) => (
          <li
            key={tip.id}
            className="rounded-2xl border border-aqua-100 bg-white p-5"
          >
            <h3 className="text-lg font-semibold text-ink-900">{tip.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm text-ink-700">
              {tip.body}
            </p>
            <p className="mt-3 text-xs text-ink-500">
              {tip.display_name ? `— ${tip.display_name}` : '— Anonymous'}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- Atoms ---------------------------------------------------------------

const inputClasses =
  'w-full rounded-xl border border-aqua-200 px-4 py-3 text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-aqua-500 focus:border-transparent';

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-700">
        {label}
        {required ? ' *' : ''}
      </label>
      {children}
    </div>
  );
}

// --- Per-kind copy -------------------------------------------------------

function subjectLabel(kind: SupportKind): string {
  switch (kind) {
    case 'bug':
      return 'What broke?';
    case 'feature':
      return 'Idea';
    case 'contact':
      return 'What can we help with?';
    case 'tip':
      return 'Tip title';
  }
}

function subjectPlaceholder(kind: SupportKind): string {
  switch (kind) {
    case 'bug':
      return 'Match list crashes when I tap a profile';
    case 'feature':
      return "Let me filter matches by neighbourhood";
    case 'contact':
      return "How do I delete my account?";
    case 'tip':
      return 'How I doubled my reply rate';
  }
}

function bodyLabel(kind: SupportKind): string {
  switch (kind) {
    case 'bug':
      return 'What happened? What did you expect?';
    case 'feature':
      return 'Tell us more — what would change?';
    case 'contact':
      return 'Details';
    case 'tip':
      return 'The tip';
  }
}

function bodyPlaceholder(kind: SupportKind): string {
  switch (kind) {
    case 'bug':
      return 'Steps to reproduce, what you saw, what you expected. Screenshots welcome — just say where you posted them.';
    case 'feature':
      return "What's the situation that made you wish for this?";
    case 'contact':
      return "Type away.";
    case 'tip':
      return "What did you try, and how did it work? Keep it concrete.";
  }
}

function submitLabel(kind: SupportKind): string {
  switch (kind) {
    case 'bug':
      return 'Send bug report';
    case 'feature':
      return 'Send suggestion';
    case 'contact':
      return 'Send message';
    case 'tip':
      return 'Share tip';
  }
}

function successHeadline(kind: SupportKind): string {
  switch (kind) {
    case 'bug':
      return "Got it — we're on it.";
    case 'feature':
      return "Got it. Thanks for the idea.";
    case 'contact':
      return "Got it. We'll be in touch.";
    case 'tip':
      return 'Thanks for sharing.';
  }
}

function successBlurb(kind: SupportKind): string {
  switch (kind) {
    case 'bug':
      return "We'll triage it and follow up by email if we need more info.";
    case 'feature':
      return "We read every suggestion. Some land in the next sprint, some don't — but they all help.";
    case 'contact':
      return "Expect an email within a couple of business days.";
    case 'tip':
      return 'We review tips and publish the helpful ones. If we publish yours, your display name (if you gave one) shows next to it — your email never does.';
  }
}

// --- Metadata builder ----------------------------------------------------

function buildMetadata(
  kind: SupportKind,
  fields: { appVersion: string; tipTopic: string; sourceUrl: string },
): SupportMetadata {
  if (kind === 'bug') {
    const m: SupportMetadata = {};
    const v = fields.appVersion.trim();
    if (v) (m as { app_version?: string }).app_version = v;
    return m;
  }
  if (kind === 'tip') {
    const m: SupportMetadata = {};
    const t = fields.tipTopic.trim();
    if (t) (m as { tip_topic?: string }).tip_topic = t;
    const u = fields.sourceUrl.trim();
    if (u) (m as { source_url?: string }).source_url = u;
    return m;
  }
  return {};
}

// --- Errors --------------------------------------------------------------

function humanError(error: string): string {
  switch (error) {
    case 'invalid_email':
      return "That email doesn't look right — and we need it to follow up.";
    case 'disposable_email':
      return 'Use a regular email address — disposable inboxes get filtered.';
    case 'consent_required':
      return 'You need to agree to the privacy policy to send.';
    case 'subject_too_short':
      return 'Add a short title (at least 3 characters).';
    case 'body_too_short':
      return 'Add a few more details (at least 10 characters).';
    case 'rate_limited':
      return "You've sent a lot recently. Try again in an hour.";
    case 'configuration_missing':
      return "The form's misconfigured on our end — we'll fix it. Try again in a few.";
    case 'network_error':
      return 'Network hiccup. Try again in a moment.';
    case 'invalid_json':
    case 'method_not_allowed':
      return 'Something got mangled in transit. Refresh and try again.';
    default:
      return 'Something went wrong on our end. Try again?';
  }
}
