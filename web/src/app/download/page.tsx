import { AnimatedSection } from '@/components/AnimatedSection';
import { PhoneMockup } from '@/components/PhoneMockup';
import { WaitlistForm } from '@/components/WaitlistForm';
import { BRAND } from '@/config/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download - Chem IRL',
  description:
    'Download Chem IRL and start meeting people face to face. Available on iOS and Android.',
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
              <p className="text-xl text-ink-500 mb-8">
                Download the app and start meeting people face-to-face.
              </p>

              {/* Store badges */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <a
                  href="#"
                  className="inline-flex items-center gap-3 bg-ink-900 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                  aria-label="Download on the App Store"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-7 h-7 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.81-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83" />
                  </svg>
                  <div className="text-left">
                    <div className="text-xs opacity-80">Download on the</div>
                    <div className="text-base font-semibold -mt-0.5">
                      App Store
                    </div>
                  </div>
                </a>

                <a
                  href="#"
                  className="inline-flex items-center gap-3 bg-ink-900 text-white px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                  aria-label="Get it on Google Play"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="w-7 h-7 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.302-2.302 2.302-2.302zM5.864 2.658L16.8 9.49l-2.302 2.302-8.634-8.634z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-xs opacity-80">Get it on</div>
                    <div className="text-base font-semibold -mt-0.5">
                      Google Play
                    </div>
                  </div>
                </a>
              </div>
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
              2,000+ people on the waitlist
            </p>
            <p className="text-ink-500 text-sm mt-1">
              Be the first to know when we launch in your area.
            </p>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
