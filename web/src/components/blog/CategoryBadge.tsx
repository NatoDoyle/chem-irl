import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CATEGORIES, type CategorySlug } from '@/lib/blog/categories';

export function CategoryBadge({ category, className }: { category: CategorySlug; className?: string }) {
  return (
    <Link
      href={`/blog/category/${CATEGORIES[category].path}`}
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
        'bg-aqua-50 text-aqua-700 hover:bg-aqua-100 transition-colors',
        className,
      )}
    >
      {CATEGORIES[category].label}
    </Link>
  );
}
