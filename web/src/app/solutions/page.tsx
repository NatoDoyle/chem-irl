import type { Metadata } from 'next';
import { AnimatedSection } from '@/components/AnimatedSection';
import { SolutionsInquiryForm } from '@/components/SolutionsInquiryForm';
import { BRAND } from '@/config/brand';

const DESCRIPTION =
  'The AI stack that runs Chem IRL — support inbox, photo safety, and marketing agents — deployed for your business. Every agent action logged, costed, capped, and kill-switchable.';

export const metadata: Metadata = {
  title: 'Solutions - Chem IRL',
  description: DESCRIPTION,
  openGraph: {
    title: 'Chem IRL Solutions',
    description: DESCRIPTION,
    url: `${BRAND.url}/solutions`,
    siteName: BRAND.name,
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chem IRL Solutions',
    description: DESCRIPTION,
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/solutions' },
};

const MODULES: {
  name: string;
  status: 'Runs Chem IRL today' | 'Early access' | 'In development';
  description: string;
  honest: string;
}[] = [
  {
    name: 'AI support inbox',
    status: 'Early access',
    description:
      'Connects to your Gmail or Outlook support mailbox. Reads each message against your knowledge base, drafts a reply with a confidence score, and routes it to your review queue. Auto-send only when you turn it on, above a threshold you set.',
    honest:
      'Multi-tenant, isolation-tested, human-review-first. Chem IRL is deployment #1.',
  },
  {
    name: 'Photo Safety API',
    status: 'Early access',
    description:
      'One API call grades a user photo across 8 policy categories — approved, review, or blocked — with the decision rules applied deterministically in code, not just model vibes. A second op checks whether a selfie and a profile photo show the same person.',
    honest:
      'LLM-vision moderation and identity-consistency checking. Not biometric identification, not liveness detection — we say what it is.',
  },
  {
    name: 'Autonomous marketing seat',
    status: 'Runs Chem IRL today',
    description:
      'A managed marketing agent on infrastructure dedicated to you: listens to your channels, drafts content in your voice, publishes through a credential-free pipeline your CI controls, and reports what it did and what it cost — weekly, in plain language.',
    honest:
      'This is the agent that runs Chem IRL’s own marketing. Single-tenant by design: your brand pack, your server, your kill switch.',
  },
  {
    name: 'Outbound drafting',
    status: 'In development',
    description:
      'Sources and qualifies leads, then drafts outreach for your team to send from your own accounts. Draft-only is the product, not a compromise: assist, never autopilot.',
    honest:
      'No automated sending, no scraped-data outreach — platform rules and our model provider’s terms both forbid it, so we built the defensible version.',
  },
  {
    name: 'Staff training',
    status: 'Early access',
    description:
      'Turn your knowledge base into role-based staff training with assignments, renewals, and completion tracking — and feed what your team learns back into the same knowledge the support agent answers from.',
    honest: 'Built for hospitality teams first; same workspace, same governance.',
  },
];

export default function SolutionsPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-28 pb-16 px-4 bg-gradient-to-br from-warm-bg to-[#FFF5EB]">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block bg-gold-50 text-gold-700 border border-gold-200 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            Early access — three founding partner slots
          </span>
          <h1 className="text-4xl md:text-6xl font-bold text-ink-900 mb-6 leading-tight">
            The AI stack that runs Chem IRL.
            <br />
            Deployed for your business.
          </h1>
          <p className="text-xl text-ink-700 max-w-2xl mx-auto">
            We built agents to run our own support, marketing, and photo safety —
            then made them deployable for yours. Chem IRL is tenant #1: we sell
            what we run.
          </p>
        </div>
      </section>

      {/* Governance strip */}
      <section className="py-10 px-4 bg-ink-900">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-lg md:text-xl font-semibold text-white">
            Every agent action logged, costed, capped, and kill-switchable.
          </p>
          <p className="text-ink-300 mt-2">
            Autonomy is earned in levels, not assumed. Humans review by default;
            you decide when the training wheels come off.
          </p>
        </div>
      </section>

      {/* Modules */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl md:text-4xl font-bold text-ink-900 text-center mb-12">
              The modules
            </h2>
          </AnimatedSection>
          <div className="grid gap-6 md:grid-cols-2">
            {MODULES.map((module) => (
              <AnimatedSection key={module.name}>
                <div className="h-full rounded-2xl border border-aqua-200 bg-white p-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-semibold text-ink-900">{module.name}</h3>
                    <span
                      className={
                        module.status === 'Runs Chem IRL today'
                          ? 'shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-aqua-600 text-white'
                          : module.status === 'Early access'
                            ? 'shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-gold-50 text-gold-700 border border-gold-200'
                            : 'shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-ink-100 text-ink-600'
                      }
                    >
                      {module.status}
                    </span>
                  </div>
                  <p className="text-ink-700">{module.description}</p>
                  <p className="text-sm text-ink-500 border-l-2 border-aqua-300 pl-3">
                    {module.honest}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
          <p className="text-center text-sm text-ink-500 mt-8">
            Product demos run on sample data until our tenants approve sharing
            real numbers. We don&apos;t pitch metrics that don&apos;t exist yet.
          </p>
        </div>
      </section>

      {/* Why us */}
      <section className="py-16 px-4 bg-warm-bg">
        <div className="max-w-4xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-ink-900 text-center mb-10">
              Why buy agents from a dating app?
            </h2>
          </AnimatedSection>
          <div className="grid gap-6 md:grid-cols-3">
            <AnimatedSection>
              <div className="text-center px-2">
                <p className="font-semibold text-ink-900 mb-2">We run on it</p>
                <p className="text-ink-700 text-sm">
                  Our support inbox, marketing, and photo moderation run on these
                  exact modules. When they break, they break on us first.
                </p>
              </div>
            </AnimatedSection>
            <AnimatedSection>
              <div className="text-center px-2">
                <p className="font-semibold text-ink-900 mb-2">Governance first</p>
                <p className="text-ink-700 text-sm">
                  Trust-and-safety DNA: audit logs, spend governors, confidence
                  thresholds, and escalation to humans are the spine, not add-ons.
                </p>
              </div>
            </AnimatedSection>
            <AnimatedSection>
              <div className="text-center px-2">
                <p className="font-semibold text-ink-900 mb-2">Founder-direct</p>
                <p className="text-ink-700 text-sm">
                  Founding partners work directly with the person who built and
                  operates the stack. Slots are limited to three for a reason.
                </p>
              </div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* Inquiry */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <AnimatedSection>
            <h2 className="text-3xl font-bold text-ink-900 text-center mb-3">
              Request early access
            </h2>
            <p className="text-ink-700 text-center mb-10">
              Tell us what you&apos;d point the stack at. Replies within 48 hours.
            </p>
          </AnimatedSection>
          <AnimatedSection>
            <SolutionsInquiryForm />
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
