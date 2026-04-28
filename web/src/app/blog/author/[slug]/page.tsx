import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  getAllAuthorSlugs,
  getAuthorBySlug,
  getPostsByAuthor,
} from '@/lib/blog';
import { BlogIndexShell } from '@/components/blog/BlogIndexShell';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return getAllAuthorSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) return { title: 'Not found' };
  return {
    title: `${author.name} — Chem IRL Blog`,
    description: author.bio ?? `Posts by ${author.name} on the Chem IRL blog.`,
  };
}

export default async function AuthorPage({ params }: PageProps) {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) notFound();
  const posts = getPostsByAuthor(slug);

  return (
    <BlogIndexShell
      posts={posts}
      eyebrow={
        <Link
          href="/blog"
          className="text-sm text-aqua-600 hover:underline"
        >
          ← All posts
        </Link>
      }
      title={author.name}
      subtitle={
        <div className="flex items-start gap-4">
          {author.avatar ? (
            <Image
              src={author.avatar}
              alt={author.name}
              width={56}
              height={56}
              className="rounded-full flex-shrink-0"
              unoptimized
            />
          ) : null}
          <div className="flex-1">
            {author.role && (
              <p className="text-sm text-ink-500 mb-2">{author.role}</p>
            )}
            {author.bio && (
              <p className="text-base text-ink-700 leading-relaxed mb-2">
                {author.bio}
              </p>
            )}
            <p className="text-sm text-ink-600">
              {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              {author.twitter && (
                <>
                  {' · '}
                  <a
                    href={author.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-aqua-600 hover:underline"
                  >
                    Twitter
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      }
    />
  );
}
