import Link from 'next/link';
import type { Post } from '@/lib/blog/schema';
import { CategoryBadge } from './CategoryBadge';
import { ReadingTime } from './ReadingTime';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PostListItem({ post }: { post: Post }) {
  return (
    <article className="group border-t border-ink-100 first:border-t-0 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
          {formatDate(post.date)}
        </span>
        <span className="text-ink-300" aria-hidden>
          ·
        </span>
        <CategoryBadge category={post.category} />
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-ink-900 leading-tight mb-3 group-hover:text-aqua-700 transition-colors">
        <Link href={`/blog/${post.slug}`}>{post.title}</Link>
      </h2>
      <p className="text-base text-ink-700 leading-relaxed mb-3">{post.excerpt}</p>
      <div className="flex items-center gap-3 text-sm text-ink-500">
        <span className="font-medium text-ink-700">{post.authorData.name}</span>
        <span aria-hidden>·</span>
        <ReadingTime minutes={post.readingTimeMinutes} />
      </div>
    </article>
  );
}
