import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllTags, getPostsByTag } from '@/lib/blog';
import { BlogIndexShell } from '@/components/blog/BlogIndexShell';

type PageProps = {
  params: Promise<{ tag: string }>;
};

export async function generateStaticParams() {
  return getAllTags().map((tag) => ({ tag }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${tag} — Chem IRL Blog`,
    description: `Posts tagged #${tag} on the Chem IRL blog.`,
  };
}

export default async function TagPage({ params }: PageProps) {
  const { tag } = await params;
  const posts = getPostsByTag(tag);
  if (posts.length === 0) notFound();

  return (
    <BlogIndexShell
      posts={posts}
      eyebrow={
        <Link href="/blog" className="text-sm text-aqua-600 hover:underline">
          ← All posts
        </Link>
      }
      title={`#${tag}`}
      subtitle={
        <>
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} tagged #{tag}
        </>
      }
    />
  );
}
