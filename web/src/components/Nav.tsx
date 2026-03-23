'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/safety', label: 'Safety' },
  { href: '/download', label: 'Download' },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm transition-shadow duration-300',
        scrolled && 'shadow-nav',
      )}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-ink-900">
          <Image src="/logo-icon.png" alt="" width={32} height={32} />
          Chem <span className="text-aqua-600">IRL</span>
        </Link>

        {/* Center links - desktop */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-700 hover:text-aqua-600 transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right CTA - desktop */}
        <div className="hidden md:block">
          <Link
            href="/download"
            className="bg-aqua-600 hover:bg-aqua-700 text-white font-semibold py-2 px-5 rounded-brand text-sm transition-colors"
          >
            Join Waitlist
          </Link>
        </div>

        {/* Hamburger - mobile */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          <div className="w-6 flex flex-col gap-1.5">
            <span
              className={cn(
                'block h-0.5 bg-ink-900 transition-all duration-300',
                mobileOpen && 'rotate-45 translate-y-2',
              )}
            />
            <span
              className={cn(
                'block h-0.5 bg-ink-900 transition-all duration-300',
                mobileOpen && 'opacity-0',
              )}
            />
            <span
              className={cn(
                'block h-0.5 bg-ink-900 transition-all duration-300',
                mobileOpen && '-rotate-45 -translate-y-2',
              )}
            />
          </div>
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40">
          <div className="flex flex-col items-center gap-8 pt-12">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-lg font-medium text-ink-900 hover:text-aqua-600 transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/download"
              className="bg-aqua-600 hover:bg-aqua-700 text-white font-semibold py-3 px-8 rounded-brand text-lg transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              Join Waitlist
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
