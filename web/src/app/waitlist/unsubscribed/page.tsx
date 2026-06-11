import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Unsubscribed - Chem IRL',
  description: 'No more waitlist update emails.',
  // Landing target of the List-Unsubscribe link. Don't index.
  robots: { index: false, follow: false },
};

export default function WaitlistUnsubscribedPage() {
  return (
    <main className="pt-32 pb-16">
      <div className="mx-auto max-w-xl px-6 text-center">
        <h1 className="font-serif text-3xl text-ink-900">You&apos;re unsubscribed.</h1>
        <p className="mt-4 text-ink-700">
          No more waitlist update emails. Your spot, score, and referral link are
          unaffected — the status link from your confirmation email still works
          any time.
        </p>
        <p className="mt-8">
          <Link href="/" className="text-aqua-700 underline underline-offset-4">
            Back to chemirl.app
          </Link>
        </p>
      </div>
    </main>
  );
}
