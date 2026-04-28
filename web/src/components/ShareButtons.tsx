'use client';

import { useState } from 'react';
import { trackEvent } from '@/lib/analytics';

interface ShareButtonsProps {
  referralUrl: string;
}

type ShareChannel = 'whatsapp' | 'twitter' | 'sms' | 'copy';

// Brand voice (per App Plans/Brand & Growth v2 §5): direct, outcome-driven,
// no romance clichés. Tested across WhatsApp + X char limits.
const SHARE_MESSAGE =
  "I'm on the Dublin waitlist for Chem IRL — dating without the texting marathon. Sign up through my link and we both jump up the list:";

export function ShareButtons({ referralUrl }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const text = `${SHARE_MESSAGE} ${referralUrl}`;
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(referralUrl);
  const encodedShortText = encodeURIComponent(SHARE_MESSAGE);

  const links: { label: string; channel: ShareChannel; href: string; external: boolean }[] = [
    {
      label: 'WhatsApp',
      channel: 'whatsapp',
      href: `https://wa.me/?text=${encodedText}`,
      external: true,
    },
    {
      label: 'X / Twitter',
      channel: 'twitter',
      // X dedupes URL from text body so include it once, separately, for the URL card.
      href: `https://twitter.com/intent/tweet?text=${encodedShortText}&url=${encodedUrl}`,
      external: true,
    },
    {
      label: 'iMessage',
      channel: 'sms',
      // sms: scheme is iOS-friendly; on other platforms it'll prompt to pick an SMS app.
      href: `sms:?&body=${encodedText}`,
      external: false,
    },
  ];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      trackEvent('referral_share_clicked', { channel: 'copy' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No-op: if clipboard fails (permissions, http, ancient browser), the
      // URL is already visible on screen; the user can copy manually.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target={link.external ? '_blank' : undefined}
            rel={link.external ? 'noopener noreferrer' : undefined}
            onClick={() =>
              trackEvent('referral_share_clicked', { channel: link.channel })
            }
            className="rounded-full border border-aqua-200 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:border-aqua-400 hover:bg-aqua-50 transition-colors"
          >
            {link.label}
          </a>
        ))}
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-full border border-aqua-200 bg-white px-4 py-2 text-sm font-medium text-ink-900 hover:border-aqua-400 hover:bg-aqua-50 transition-colors"
          aria-live="polite"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p className="text-xs text-ink-500 break-all">{referralUrl}</p>
    </div>
  );
}
