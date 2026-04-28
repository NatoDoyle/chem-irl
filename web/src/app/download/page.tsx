import { AnimatedSection } from '@/components/AnimatedSection';
import { PhoneMockup } from '@/components/PhoneMockup';
import { WaitlistCounter } from '@/components/WaitlistCounter';
import { WaitlistForm } from '@/components/WaitlistForm';
import { BRAND } from '@/config/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download - Chem IRL',
  description:
    'Chem IRL is opening in Dublin first. Join the waitlist for the iOS and Android beta.',
};

export default function DownloadPage() {
  return (
    <>
      {/* Hero with phone mockup */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left">
            <AnimatedSection>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink-900 mb-6">
                Get {BRAND.name}
              </h1>
              <p className="text-xl text-ink-500 mb-6">
                We&apos;re opening in Dublin first. Drop your email below to
                lock in your spot for the iOS and Android beta.
              </p>
            </AnimatedSection>
          </div>

          <AnimatedSection
            direction="right"
            delay={0.2}
            className="flex-1 flex justify-center"
          >
            <PhoneMockup />
          </AnimatedSection>
        </div>
      </section>

      {/* Waitlist form */}
      <section className="py-20 px-4">
        <AnimatedSection>
          <div className="max-w-md mx-auto bg-white rounded-brand p-8 shadow-warm">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-ink-900 mb-3">
                Join the Dublin beta
              </h2>
              <p className="text-ink-500">
                We&apos;re opening Chem IRL in Dublin first. Drop your email,
                and we&apos;ll send a confirmation link to lock in your spot.
              </p>
            </div>
            <WaitlistForm />
          </div>
        </AnimatedSection>
      </section>

      {/* Beta availability */}
      <section className="py-16 px-4">
        <AnimatedSection>
          <div className="max-w-2xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 text-ink-500 mb-4">
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
              <span className="text-sm font-medium">
                Currently in beta &mdash; Dublin area
              </span>
            </div>
            <p className="text-ink-500">
              Available on iOS and Android. More cities coming soon.
            </p>
          </div>
        </AnimatedSection>
      </section>

      {/* Social proof */}
      <section className="py-16 px-4">
        <AnimatedSection>
          <div className="max-w-2xl mx-auto text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="flex -space-x-2">
                <div className="w-10 h-10 rounded-full bg-aqua-200 border-2 border-white" />
                <div className="w-10 h-10 rounded-full bg-coral border-2 border-white" />
                <div className="w-10 h-10 rounded-full bg-aqua-400 border-2 border-white" />
                <div className="w-10 h-10 rounded-full bg-aqua-600 border-2 border-white" />
                <div className="w-10 h-10 rounded-full bg-aqua-300 border-2 border-white" />
              </div>
            </div>
            <p className="text-ink-700 font-medium">
              <WaitlistCounter />
            </p>
            <p className="text-ink-500 text-sm mt-1">
              We&apos;ll email you when the Dublin beta opens.
            </p>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
