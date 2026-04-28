import type { Metadata } from 'next';
import { getAllPosts, paginate } from '@/lib/blog';
import { BlogIndexShell } from '@/components/blog/BlogIndexShell';

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
    <BlogIndexShell
      posts={items}
      eyebrow={<p className="text-sm font-semibold text-aqua-600">Field notes</p>}
      title="Writing from Chem IRL"
      subtitle="Research, product decisions, and safety notes — how we think about getting people from match to meeting."
      page={page}
      totalPages={totalPages}
    />
  );
}
