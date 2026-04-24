import Image from 'next/image';
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

export function PostCard({ post }: { post: Post }) {
  return (
    <article className="group h-full flex flex-col rounded-brand bg-surface shadow-warm hover:shadow-warm-lg transition-shadow overflow-hidden">
      <Link href={`/blog/${post.slug}`} className="flex-shrink-0 block">
        {post.coverImage ? (
          <div className="relative aspect-[16/9] overflow-hidden bg-warm-bg">
            <Image
              src={post.coverImage}
              alt=""
              fill
              sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw"
              className="object-cover group-hover:scale-[1.02] transition-transform duration-500"
              unoptimized
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-gradient-to-br from-aqua-50 to-gold-50" aria-hidden />
        )}
      </Link>
      <div className="flex-1 flex flex-col p-6 gap-3">
        <div className="flex items-center gap-3">
          <CategoryBadge category={post.category} />
          <span className="text-xs text-ink-500">{formatDate(post.date)}</span>
        </div>
        <h2 className="text-xl font-bold text-ink-900 leading-tight group-hover:text-aqua-600 transition-colors">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className="text-sm text-ink-700 leading-relaxed line-clamp-3 flex-1">{post.excerpt}</p>
        <div className="flex items-center gap-3 text-xs text-ink-500 pt-2">
          <span className="font-medium text-ink-700">{post.authorData.name}</span>
          <span aria-hidden>·</span>
          <ReadingTime minutes={post.readingTimeMinutes} />
        </div>
      </div>
    </article>
  );
}
