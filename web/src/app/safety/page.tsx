import { AnimatedSection } from '@/components/AnimatedSection';
import { BRAND } from '@/config/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Safety - Chem IRL',
  description:
    'Learn about safety features built into Chem IRL: reporting, verification, moderation, and more.',
  openGraph: {
    title: 'Safety - Chem IRL',
    description:
      'Learn about safety features built into Chem IRL: reporting, verification, moderation, and more.',
    url: 'https://chemirl.app/safety',
    siteName: 'Chem IRL',
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Safety - Chem IRL',
    description:
      'Learn about safety features built into Chem IRL: reporting, verification, moderation, and more.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/safety' },
};

const SAFETY_FEATURES = [
  {
    title: 'Report Tools',
    description:
      'One-tap reporting for inappropriate behavior. Every report is reviewed by our team.',
  },
  {
    title: 'Profile Verification',
    description:
      'Photo verification to confirm you are who you say you are. Verified profiles get better visibility.',
  },
  {
    title: 'Moderation Timers',
    description:
      'Visible response timers on reports. We commit to reviewing reports within 24 hours.',
  },
  {
    title: 'Block & Unmatch',
    description:
      'Instantly block or unmatch anyone. Blocked users cannot see your profile or contact you.',
  },
  {
    title: 'Meeting Safety',
    description:
      'First-date types and public venue suggestions built into the proposal flow.',
  },
  {
    title: 'Data Privacy',
    description:
      'Your data is encrypted and never sold. You control what information is visible on your profile.',
  },
];

const MODERATION_STEPS = [
  {
    title: 'Report Submitted',
    description:
      'User submits a report with one tap. Additional details are optional.',
  },
  {
    title: 'Team Review',
    description: 'Our moderation team reviews the report within 24 hours.',
  },
  {
    title: 'Action Taken',
    description:
      'Appropriate action is taken: warning, suspension, or ban.',
  },
  {
    title: 'Reporter Notified',
    description:
      'You receive confirmation that your report was reviewed and resolved.',
  },
];

const SAFETY_TIPS = [
  'Always meet in a public place for your first date.',
  'Tell a friend where you\u2019re going and who you\u2019re meeting.',
  'Trust your instincts \u2014 if something feels off, leave.',
  'Never share financial information or send money to someone you haven\u2019t met.',
  'Use the in-app features to verify your match before meeting.',
];

export default function SafetyPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink-900 mb-6">
              Your safety is built in
            </h1>
            <p className="text-xl text-ink-500 max-w-2xl mx-auto">
              {BRAND.name} is designed with safety at every step, from matching
              to meeting.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {SAFETY_FEATURES.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 0.1}>
                <div className="bg-white rounded-brand p-8 shadow-warm h-full">
                  <h3 className="text-lg font-bold text-ink-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-ink-500">{feature.description}</p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* How We Moderate — timeline */}
      <section className="py-20 px-4 bg-aqua-50">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-ink-900 text-center mb-16">
              How We Moderate
            </h2>
          </AnimatedSection>

          <div className="space-y-0">
            {MODERATION_STEPS.map((step, i) => (
              <AnimatedSection key={step.title} delay={i * 0.15}>
                <div className="flex gap-6 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-aqua-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {i + 1}
                    </div>
                    {i < MODERATION_STEPS.length - 1 && (
                      <div className="w-px h-12 bg-aqua-200 my-2" />
                    )}
                  </div>
                  <div className="pb-8">
                    <h3 className="font-bold text-ink-900 mb-1">
                      {step.title}
                    </h3>
                    <p className="text-ink-500">{step.description}</p>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Safety Tips */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-ink-900 text-center mb-12">
              Safety Tips
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <div className="bg-white rounded-brand p-8 shadow-warm">
              <ul className="space-y-4">
                {SAFETY_TIPS.map((tip, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-aqua-100 flex items-center justify-center shrink-0 mt-0.5">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="#0A7F74"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <span className="text-ink-700">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Emergency Resources */}
      <section className="py-16 px-4">
        <AnimatedSection>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              Need Immediate Help?
            </h2>
            <p className="text-ink-500 mb-6">
              If you are in immediate danger, contact your local emergency
              services.
            </p>
            <a
              href="tel:999"
              className="inline-flex items-center justify-center bg-red-600 text-white font-semibold py-3 px-6 rounded-brand transition-colors hover:bg-red-700"
            >
              Emergency: 999 / 112
            </a>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
