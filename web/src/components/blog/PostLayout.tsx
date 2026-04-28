import type { ReactNode } from 'react';
import type { Post } from '@/lib/blog/schema';
import { AuthorCard } from './AuthorCard';
import { CategoryBadge } from './CategoryBadge';
import { ReadingTime } from './ReadingTime';
import { RelatedPosts } from './RelatedPosts';
import { TagList } from './TagList';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function PostLayout({
  post,
  related,
  children,
}: {
  post: Post;
  related: Post[];
  children: ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date.toISOString(),
    author: {
      '@type': 'Person',
      name: post.authorData.name,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Chem IRL',
      logo: { '@type': 'ImageObject', url: 'https://chemirl.app/logo-icon.png' },
    },
    mainEntityOfPage: `https://chemirl.app/blog/${post.slug}`,
  };

  return (
    <article className="pt-24 pb-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="max-w-3xl mx-auto px-4 mb-8">
        <div className="flex items-center gap-3 mb-6">
          <CategoryBadge category={post.category} />
          <span className="text-sm text-ink-500">{formatDate(post.date)}</span>
          <span className="text-sm text-ink-500" aria-hidden>·</span>
          <ReadingTime minutes={post.readingTimeMinutes} className="text-sm text-ink-500" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 leading-tight mb-4">
          {post.title}
        </h1>
        <p className="text-lg text-ink-700 leading-relaxed">{post.excerpt}</p>
      </header>

      <div className="max-w-3xl mx-auto px-4 prose prose-lg prose-ink prose-headings:font-bold prose-headings:text-ink-900 prose-a:text-aqua-600 prose-a:no-underline hover:prose-a:underline prose-code:text-coral prose-code:font-semibold prose-code:before:content-none prose-code:after:content-none prose-pre:bg-warm-bg prose-pre:border prose-pre:border-aqua-100 prose-blockquote:border-l-4 prose-blockquote:border-aqua-600 prose-blockquote:text-ink-700 prose-blockquote:not-italic prose-img:rounded-brand">
        {children}
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-12">
        <TagList tags={post.tags} />
      </div>

      <div className="max-w-3xl mx-auto px-4 mt-8">
        <AuthorCard author={post.authorData} />
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <RelatedPosts posts={related} />
      </div>
    </article>
  );
}
