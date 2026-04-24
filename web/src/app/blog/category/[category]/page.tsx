import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllCategories, getPostsByCategory } from '@/lib/blog';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/blog/schema';
import { PostCard } from '@/components/blog/PostCard';

type PageProps = {
  params: Promise<{ category: string }>;
};

function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

export async function generateStaticParams() {
  return getAllCategories().map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  if (!isCategory(category)) return { title: 'Not found' };
  return {
    title: `${CATEGORY_LABELS[category]} — Chem IRL Blog`,
    description: `Posts in the ${CATEGORY_LABELS[category]} category.`,
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  if (!isCategory(category)) notFound();
  const posts = getPostsByCategory(category);
  if (posts.length === 0) notFound();

  return (
    <div className="pt-24 pb-16 max-w-7xl mx-auto px-4">
      <header className="max-w-3xl mb-12">
        <Link href="/blog" className="text-sm text-aqua-600 hover:underline mb-3 inline-block">
          ← All posts
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-4">
          {CATEGORY_LABELS[category]}
        </h1>
        <p className="text-lg text-ink-700">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </p>
      </header>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
