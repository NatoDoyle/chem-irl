import { BRAND } from '@/config/brand';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - Chem IRL',
  description:
    'Chem IRL terms of service. Read our terms and conditions for using the app.',
  openGraph: {
    title: 'Terms of Service - Chem IRL',
    description:
      'Chem IRL terms of service. Read our terms and conditions for using the app.',
    url: 'https://chemirl.app/terms',
    siteName: 'Chem IRL',
    type: 'website',
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Terms of Service - Chem IRL',
    description:
      'Chem IRL terms of service. Read our terms and conditions for using the app.',
    images: ['/opengraph-image.png'],
  },
  alternates: { canonical: '/terms' },
};

const TOC_SECTIONS = [
  { id: 'eligibility', title: '1. Eligibility' },
  { id: 'account', title: '2. Your Account' },
  { id: 'conduct', title: '3. Acceptable Use' },
  { id: 'proposals', title: '4. Proposals & Meetings' },
  { id: 'content', title: '5. User Content' },
  { id: 'ip', title: '6. Intellectual Property' },
  { id: 'termination', title: '7. Termination' },
  { id: 'liability', title: '8. Limitation of Liability' },
  { id: 'changes', title: '9. Changes to Terms' },
  { id: 'contact', title: '10. Contact' },
];

export default function TermsPage() {
  return (
    <section className="pt-32 pb-20 px-4">
      <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-12">
        {/* TOC sidebar — desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-ink-400 mb-4">
              Contents
            </h2>
            <nav className="space-y-2">
              {TOC_SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block text-sm text-ink-500 hover:text-aqua-600 transition-colors"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 max-w-3xl">
          <h1 className="text-4xl font-bold text-ink-900 mb-2">
            Terms of Service
          </h1>
          <p className="text-ink-500 mb-12">Last updated: March 2026</p>

          <div className="space-y-10">
            <section id="eligibility">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                1. Eligibility
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  You must be at least 18 years old to use {BRAND.name}. By
                  creating an account, you represent that you are at least 18
                  years of age and have the legal capacity to enter into these
                  terms.
                </p>
              </div>
            </section>

            <section id="account">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                2. Your Account
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  You are responsible for maintaining the security of your
                  account credentials. You agree to provide accurate, current,
                  and complete information during registration.
                </p>
                <p>
                  You may not create more than one account per person. We
                  reserve the right to suspend or terminate accounts that
                  violate these terms.
                </p>
              </div>
            </section>

            <section id="conduct">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                3. Acceptable Use
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  You agree to use {BRAND.name} respectfully and in accordance
                  with our community guidelines. You may not:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Harass, bully, or intimidate other users</li>
                  <li>Post false, misleading, or deceptive content</li>
                  <li>
                    Use the service for commercial purposes without
                    authorization
                  </li>
                  <li>
                    Attempt to access other users&apos; accounts
                  </li>
                  <li>
                    Use automated systems to interact with the service
                  </li>
                </ul>
              </div>
            </section>

            <section id="proposals">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                4. Proposals & Meetings
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  {BRAND.name} facilitates meeting proposals between matched
                  users. Proposals require 2&ndash;3 specific times within 7
                  days and expire after 72 hours.
                </p>
                <p>
                  {BRAND.name} is not responsible for the conduct of users
                  during in-person meetings. Users meet at their own risk and
                  should follow our safety guidelines.
                </p>
              </div>
            </section>

            <section id="content">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                5. User Content
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  You retain ownership of content you post to {BRAND.name}. By
                  posting content, you grant us a non-exclusive, royalty-free
                  license to use, display, and distribute your content in
                  connection with the service.
                </p>
                <p>
                  We reserve the right to remove content that violates these
                  terms or our community guidelines.
                </p>
              </div>
            </section>

            <section id="ip">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                6. Intellectual Property
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  The {BRAND.name} name, logo, and all related trademarks,
                  service marks, and branding are our property. You may not use
                  our intellectual property without express written permission.
                </p>
              </div>
            </section>

            <section id="termination">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                7. Termination
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  You may delete your account at any time through the app
                  settings. We may suspend or terminate your account if you
                  violate these terms.
                </p>
              </div>
            </section>

            <section id="liability">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                8. Limitation of Liability
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  {BRAND.name} is provided &ldquo;as is&rdquo; without
                  warranties of any kind. To the maximum extent permitted by
                  law, we shall not be liable for any indirect, incidental,
                  special, or consequential damages arising from your use of the
                  service.
                </p>
              </div>
            </section>

            <section id="changes">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                9. Changes to Terms
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  We may update these terms from time to time. We will notify
                  you of material changes through the app or by email. Continued
                  use of the service after changes constitutes acceptance of the
                  updated terms.
                </p>
              </div>
            </section>

            <section id="contact">
              <h2 className="text-2xl font-bold text-ink-900 mb-4">
                10. Contact
              </h2>
              <div className="space-y-3 text-ink-700">
                <p>
                  For questions about these terms, contact us at
                  legal@chemirl.app.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
