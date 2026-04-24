import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode, { type Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';
import { getAllPosts, getPostBySlug, getRelatedPosts } from '@/lib/blog';
import { PostLayout } from '@/components/blog/PostLayout';
import { mdxComponents } from '@/mdx-components';

type PageProps = {
  params: Promise<{ slug: string }>;
};

const prettyCodeOptions: RehypePrettyCodeOptions = {
  theme: 'github-light',
  keepBackground: true,
};

export async function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: 'Not found' };
  return {
    title: `${post.title} — Chem IRL Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://chemirl.app/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date.toISOString(),
      authors: [post.authorData.name],
      images: post.coverImage ? [post.coverImage] : undefined,
    },
    twitter: { card: 'summary_large_image' },
    alternates: {
      canonical: post.canonicalUrl || `https://chemirl.app/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();
  const related = getRelatedPosts(post);

  return (
    <PostLayout post={post} related={related}>
      <MDXRemote
        source={post.body}
        components={mdxComponents}
        options={{
          mdxOptions: {
            remarkPlugins: [remarkGfm],
            rehypePlugins: [[rehypePrettyCode, prettyCodeOptions]],
          },
        }}
      />
    </PostLayout>
  );
}
