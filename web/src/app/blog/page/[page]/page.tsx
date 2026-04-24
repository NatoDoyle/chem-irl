import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts, paginate, POSTS_PER_PAGE } from '@/lib/blog';
import { PostCard } from '@/components/blog/PostCard';
import { Pagination } from '@/components/blog/Pagination';

type PageProps = {
  params: Promise<{ page: string }>;
};

export async function generateStaticParams() {
  const posts = getAllPosts();
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const extraPages = Math.max(0, totalPages - 1);
  if (extraPages === 0) {
    // Next's static export requires at least one pre-rendered param. Emit a
    // stub that renders the index so /blog/page/1 canonicalises cleanly
    // instead of 404ing with a Next error page.
    return [{ page: '1' }];
  }
  return Array.from({ length: extraPages }, (_, i) => ({ page: String(i + 2) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  return {
    title: `Blog — Page ${page} — Chem IRL`,
    description: 'Research, product updates, and safety notes from Chem IRL.',
  };
}

export default async function BlogPaginationPage({ params }: PageProps) {
  const { page: pageParam } = await params;
  const pageNum = Number.parseInt(pageParam, 10);
  if (!Number.isInteger(pageNum) || pageNum < 1) notFound();
  const posts = getAllPosts();
  const { items, page, totalPages } = paginate(posts, pageNum);
  // Redirect canonical /blog/page/1 requests to /blog via notFound (not a real
  // pagination page). Real pagination starts at page 2.
  if (pageNum === 1) notFound();
  if (page !== pageNum) notFound();

  return (
    <div className="pt-24 pb-16 max-w-7xl mx-auto px-4">
      <header className="max-w-3xl mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-4">
          Blog · page {page}
        </h1>
      </header>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {items.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
