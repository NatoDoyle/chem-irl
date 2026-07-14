import { BRAND } from '@/config/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - Chem IRL',
  description:
    'Chem IRL privacy policy. Learn how we collect, use, and protect your data.',
  openGraph: {
    title: 'Privacy Policy - Chem IRL',
    description:
      'Chem IRL privacy policy. Learn how we collect, use, and protect your data.',
    url: 'https://chemirl.app/privacy',
    siteName: 'Chem IRL',
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Privacy Policy - Chem IRL',
    description:
      'Chem IRL privacy policy. Learn how we collect, use, and protect your data.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-ink-900 mb-2">
          Privacy Policy
        </h1>
        <p className="text-ink-500 mb-12">Last updated: July 2026</p>

        <div className="space-y-10">
          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              1. Information We Collect
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>
                We collect information you provide directly when you create an
                account, build your profile, and use {BRAND.name}.
              </p>
              <h3 className="text-lg font-semibold text-ink-900 pt-2">
                Account Information
              </h3>
              <p>
                When you register, we collect your name, email address, date of
                birth, and phone number.
              </p>
              <h3 className="text-lg font-semibold text-ink-900 pt-2">
                Profile Information
              </h3>
              <p>
                Information you add to your profile including photos, bio,
                interests, and preferences.
              </p>
              <h3 className="text-lg font-semibold text-ink-900 pt-2">
                Usage Data
              </h3>
              <p>
                We collect data about how you use our services, including
                interactions, proposals, and meeting confirmations.
              </p>
              <h3 className="text-lg font-semibold text-ink-900 pt-2">
                Location Data
              </h3>
              <p>
                With your permission, we collect your location to show you
                nearby users and suggest venues.
              </p>
              <h3 className="text-lg font-semibold text-ink-900 pt-2">
                Diagnostics and Error Reports
              </h3>
              <p>
                To keep the app working we record technical events &mdash;
                which screen or server function ran, whether it succeeded,
                how long it took, and, when something breaks, the error type
                and message. Error messages are stripped of personal
                information <em>on your device</em> before they are sent:
                message contents, email addresses, phone numbers and photo
                links are removed or replaced with a one-way hash. We do not
                collect stack traces or device identifiers, and we do not use
                any advertising or third-party tracking SDK. These events are
                linked to your account&rsquo;s internal ID (a random UUID, not
                your name or email) so we can tell one user&rsquo;s failure
                from another&rsquo;s.
              </p>
              <h3 className="text-lg font-semibold text-ink-900 pt-2">
                Support Submissions
              </h3>
              <p>
                When you submit a bug report, feature request, contact
                message, or community tip via{' '}
                <a href="/support" className="underline">
                  /support
                </a>
                , we collect the submission text, your email address (when
                provided), an optional display name, and an IP-derived hash
                used solely for abuse prevention. Tips you choose to share
                publicly are reviewed and may be edited and published with
                only your display name shown alongside &mdash; your email and
                IP-derived hash are never published.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              2. How We Use Your Information
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>
                  Match you with other users based on your preferences
                </li>
                <li>Process proposals and meeting arrangements</li>
                <li>
                  Send you notifications about matches, proposals, and
                  confirmations
                </li>
                <li>Ensure safety and prevent fraud</li>
                <li>
                  Communicate with you about your account and our services
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              3. How We Share Your Information
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>
                We do not sell your personal information. We may share your
                information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>With other users:</strong> Your profile information is
                  visible to other users as part of the service.
                </li>
                <li>
                  <strong>Service providers:</strong> We use a small number of
                  processors to run the service: <strong>Supabase</strong>{' '}
                  (database and file hosting, EU region),{' '}
                  <strong>Resend</strong> (transactional email),{' '}
                  <strong>Expo</strong> (push-notification delivery),{' '}
                  <strong>Bronto</strong> (the diagnostics and error events
                  described above), and <strong>Apple</strong> and{' '}
                  <strong>Google</strong> (in-app purchases and receipt
                  verification). They act on our instructions and may not use
                  your data for their own purposes.
                </li>
                <li>
                  <strong>AI sub-processor (Iris feature, opt-in):</strong> If
                  you choose to use the Iris AI concierge, the contents of your
                  conversations with Iris and a structured summary of what you
                  share are processed by Anthropic, PBC (Claude API). Anthropic
                  retains API request data for up to 30 days for trust and
                  safety review per its{' '}
                  <a
                    href="https://www.anthropic.com/legal/privacy"
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    privacy policy
                  </a>
                  ; we do not authorize Anthropic to use your data to train
                  models. Your matches are not informed when you use Iris, and
                  the matched user&apos;s data is never sent to Anthropic on
                  your behalf. You can decline Iris at signup, stop using it
                  at any time, and request erasure of your Iris conversations
                  and memory through Profile &rarr; Iris &rarr; &ldquo;Delete
                  my Iris data.&rdquo; Doing so does not affect any other
                  Chem IRL feature.
                </li>
                <li>
                  <strong>Legal requirements:</strong> We may share information
                  if required by law or to protect safety.
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              4. Data Retention
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>
                We retain your information for as long as your account is
                active. You can request deletion of your account and data at any
                time through the app settings. Deleting your account removes
                your profile, photos, messages, matches and activity history
                from our database immediately.
              </p>
              <p>
                Two things deliberately outlive an account, and neither
                contains information that identifies you: a one-way hash used
                to enforce bans (so someone removed for abuse cannot simply
                sign up again), and diagnostic events already sent to our
                error-monitoring provider, which are keyed to a random
                internal ID and expire on that provider&rsquo;s retention
                schedule.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              5. Your Rights
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>
                Under GDPR and applicable data protection laws, you have the
                right to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Request data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              6. How Matching Decides Who You See
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>
                {BRAND.name} ranks the profiles in your feed, and you are
                ranked in other people&rsquo;s. You have a right to know how,
                so here it is in plain terms. Three scores are computed from
                your behaviour over the <strong>last 60 days</strong> and
                combined into one number:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Follow-through (60% of the weight)</strong> &mdash;
                  how quickly you propose a time after matching, how quickly
                  you answer someone else&rsquo;s proposal, and whether you
                  actually show up. Letting proposals expire or letting a
                  match go stale counts against you.
                </li>
                <li>
                  <strong>How others respond to you (30%)</strong> &mdash; the
                  share of people who like your profile after seeing it, plus
                  post-date &ldquo;would meet again&rdquo; feedback.
                </li>
                <li>
                  <strong>Reliability (10%)</strong> &mdash; a follow-through
                  and safety record: dates attended and positive feedback
                  raise it; cancellations and upheld reports lower it.
                </li>
              </ul>
              <p>
                Everyone starts at a neutral score, and because the window
                rolls, a bad fortnight fades. We rank on{' '}
                <strong>behaviour only</strong>. We do not rank you on your
                sexual orientation, gender, race, photos, age or any other
                personal characteristic, and{' '}
                <strong>
                  paying for Chem+ or tokens does not buy you a better
                  position
                </strong>{' '}
                &mdash; it never enters the calculation. This ranking is not
                automated decision-making with legal or similarly significant
                effects under Article 22: it changes the order profiles appear
                in, nothing else. If you think your score is wrong, contact us
                and a human will look at it.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              7. Security
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>
                We implement appropriate technical and organizational measures
                to protect your personal data against unauthorized access,
                alteration, disclosure, or destruction.
              </p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-ink-900 mb-4">
              8. Contact Us
            </h2>
            <div className="space-y-3 text-ink-700">
              <p>
                If you have questions about this privacy policy or your data,
                contact us at privacy@chemirl.app.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
