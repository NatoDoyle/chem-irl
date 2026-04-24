'use client';

import { motion } from 'framer-motion';
import { BRAND } from '@/config/brand';
import { AnimatedSection } from '@/components/AnimatedSection';
import { PhoneMockup } from '@/components/PhoneMockup';

const STEPS = [
  {
    number: '01',
    title: 'Like to Match',
    description:
      'Swipe right on profiles you\'re interested in. When you both like each other, you match instantly.',
  },
  {
    number: '02',
    title: 'Propose 2–3 Times',
    description:
      'Suggest 2–3 specific times within the next 7 days. Add a date type and a short note.',
  },
  {
    number: '03',
    title: 'They Confirm',
    description:
      'One tap to confirm a time, or suggest alternatives. No back-and-forth texting.',
  },
  {
    number: '04',
    title: 'Meet & Mark',
    description:
      'Chat unlocks after confirm. Meet in person. Mark that you went.',
  },
];

const FEATURES = [
  {
    title: '72-Hour Rule',
    description:
      'Proposals expire in 72 hours. No endless texting. No ghosting into oblivion.',
  },
  {
    title: 'Structured Proposals',
    description:
      'Exactly 2–3 times within 7 days. No vague "maybe this weekend" plans.',
  },
  {
    title: 'Action Rewarded',
    description:
      'Your Speed score rises when you follow through. Better scores mean better visibility.',
  },
];

export default function Home() {
  return (
    <>
      {/* Hero Section — split layout */}
      <section className="pt-28 pb-20 px-4 overflow-hidden bg-gradient-to-br from-warm-bg to-[#FFF5EB]">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-8">
          {/* Left 55% */}
          <motion.div
            className="flex-1 lg:max-w-[55%]"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-block bg-gold-50 text-gold-700 border border-gold-200 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              Dating, but make it happen
            </span>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-ink-900 mb-6 leading-tight">
              Less texting.
              <br className="hidden sm:block" />
              More{' '}
              <span className="relative inline-block">
                chemistry.
                <svg
                  className="absolute -bottom-2 left-0 w-full h-3"
                  viewBox="0 0 240 12"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8C40 2 80 12 120 6C160 0 200 10 238 4"
                    stroke="#0B9A8D"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="text-xl text-ink-500 mb-8 max-w-lg">
              {BRAND.description} {BRAND.name} gets you from match to meeting in
              days, not weeks.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="/download"
                className="inline-flex items-center justify-center bg-aqua-600 hover:bg-aqua-700 text-white font-semibold py-4 px-8 rounded-brand text-lg transition-colors"
              >
                Join the Waitlist
              </a>
              <a
                href="/how-it-works"
                className="inline-flex items-center justify-center text-aqua-600 hover:text-aqua-700 font-semibold py-4 px-4 text-lg transition-colors gap-2"
              >
                How It Works
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 5l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 mt-10">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-aqua-200 border-2 border-white" />
                <div className="w-8 h-8 rounded-full bg-coral border-2 border-white" />
                <div className="w-8 h-8 rounded-full bg-aqua-400 border-2 border-white" />
                <div className="w-8 h-8 rounded-full bg-aqua-600 border-2 border-white" />
              </div>
              <p className="text-sm text-ink-500">
                Join 2,000+ on the waitlist
              </p>
            </div>
          </motion.div>

          {/* Right 45% — phone + floating cards */}
          <motion.div
            className="flex-1 lg:max-w-[45%] relative flex justify-center"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <PhoneMockup>
              <div className="w-full h-full bg-gradient-to-br from-aqua-100 via-aqua-200 to-aqua-300" />
            </PhoneMockup>

            {/* Floating UI cards */}
            <motion.div
              className="absolute -right-2 md:-right-12 top-16 bg-white rounded-brand p-3 shadow-subtle z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 0.8 }}
            >
              <p className="text-sm font-semibold text-ink-900">
                Date confirmed
              </p>
              <p className="text-xs text-ink-500">Tomorrow, 7pm</p>
            </motion.div>

            <motion.div
              className="absolute -left-2 md:-left-16 bottom-28 bg-white rounded-brand p-3 shadow-subtle z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 1.0 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-aqua-500" />
                <p className="text-sm font-semibold text-ink-900">
                  3 times proposed
                </p>
              </div>
            </motion.div>

            <motion.div
              className="absolute left-0 md:-left-8 top-36 bg-aqua-50 rounded-brand px-3 py-2 shadow-subtle z-10"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', delay: 1.2 }}
            >
              <p className="text-xs font-medium text-aqua-700">
                Meet in 2 days
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* How It Works — zig-zag */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-4xl font-bold text-ink-900 text-center mb-16">
              How It Works
            </h2>
          </AnimatedSection>

          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div key={step.number}>
                <AnimatedSection
                  direction={i % 2 === 0 ? 'left' : 'right'}
                  delay={i * 0.1}
                >
                  <div
                    className={`flex flex-col md:flex-row ${i % 2 === 1 ? 'md:flex-row-reverse' : ''} gap-8 md:gap-12 items-center`}
                  >
                    <div className="flex-1 relative">
                      <span className="font-mono text-7xl md:text-8xl font-bold text-aqua-100 absolute -top-6 -left-2 select-none">
                        {step.number}
                      </span>
                      <div className="relative pt-8 pl-2">
                        <h3 className="text-2xl font-bold text-ink-900 mb-3">
                          {step.title}
                        </h3>
                        <p className="text-lg text-ink-500">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="bg-aqua-50 rounded-brand p-12 aspect-[4/3] flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-aqua-200 flex items-center justify-center">
                          <span className="text-2xl font-bold text-aqua-700">
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
        </div>
      </section>

      {/* Feature Cards — offset layout */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-4xl font-bold text-ink-900 text-center mb-16">
              Why {BRAND.name}?
            </h2>
          </AnimatedSection>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {FEATURES.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 0.15}>
                <div
                  className={`group bg-white rounded-brand p-8 shadow-warm hover:shadow-warm-lg transition-all duration-300 ${i === 1 ? 'md:-mt-5' : ''}`}
                >
                  <div className="h-1 bg-gradient-to-r from-coral to-gold-600 rounded-full mb-6 group-hover:h-1.5 transition-all" />
                  <h3 className="text-xl font-bold text-ink-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-ink-500">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="py-20 px-4 bg-gradient-to-r from-aqua-600 to-aqua-700">
        <AnimatedSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to test chemistry IRL?
            </h2>
            <p className="text-aqua-100 text-lg mb-8">
              Stop texting. Start meeting. Join the waitlist today.
            </p>
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
