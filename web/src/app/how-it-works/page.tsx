import { AnimatedSection } from '@/components/AnimatedSection';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works - Chem IRL',
  description:
    'Get from match to meeting in days, not weeks. Learn how Chem IRL works.',
  openGraph: {
    title: 'How It Works - Chem IRL',
    description:
      'Get from match to meeting in days, not weeks. Learn how Chem IRL works.',
    url: 'https://chemirl.app/how-it-works',
    siteName: 'Chem IRL',
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works - Chem IRL',
    description:
      'Get from match to meeting in days, not weeks. Learn how Chem IRL works.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/how-it-works' },
};

const STEPS = [
  {
    number: '01',
    title: 'Like to Match',
    description:
      'Browse profiles and swipe right on people you\'d like to meet.',
    detail:
      'When you both like each other, you match instantly. Our discovery feed shows you people based on your preferences and proximity \u2014 no algorithms hiding profiles behind paywalls.',
  },
  {
    number: '02',
    title: 'Propose 2\u20133 Times',
    description:
      'Once matched, propose exactly 2\u20133 specific meeting times within the next 7 days.',
    detail:
      'Pick a date type \u2014 coffee, drinks, a walk \u2014 and add a one-line note. Structured proposals eliminate the \u201cso what are you up to this weekend\u201d back-and-forth that kills momentum.',
  },
  {
    number: '03',
    title: 'They Confirm',
    description:
      'Your match taps to confirm one of your proposed times, or counters with 2\u20133 alternatives.',
    detail:
      'Proposals expire after 72 hours. No response? The match moves on. This keeps things moving and respects everyone\u2019s time. No ghosting into oblivion.',
  },
  {
    number: '04',
    title: 'Meet & Mark',
    description:
      'Chat unlocks once a time is confirmed. Meet in person. Mark that you went.',
    detail:
      'After meeting, both people mark whether the date happened. Your Speed score reflects how often you follow through \u2014 better scores mean better visibility in discovery.',
  },
];

const DIFFERENTIATORS = [
  {
    title: '72-Hour Rule',
    description:
      'Proposals expire in 72 hours. No endless texting. No ghosting into oblivion. Either you meet or you move on.',
  },
  {
    title: 'Structured Proposals',
    description:
      'Exactly 2\u20133 times within 7 days. No vague \u201cmaybe this weekend\u201d plans. Specificity creates commitment.',
  },
  {
    title: 'Receiver-Paid Reopen',
    description:
      'Expired? The receiver can reopen with credits and propose their own times. A fair system that rewards action.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink-900 mb-6">
              How It Works
            </h1>
            <p className="text-xl text-ink-500 max-w-2xl mx-auto">
              Get from match to meeting in days, not weeks. Here&apos;s how Chem
              IRL makes it happen.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Steps — zig-zag layout */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto space-y-8">
          {STEPS.map((step, i) => (
            <div key={step.number}>
              <AnimatedSection
                direction={i % 2 === 0 ? 'left' : 'right'}
                delay={i * 0.1}
              >
                <div
                  className={`flex flex-col md:flex-row ${i % 2 === 1 ? 'md:flex-row-reverse' : ''} gap-8 md:gap-16 items-center`}
                >
                  <div className="flex-1 relative">
                    <span className="font-mono text-7xl md:text-8xl font-bold text-aqua-100 absolute -top-6 -left-2 select-none">
                      {step.number}
                    </span>
                    <div className="relative pt-8 pl-2">
                      <h2 className="text-2xl md:text-3xl font-bold text-ink-900 mb-4">
                        {step.title}
                      </h2>
                      <p className="text-lg text-ink-700 mb-3">
                        {step.description}
                      </p>
                      <p className="text-ink-500">{step.detail}</p>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="bg-aqua-50 rounded-brand p-12 aspect-[4/3] flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-aqua-200 flex items-center justify-center">
                        <span className="text-3xl font-bold text-aqua-700">
                          {i + 1}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedSection>

              {i < STEPS.length - 1 && (
                <div className="hidden md:flex justify-center my-4">
                  <div className="w-px h-16 border-l-2 border-dashed border-aqua-200" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-4xl font-bold text-ink-900 text-center mb-16">
              What Makes Us Different
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8">
            {DIFFERENTIATORS.map((item, i) => (
              <AnimatedSection key={item.title} delay={i * 0.15}>
                <div className="group bg-white rounded-brand p-8 shadow-warm hover:shadow-warm-lg transition-all duration-300">
                  <div className="h-1 bg-gradient-to-r from-aqua-400 to-aqua-600 rounded-full mb-6 group-hover:h-1.5 transition-all" />
                  <h3 className="text-xl font-bold text-ink-900 mb-3">
                    {item.title}
                  </h3>
                  <p className="text-ink-500">{item.description}</p>
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
              Ready to get started?
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
