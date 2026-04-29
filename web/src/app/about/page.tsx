import { AnimatedSection } from '@/components/AnimatedSection';
import { BRAND } from '@/config/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About - Chem IRL',
  description:
    'Our story. Why we built a dating app focused on real-world meetings.',
  openGraph: {
    title: 'About - Chem IRL',
    description:
      'Our story. Why we built a dating app focused on real-world meetings.',
    url: 'https://chemirl.app/about',
    siteName: 'Chem IRL',
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About - Chem IRL',
    description:
      'Our story. Why we built a dating app focused on real-world meetings.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/about' },
};

const VALUES = [
  {
    title: 'Action > Texting',
    description:
      'We believe the best connections happen in person. Our entire product is designed to move you from match to meeting as fast as possible.',
  },
  {
    title: 'Transparency',
    description:
      'Visible timers, clear expiration rules, and honest metrics. You always know where you stand.',
  },
  {
    title: 'Safety First',
    description:
      'Built-in reporting, verification, and moderation timers. We take responsibility for creating a safe space.',
  },
];

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink-900 mb-6">
              Our Story
            </h1>
            <p className="text-xl text-ink-500 max-w-2xl mx-auto">
              We built {BRAND.name} because dating apps forgot their purpose:
              helping people actually meet.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-ink-900 mb-6">
              The Problem With Dating Apps
            </h2>
            <div className="space-y-4 text-lg text-ink-700">
              <p>
                Most dating apps are designed to keep you scrolling, texting, and
                coming back &mdash; not to help you meet someone. Their business
                model rewards engagement, not outcomes.
              </p>
              <p>
                The result? Endless conversations that go nowhere. Matches that
                pile up without a single date. &ldquo;We should hang out
                sometime&rdquo; messages that never turn into plans.
              </p>
              <p>
                We&apos;ve all been there. And we decided to build something
                different.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Our Approach */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-ink-900 mb-6">
              A Different Approach
            </h2>
            <div className="space-y-4 text-lg text-ink-700">
              <p>
                {BRAND.name} is built around one idea: chemistry happens in
                person, not on a screen. Every feature we build asks the same
                question &mdash; does this get two people sitting across from
                each other faster?
              </p>
              <p>
                Structured proposals. 72-hour deadlines. Speed scores that
                reward follow-through. Every mechanic is designed to turn
                matches into meetings within days, not weeks.
              </p>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-4xl font-bold text-ink-900 text-center mb-16">
              What We Believe
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {VALUES.map((value, i) => (
              <AnimatedSection key={value.title} delay={i * 0.15}>
                <div className="bg-white rounded-brand p-8 shadow-warm h-full">
                  <h3 className="text-xl font-bold text-ink-900 mb-3">
                    {value.title}
                  </h3>
                  <p className="text-ink-500">{value.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-aqua-600 to-aqua-700">
        <AnimatedSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Join us in fixing dating
            </h2>
            <a
              href="/download"
              className="inline-flex items-center justify-center bg-white text-aqua-700 font-semibold py-4 px-8 rounded-brand text-lg hover:bg-aqua-50 transition-colors"
            >
              Join the Waitlist
            </a>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
