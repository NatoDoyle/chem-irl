import type { Metadata } from 'next';
import { getAllPosts, paginate } from '@/lib/blog';
import { PostCard } from '@/components/blog/PostCard';
import { Pagination } from '@/components/blog/Pagination';

export const metadata: Metadata = {
  title: 'Blog — Chem IRL',
  description: 'Research, product updates, and safety notes from the team behind Chem IRL.',
  openGraph: {
    title: 'Blog — Chem IRL',
    description: 'Research, product updates, and safety notes from the team behind Chem IRL.',
    url: 'https://chemirl.app/blog',
    type: 'website',
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();
  const { items, page, totalPages } = paginate(posts, 1);

  return (
    <div className="pt-24 pb-16 max-w-7xl mx-auto px-4">
      <header className="max-w-3xl mb-12">
        <p className="text-sm font-semibold text-aqua-600 mb-3">Field notes</p>
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-4">Writing from Chem IRL</h1>
        <p className="text-lg text-ink-700 leading-relaxed">
          Research, product decisions, and safety notes — how we think about getting people from match to meeting.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-ink-500">No posts yet. Check back soon.</p>
      ) : (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {items.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
