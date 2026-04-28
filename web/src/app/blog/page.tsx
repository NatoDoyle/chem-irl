import type { Metadata } from 'next';
import { getAllPosts, paginate } from '@/lib/blog';
import { BlogIndexShell } from '@/components/blog/BlogIndexShell';

const BLOG_SUBTITLE =
  'Dating advice, tips, honest takes and the thought process behind Chem IRL';

export const metadata: Metadata = {
  title: 'Blog — Chem IRL',
  description: BLOG_SUBTITLE,
  openGraph: {
    title: 'Blog — Chem IRL',
    description: BLOG_SUBTITLE,
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
      eyebrow={<p className="text-sm font-semibold text-aqua-600">The blog</p>}
      title="Writing from Chem IRL"
      subtitle={BLOG_SUBTITLE}
      page={page}
      totalPages={totalPages}
    />
  );
}
