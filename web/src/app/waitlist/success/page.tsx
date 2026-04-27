import { WaitlistSuccess } from '@/components/WaitlistSuccess';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "You're on the list - Chem IRL",
  description: "You're on the Dublin waitlist for Chem IRL.",
  // Per-user URLs (carry the referral code as a query param). Don't index.
  robots: { index: false, follow: false },
};

export default function WaitlistSuccessPage() {
  // Page shell stays server-rendered; the client component handles the
  // ?code= read + RPC fetch.
  return (
    <main className="pt-32 pb-16">
      <WaitlistSuccess />
    </main>
  );
}
