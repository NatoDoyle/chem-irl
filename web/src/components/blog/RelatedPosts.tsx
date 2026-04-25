import type { Post } from '@/lib/blog/schema';
import { PostCard } from './PostCard';

export function RelatedPosts({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <section aria-labelledby="related-heading" className="border-t border-aqua-100 pt-12 mt-16">
      <h2 id="related-heading" className="text-2xl font-bold text-ink-900 mb-8">
        Related reading
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
    </section>
  );
}
