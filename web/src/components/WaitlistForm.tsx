'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';
import { getStoredUtmParams } from '@/lib/utm';
import {
  getReferrerFirstName,
  submitWaitlistSignup,
  type AgeBand,
  type Gender,
  type WaitlistSignupPayload,
} from '@/lib/waitlist';

// Read ?ref= from the URL once, SSR-safely, without setState-in-effect.
const REF_CODE_RE = /^[a-zA-Z0-9]{6,32}$/;
const noopSubscribe = () => () => {};
function getReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const code = new URL(window.location.href).searchParams.get('ref');
  return code && REF_CODE_RE.test(code) ? code : null;
}
function getServerReferralCode(): null {
  return null;
}

const AGE_BANDS: AgeBand[] = ['18-21', '22-26', '27-31', '32-36', '37-44', '45+'];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'female', label: 'Woman' },
  { value: 'male', label: 'Man' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'error'; message: string };

export function WaitlistForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand | ''>('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [whySignup, setWhySignup] = useState('');
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Pick up ?ref= from the URL via useSyncExternalStore — SSR-safe, no
  // hydration mismatch, no setState-in-effect lint warning.
  const referredByCode = useSyncExternalStore(
    noopSubscribe,
    getReferralCodeFromUrl,
    getServerReferralCode,
  );

  // Look up the referrer's first name when ?ref= is present, so we can
  // show a "[Name] sent you" banner. setState happens only inside the
  // .then() callback — subscribe-style — so no lint warning.
  const [referrerFirstName, setReferrerFirstName] = useState<string | null>(null);
  useEffect(() => {
    if (!referredByCode) return;
    let cancelled = false;
    void getReferrerFirstName(referredByCode).then((result) => {
      if (cancelled) return;
      if (result.success) setReferrerFirstName(result.firstName);
    });
    return () => {
      cancelled = true;
    };
  }, [referredByCode]);

  const submitting = status.kind === 'submitting';

  // Fire `waitlist_form_started` once on first interaction. onFocus on
  // the <form> bubbles from any input, so we don't have to wire this on
  // every field.
  const startedFired = useRef(false);
  function handleFirstFocus() {
    if (startedFired.current) return;
    startedFired.current = true;
    trackEvent('waitlist_form_started');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    setStatus({ kind: 'submitting' });

    const payload: WaitlistSignupPayload = {
      email: email.trim().toLowerCase(),
      first_name: firstName.trim() || undefined,
      age_band: ageBand || undefined,
      gender: gender || undefined,
      why_signup: whySignup.trim() || undefined,
      referred_by_code: referredByCode ?? undefined,
      consent_marketing: consentMarketing,
      consent_privacy: consentPrivacy,
      website: website || undefined,
      // Channel attribution captured on landing (lib/utm.ts) — survives the
      // `/` → `/download` hop via sessionStorage. Spreads nothing when absent.
      ...getStoredUtmParams(),
    };

    const result = await submitWaitlistSignup(payload);

    if (result.success && result.referral_code) {
      trackEvent('waitlist_form_submitted', {
        had_referrer: !!referredByCode,
      });
      router.push(`/waitlist/success?code=${encodeURIComponent(result.referral_code)}`);
      return;
    }
    if (result.success) {
      // Edge case: success without a code (shouldn't happen). Fall through
      // to the error branch with a generic message rather than getting
      // stuck on "submitting".
      setStatus({
        kind: 'error',
        message: 'Signed up, but the response was missing a code. Refresh and try again.',
      });
      return;
    }
    setStatus({ kind: 'error', message: humanError(result.error) });
  }

  return (
    <form
      onSubmit={onSubmit}
      onFocus={handleFirstFocus}
      className="flex flex-col gap-5"
    >
      {referredByCode && (
        <div className="rounded-xl border border-aqua-300 bg-aqua-50 px-4 py-3 text-sm text-ink-900">
          <strong>{referrerFirstName ?? 'A friend'}</strong> sent you their
          Dublin waitlist link. Sign up below and you both move up the list.
        </div>
      )}

      <Field label="Email" htmlFor="wl-email" required>
        <input
          id="wl-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          placeholder="you@example.com"
        />
      </Field>

      <Field label="First name (optional)" htmlFor="wl-first-name">
        <input
          id="wl-first-name"
          name="first_name"
          type="text"
          autoComplete="given-name"
          maxLength={80}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className={inputClasses}
          placeholder="Aoife"
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-700">Age (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map((band) => (
            <Chip
              key={band}
              checked={ageBand === band}
              onChange={() => setAgeBand(ageBand === band ? '' : band)}
              name="age_band"
              value={band}
            >
              {band}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-ink-700">Gender (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <Chip
              key={g.value}
              checked={gender === g.value}
              onChange={() => setGender(gender === g.value ? '' : g.value)}
              name="gender"
              value={g.value}
            >
              {g.label}
            </Chip>
          ))}
        </div>
      </fieldset>

      <Field
        label="What made you sign up? (optional, &le;500 chars)"
        htmlFor="wl-why"
      >
        <textarea
          id="wl-why"
          name="why_signup"
          rows={3}
          maxLength={500}
          value={whySignup}
          onChange={(e) => setWhySignup(e.target.value)}
          className={`${inputClasses} resize-none`}
          placeholder="Tired of texting strangers for three weeks…"
        />
      </Field>

      {/* Honeypot — must stay visually hidden but submittable. Bots fill
          it; real users never see it. */}
      <div className="absolute left-[-10000px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
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
          checked={consentMarketing}
          onChange={(e) => setConsentMarketing(e.target.checked)}
          className="mt-1"
        />
        <span>Email me Chem IRL launch updates for Dublin (optional).</span>
      </label>

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
          .{' '}
          <span className="text-ink-500">(required)</span>
        </span>
      </label>

      {status.kind === 'error' && (
        <p role="alert" className="text-sm font-medium text-coral">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="bg-aqua-600 hover:bg-aqua-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors"
      >
        {submitting ? 'Joining…' : 'Join the waitlist'}
      </button>
    </form>
  );
}

// --- Atoms ----------------------------------------------------------------

const inputClasses =
  'w-full border border-aqua-200 rounded-xl px-4 py-3 text-ink-900 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-aqua-500 focus:border-transparent';

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

function Chip({
  checked,
  onChange,
  name,
  value,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`cursor-pointer select-none rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        checked
          ? 'border-aqua-600 bg-aqua-600 text-white'
          : 'border-aqua-200 bg-white text-ink-700 hover:border-aqua-400'
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        onClick={() => {
          // Allow clicking an already-selected chip to deselect.
          if (checked) onChange();
        }}
        className="sr-only"
      />
      {children}
    </label>
  );
}

// --- Errors ---------------------------------------------------------------

function humanError(error: string): string {
  switch (error) {
    case 'invalid_email':
      return "That email doesn't look right. Try again?";
    case 'consent_required':
      return 'You need to agree to the privacy policy to join.';
    case 'configuration_missing':
      return "The form's misconfigured on our end — we'll fix it. Try again in a few.";
    case 'network_error':
      return 'Network hiccup. Try again in a moment.';
    case 'invalid_json':
      return 'Something got mangled in transit. Refresh and try again.';
    case 'method_not_allowed':
      return "Server didn't accept that. Refresh and try again.";
    default:
      return 'Something went wrong on our end. Try again?';
  }
}
