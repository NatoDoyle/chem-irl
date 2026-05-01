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
        <p className="text-ink-500 mb-12">Last updated: March 2026</p>

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
                  <strong>Service providers:</strong> We use third-party
                  services for hosting, analytics, and notifications.
                </li>
                <li>
                  <strong>AI sub-processor (Iris feature, opt-in):</strong> If
                  you choose to use the Iris AI concierge, the contents of your
                  conversations with Iris and a structured summary of what you
                  share are processed by Anthropic, PBC (Claude API). Your
                  matches are not informed when you use Iris, and the matched
                  user&apos;s data is never sent to Anthropic on your behalf.
                  You can decline Iris at signup or stop using it at any time;
                  doing so does not affect any other Chem IRL feature.
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
                time through the app settings.
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
              6. Security
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
              7. Contact Us
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
