import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllCategories, getPostsByCategory } from '@/lib/blog';
import {
  CATEGORY_SLUGS,
  getCategoryDescription,
  getCategoryLabel,
  type CategorySlug,
} from '@/lib/blog/categories';
import { PostCard } from '@/components/blog/PostCard';

type PageProps = {
  params: Promise<{ category: string }>;
};

function isCategorySlug(value: string): value is CategorySlug {
  return (CATEGORY_SLUGS as readonly string[]).includes(value);
}

export async function generateStaticParams() {
  return getAllCategories().map((category) => ({ category }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  if (!isCategorySlug(category)) return { title: 'Not found' };
  return {
    title: `${getCategoryLabel(category)} — Chem IRL Blog`,
    description: getCategoryDescription(category),
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category } = await params;
  if (!isCategorySlug(category)) notFound();
  const posts = getPostsByCategory(category);
  if (posts.length === 0) notFound();

  return (
    <div className="pt-24 pb-16 max-w-7xl mx-auto px-4">
      <header className="max-w-3xl mb-12">
        <Link href="/blog" className="text-sm text-aqua-600 hover:underline mb-3 inline-block">
          ← All posts
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-4">
          {getCategoryLabel(category)}
        </h1>
        <p className="text-lg text-ink-700 mb-2">{getCategoryDescription(category)}</p>
        <p className="text-sm text-ink-600">
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
