import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CATEGORY_LABELS, type Category } from '@/lib/blog/schema';

export function CategoryBadge({ category, className }: { category: Category; className?: string }) {
  return (
    <Link
      href={`/blog/category/${category}`}
      className={cn(
        'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
        'bg-aqua-50 text-aqua-700 hover:bg-aqua-100 transition-colors',
        className,
      )}
    >
      {CATEGORY_LABELS[category]}
    </Link>
  );
}
