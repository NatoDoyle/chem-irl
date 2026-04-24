import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getAllTags, getPostsByTag } from '@/lib/blog';
import { PostCard } from '@/components/blog/PostCard';

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
    <div className="pt-24 pb-16 max-w-7xl mx-auto px-4">
      <header className="max-w-3xl mb-12">
        <Link href="/blog" className="text-sm text-aqua-600 hover:underline mb-3 inline-block">
          ← All posts
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-4">#{tag}</h1>
        <p className="text-lg text-ink-700">
          {posts.length} {posts.length === 1 ? 'post' : 'posts'} tagged #{tag}
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
