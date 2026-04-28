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
import { BlogIndexShell } from '@/components/blog/BlogIndexShell';

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
    <BlogIndexShell
      posts={posts}
      eyebrow={
        <Link href="/blog" className="text-sm text-aqua-600 hover:underline">
          ← All posts
        </Link>
      }
      title={getCategoryLabel(category)}
      subtitle={
        <>
          <p className="mb-2">{getCategoryDescription(category)}</p>
          <p className="text-sm text-ink-600">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </p>
        </>
      }
    />
  );
}
