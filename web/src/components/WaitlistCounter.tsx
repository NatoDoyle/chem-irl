'use client';

import { useEffect, useState } from 'react';
import { getWaitlistCount } from '@/lib/waitlist';

/**
 * Live count of confirmed Dublin waitlist signups, fetched once on mount
 * via the `waitlist_count_dublin` RPC. Shows nothing while loading (no
 * skeleton — keeping the marketing layout stable was deemed more
 * important than indicating loading state for a single tiny element).
 *
 * Honest: real DB count, no hardcoded floor. Early visitors will see
 * small numbers ("3 people on the Dublin waitlist") — that's intentional
 * per the launch plan's transparency-first voice.
 */
export function WaitlistCounter({ className }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getWaitlistCount().then((result) => {
      if (cancelled) return;
      if (result.success) setCount(result.count);
      // On failure: stay null (component renders nothing). The page still
      // looks fine without the count line; we'd rather omit than mislead.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) {
    // Reserve space so layout doesn't jump when the count loads.
    return <span className={className}>&nbsp;</span>;
  }

  return <span className={className}>{formatCountCopy(count)}</span>;
}

function formatCountCopy(count: number): string {
  if (count === 0) return 'Be the first to join the Dublin waitlist';
  if (count === 1) return '1 person on the Dublin waitlist';
  return `${count.toLocaleString()} people on the Dublin waitlist`;
}
