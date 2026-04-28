import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Not found - Chem IRL',
  description: "The page you're looking for isn't here.",
};

export default function NotFound() {
  return (
    <section className="pt-32 pb-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-6">
          Page not found
        </h1>
        <p className="text-xl text-ink-500 mb-8">
          We couldn&apos;t find the page you&apos;re looking for. Try one of
          these instead.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center bg-aqua-600 hover:bg-aqua-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/download"
            className="inline-flex items-center justify-center text-aqua-700 hover:text-aqua-800 font-semibold py-3 px-6 transition-colors"
          >
            Join the waitlist →
          </Link>
        </div>
      </div>
    </section>
  );
}
