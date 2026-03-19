import Link from 'next/link';
import { BRAND, BRAND_COLORS } from '@/config/brand';

const PRODUCT_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/download', label: 'Download' },
  { href: '/safety', label: 'Safety' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
];

export function Footer() {
  return (
    <footer>
      {/* Wave transition from content to dark footer */}
      <svg
        viewBox="0 0 1440 80"
        className="w-full block"
        preserveAspectRatio="none"
        style={{ height: '80px' }}
        aria-hidden="true"
      >
        <path
          d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z"
          fill={BRAND_COLORS.text[900]}
        />
      </svg>

      <div className="bg-dark-bg text-white">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Logo + tagline */}
            <div className="sm:col-span-2 lg:col-span-1">
              <Link href="/" className="text-xl font-bold">
                Chem <span className="text-aqua-400">IRL</span>
              </Link>
              <p className="mt-3 text-ink-400 text-sm">{BRAND.tagline}</p>
            </div>

            {/* Product */}
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-ink-400 mb-4">
                Product
              </h3>
              <ul className="space-y-3">
                {PRODUCT_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-300 hover:text-aqua-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-ink-400 mb-4">
                Company
              </h3>
              <ul className="space-y-3">
                {COMPANY_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-300 hover:text-aqua-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-ink-400 mb-4">
                Stay Updated
              </h3>
              <p className="text-sm text-gray-300 mb-4">
                Get notified when we launch in your city.
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email address"
                  aria-label="Email for newsletter"
                  className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-aqua-500"
                />
                <Link
                  href="/download"
                  className="bg-aqua-600 hover:bg-aqua-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shrink-0"
                >
                  Join
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-ink-400">
            <p>&copy; 2026 {BRAND.name}. All rights reserved.</p>
            <div className="flex gap-6">
              <Link
                href="/privacy"
                className="hover:text-aqua-400 transition-colors"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="hover:text-aqua-400 transition-colors"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
