import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import remarkGfm from 'remark-gfm';
import rehypePrettyCode, { type Options as RehypePrettyCodeOptions } from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
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
  const imageOverride = post.image
    ? [{ url: post.image, width: 1200, height: 630, alt: post.title }]
    : undefined;
  // AI engines (ChatGPT, Claude, Perplexity, Google AI Overviews) parse the
  // <meta description> and og:description as the post's snippet. Prefer the
  // direct-answer TLDR there. Twitter card stays on the hook-shaped excerpt
  // since social previews favor a teaser, not an answer.
  const aiDescription = post.tldr ?? post.excerpt;
  const modifiedTime = (post.lastReviewed ?? post.date).toISOString();
  return {
    title: `${post.title} — Chem IRL Blog`,
    description: aiDescription,
    openGraph: {
      title: post.title,
      description: aiDescription,
      url: `https://chemirl.app/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date.toISOString(),
      modifiedTime,
      authors: [post.authorData.name],
      ...(imageOverride ? { images: imageOverride } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      ...(post.image ? { images: [post.image] } : {}),
    },
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
            rehypePlugins: [rehypeSlug, [rehypePrettyCode, prettyCodeOptions]],
          },
        }}
      />
    </PostLayout>
  );
}
