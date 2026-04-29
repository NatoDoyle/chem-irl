import { AnimatedSection } from '@/components/AnimatedSection';
import { PhoneMockup } from '@/components/PhoneMockup';
import { PhoneScreens } from '@/components/PhoneScreens';
import { WaitlistCounter } from '@/components/WaitlistCounter';
import { WaitlistForm } from '@/components/WaitlistForm';
import { BRAND } from '@/config/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the Dublin beta - Chem IRL',
  description:
    'Chem IRL is launching in Dublin. Join the iOS and Android waitlist — match → meet in days, not weeks.',
  openGraph: {
    title: 'Join the Dublin beta - Chem IRL',
    description:
      'Chem IRL is launching in Dublin. Join the iOS and Android waitlist — match → meet in days, not weeks.',
    url: 'https://chemirl.app/download',
    siteName: 'Chem IRL',
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join the Dublin beta - Chem IRL',
    description:
      'Chem IRL is launching in Dublin. Join the iOS and Android waitlist — match → meet in days, not weeks.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/download' },
};

const POST_SIGNUP_STEPS = [
  {
    n: '01',
    title: 'Drop your email',
    body: 'Takes 10 seconds. Optional name, age and gender just help us balance the early Dublin cohort.',
  },
  {
    n: '02',
    title: 'Confirm by email',
    body: 'Tap the link in the message we send. That moves you into the confirmed cohort and locks your spot.',
  },
  {
    n: '03',
    title: 'Get the invite',
    body: 'When the Dublin beta opens we email you a TestFlight or Play Store link. Confirmed first, in order of signup.',
  },
];

const DIFFERENTIATORS = [
  {
    title: '72-hour rule',
    body: 'Proposals expire in 72 hours. No three-week text limbo, no slow-fade ghosting.',
  },
  {
    title: 'Structured proposals',
    body: 'Pick 2–3 specific times within 7 days. No vague "maybe next weekend" plans that quietly die.',
  },
  {
    title: 'Action rewarded',
    body: 'Your Speed score rises when you actually meet. Better visibility for people who follow through.',
  },
];

export default function DownloadPage() {
  return (
    <>
      {/* Hero — form + phone, side by side on desktop */}
      <section
        id="join"
        className="overflow-hidden bg-gradient-to-br from-warm-bg to-[#FFF5EB] px-4 pt-28 pb-20"
      >
        <div className="mx-auto flex max-w-6xl flex-col-reverse items-center gap-12 lg:flex-row lg:items-start lg:gap-12">
          <AnimatedSection direction="left" className="flex-1 lg:max-w-[55%]">
            <span className="mb-6 inline-block rounded-full border border-gold-200 bg-gold-50 px-4 py-1.5 text-sm font-medium text-gold-700">
              Dublin beta · iOS + Android
            </span>

            <h1 className="mb-5 text-4xl font-bold leading-tight text-ink-900 md:text-5xl lg:text-6xl">
              Match{' '}
              <span className="inline-block text-aqua-600">&rarr;</span> Meet in
              days, not weeks.
            </h1>

            <p className="mb-8 max-w-xl text-lg text-ink-500 md:text-xl">
              {BRAND.name}  is launching in Dublin. Drop your email below and
              we&rsquo;ll send a confirmation link to lock in your spot for the
              iOS and Android beta.
            </p>

            <div className="rounded-brand bg-white p-6 shadow-warm md:p-8">
              <WaitlistForm />
            </div>

            <div className="mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="h-8 w-8 rounded-full border-2 border-white bg-aqua-200" />
                <div className="h-8 w-8 rounded-full border-2 border-white bg-coral" />
                <div className="h-8 w-8 rounded-full border-2 border-white bg-aqua-400" />
                <div className="h-8 w-8 rounded-full border-2 border-white bg-aqua-600" />
              </div>
              <p className="text-sm text-ink-500">
                <WaitlistCounter />
              </p>
            </div>
          </AnimatedSection>

          <AnimatedSection
            direction="right"
            delay={0.2}
            className="flex flex-1 justify-center lg:max-w-[45%]"
          >
            <PhoneMockup>
              <PhoneScreens />
            </PhoneMockup>
          </AnimatedSection>
        </div>
      </section>

      {/* What happens after you sign up */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection>
            <h2 className="mb-3 text-center text-3xl font-bold text-ink-900 md:text-4xl">
              What happens after you sign up
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-ink-500">
              No spam, no waitlist purgatory. Three small steps and you&rsquo;re
              locked in.
            </p>
          </AnimatedSection>

          <div className="grid gap-6 md:grid-cols-3">
            {POST_SIGNUP_STEPS.map((step, i) => (
              <AnimatedSection key={step.n} delay={i * 0.1}>
                <div className="h-full rounded-brand border border-aqua-100 bg-white p-6 shadow-subtle">
                  <span className="font-mono text-sm font-bold text-aqua-700">
                    {step.n}
                  </span>
                  <h3 className="mt-2 mb-2 text-lg font-bold text-ink-900">
                    {step.title}
                  </h3>
                  <p className="text-sm text-ink-500">{step.body}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Why this is different */}
      <section className="bg-white px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <AnimatedSection>
            <h2 className="mb-3 text-center text-3xl font-bold text-ink-900 md:text-4xl">
              Why this isn&rsquo;t another swipe app
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-ink-500">
              Chem IRL is built around a single idea: the chemistry test
              happens in person, not in chat.
            </p>
          </AnimatedSection>

          <div className="grid gap-6 md:grid-cols-3">
            {DIFFERENTIATORS.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 0.1}>
                <div className="h-full rounded-brand bg-warm-bg p-6">
                  <div className="mb-4 h-1 w-12 rounded-full bg-gradient-to-r from-coral to-gold-500" />
                  <h3 className="mb-2 text-lg font-bold text-ink-900">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-ink-700">{feature.body}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Beta availability */}
      <section className="px-4 py-12">
        <AnimatedSection>
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <div className="mb-3 inline-flex items-center gap-2 text-ink-700">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M10 2C6.13 2 3 5.13 3 9c0 5.25 7 11 7 11s7-5.75 7-11c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"
                  fill="currentColor"
                />
              </svg>
              <span className="text-sm font-semibold">
                Currently in beta &mdash; Dublin only
              </span>
            </div>
            <p className="text-sm text-ink-500">
              Available on iOS and Android. More cities coming after the Dublin
              cohort settles in.
            </p>
          </div>
        </AnimatedSection>
      </section>

      {/* Final CTA band */}
      <section className="px-4 py-20">
        <AnimatedSection>
          <div
            className="mx-auto max-w-4xl rounded-brand px-8 py-14 text-center text-white shadow-warm-lg"
            style={{
              background: 'linear-gradient(135deg, #0A7F74 0%, #0B9A8D 100%)',
            }}
          >
            <h2 className="mb-3 text-3xl font-bold md:text-4xl">
              Dublin first. Are you in?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-white/90">
              Join the waitlist and we&rsquo;ll email you a confirmation link
              in seconds.
            </p>
            <a
              href="#join"
              className="inline-flex items-center justify-center rounded-brand bg-white px-8 py-4 text-lg font-semibold text-aqua-700 transition-colors hover:bg-aqua-50"
            >
              Scroll back &amp; sign up
            </a>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
