import Link from 'next/link';
import { cn } from '@/lib/utils';

export function TagList({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;
  return (
    <ul className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => (
        <li key={tag}>
          <Link
            href={`/blog/tag/${tag}`}
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-ink-700 bg-warm-bg hover:bg-aqua-50 hover:text-aqua-700 transition-colors"
          >
            #{tag}
          </Link>
        </li>
      ))}
    </ul>
  );
}
