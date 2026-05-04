import type { Metadata } from 'next';
import { AnimatedSection } from '@/components/AnimatedSection';
import { BRAND, COMMUNITY } from '@/config/brand';
import { PublishedTips, SupportFormPicker } from '@/components/SupportForms';

export const metadata: Metadata = {
  title: 'Support - Chem IRL',
  description:
    'Get help with Chem IRL: report bugs, suggest improvements, ask a question, share a tip, or join the community.',
  openGraph: {
    title: 'Support - Chem IRL',
    description:
      'Get help with Chem IRL: report bugs, suggest improvements, ask a question, share a tip, or join the community.',
    url: `${BRAND.url}/support`,
    siteName: BRAND.name,
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Support - Chem IRL',
    description:
      'Get help with Chem IRL: report bugs, suggest improvements, ask a question, share a tip, or join the community.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/support' },
};

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'How does Chem IRL actually work?',
    answer:
      "When you match with someone, you propose 2–3 specific times to meet within the next 7 days. They pick one. Proposals expire after 72 hours. The product is built around getting from match to date — not endless texting.",
  },
  {
    question: 'Where is Chem IRL available?',
    answer:
      "We're launching in Dublin first. If you're in Dublin (or near it), you can join the waitlist on the Download page. We'll roll out to other cities as we have the density to make matches feel useful, not lonely.",
  },
  {
    question: 'Why do I need to verify my photo?',
    answer:
      "Photo verification is the single biggest lever for safety and trust. Verified profiles get better visibility and only see other verified profiles in some flows. The verification photo itself is never shown publicly.",
  },
  {
    question: 'How do I delete my account?',
    answer:
      "From the Profile tab, scroll to the bottom and tap 'Delete account.' This permanently removes your profile, matches, and messages. If you're on the waitlist (not in the app yet), use the form below — pick 'Ask a question' and tell us your email.",
  },
  {
    question: "What does the proposal expiry actually do?",
    answer:
      "If your match doesn't pick a time within 72 hours, the proposal expires and the chat closes. No silent fade-outs, no two-week ghost loops. You can re-open and propose again, but the default is closure.",
  },
  {
    question: "I'm a member of the press / a partner — how do I get in touch?",
    answer:
      "Use the contact form below and pick 'Ask a question' — keep the email field accurate and we'll route it to the right person.",
  },
  {
    question: 'How do you handle my data?',
    answer:
      "Encrypted, never sold. Read the Privacy Policy for the specifics — there's a link in the footer.",
  },
];

export default function SupportPage() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-ink-900 mb-6">
              Need help, or have something to share?
            </h1>
            <p className="text-xl text-ink-500 max-w-2xl mx-auto">
              Find an answer below, send us a message, or share what worked
              for you.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* FAQ — wrapped in data-pagefind-body so each Q is searchable from the
          existing global search overlay built at `bun run build` time. */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <AnimatedSection>
            <h2 className="text-2xl md:text-3xl font-bold text-ink-900 mb-8 text-center">
              Common questions
            </h2>
          </AnimatedSection>
          <div data-pagefind-body className="flex flex-col gap-3">
            {FAQ.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-aqua-100 bg-white p-5 open:border-aqua-300"
              >
                <summary className="flex cursor-pointer items-center justify-between text-left text-base font-semibold text-ink-900">
                  <span>{item.question}</span>
                  <span
                    aria-hidden="true"
                    className="ml-4 text-aqua-600 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm text-ink-700 whitespace-pre-line">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Submission form picker */}
      <section className="py-16 px-4 bg-aqua-50">
        <div className="max-w-2xl mx-auto">
          <AnimatedSection>
            <h2 className="text-2xl md:text-3xl font-bold text-ink-900 mb-3 text-center">
              Send us something
            </h2>
            <p className="text-base text-ink-500 text-center mb-8">
              Pick what fits — bug, idea, question, or a tip you want to share.
            </p>
          </AnimatedSection>
          <div className="rounded-3xl bg-white p-6 md:p-8 shadow-warm">
            <SupportFormPicker />
          </div>
        </div>
      </section>

      {/* Published tips (renders nothing if no tips approved yet) */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <PublishedTips />
        </div>
      </section>

      {/* Community + direct contact */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {COMMUNITY.discordUrl ? (
              <div className="rounded-2xl border border-aqua-200 bg-white p-6 shadow-warm">
                <h3 className="text-lg font-semibold text-ink-900">
                  Join the community
                </h3>
                <p className="mt-2 text-sm text-ink-700">
                  Talk to the team and other early users in our Discord —
                  share what&apos;s working, get help, give feedback in real time.
                </p>
                <a
                  href={COMMUNITY.discordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center rounded-xl bg-aqua-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-aqua-700"
                >
                  Open Discord →
                </a>
              </div>
            ) : null}
            <div
              className={`rounded-2xl border border-aqua-200 bg-white p-6 shadow-warm ${
                COMMUNITY.discordUrl ? '' : 'md:col-span-2'
              }`}
            >
              <h3 className="text-lg font-semibold text-ink-900">
                Email us directly
              </h3>
              <p className="mt-2 text-sm text-ink-700">
                Want to talk to the team? Email{' '}
                <a
                  href={`mailto:${COMMUNITY.supportEmail}`}
                  className="font-medium text-aqua-700 underline"
                >
                  {COMMUNITY.supportEmail}
                </a>{' '}
                — we read everything.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
