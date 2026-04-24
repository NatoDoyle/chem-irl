import Link from 'next/link';
import { cn } from '@/lib/utils';

function hrefFor(page: number): string {
  return page === 1 ? '/blog' : `/blog/page/${page}`;
}

export function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Blog pagination">
      <Link
        href={hasPrev ? hrefFor(page - 1) : '#'}
        aria-disabled={!hasPrev}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-brand text-sm font-medium',
          hasPrev
            ? 'text-ink-900 hover:bg-warm-bg transition-colors'
            : 'text-ink-400 pointer-events-none',
        )}
      >
        ← Previous
      </Link>
      <span className="text-sm text-ink-500">
        Page {page} of {totalPages}
      </span>
      <Link
        href={hasNext ? hrefFor(page + 1) : '#'}
        aria-disabled={!hasNext}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-brand text-sm font-medium',
          hasNext
            ? 'text-ink-900 hover:bg-warm-bg transition-colors'
            : 'text-ink-400 pointer-events-none',
        )}
      >
        Next →
      </Link>
    </nav>
  );
}
