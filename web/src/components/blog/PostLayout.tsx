import type { ReactNode } from 'react';
import type { Author, Post } from '@/lib/blog/schema';
import { AuthorCard } from './AuthorCard';
import { CategoryBadge } from './CategoryBadge';
import { ReadingProgress } from './ReadingProgress';
import { ReadingTime } from './ReadingTime';
import { RelatedPosts } from './RelatedPosts';
import { TableOfContents } from './TableOfContents';
import { TagList } from './TagList';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function authorSameAs(author: Author): string[] {
  return [author.twitter, author.linkedin, author.website].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
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
  const description = post.tldr ?? post.excerpt;
  const dateModified = (post.lastReviewed ?? post.date).toISOString();
  const sameAs = authorSameAs(post.authorData);

  const blogPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description,
    image: post.image ?? 'https://chemirl.app/opengraph-image.png',
    datePublished: post.date.toISOString(),
    dateModified,
    author: {
      '@type': 'Person',
      name: post.authorData.name,
      ...(sameAs.length > 0 ? { sameAs } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: 'Chem IRL',
      logo: { '@type': 'ImageObject', url: 'https://chemirl.app/icon.png' },
    },
    mainEntityOfPage: `https://chemirl.app/blog/${post.slug}`,
    ...(post.citableClaim
      ? { mentions: { '@type': 'Quotation', text: post.citableClaim } }
      : {}),
    ...(post.entities && post.entities.length > 0
      ? { keywords: post.entities.join(', ') }
      : {}),
  };

  const faqJsonLd =
    post.faq && post.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: item.answer,
            },
          })),
        }
      : null;

  return (
    <article
      className="pt-24 pb-16"
      data-pagefind-body
      data-pagefind-meta={`title:${post.title}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
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
        {post.tldr && (
          <aside
            className="mt-6 px-5 py-4 rounded-brand bg-warm-bg border-l-4 border-aqua-600 text-ink-800 text-base leading-relaxed"
            aria-label="Short answer"
          >
            <p className="text-xs font-semibold text-ink-900 mb-2 uppercase tracking-wide">
              Short answer
            </p>
            <p>{post.tldr}</p>
          </aside>
        )}
      </header>

      <ReadingProgress />

      <div className="mx-auto px-4 max-w-3xl md:max-w-5xl md:grid md:grid-cols-[minmax(0,1fr)_200px] md:gap-12">
        <div className="prose prose-lg prose-ink prose-headings:font-bold prose-headings:text-ink-900 prose-headings:scroll-mt-24 prose-a:text-aqua-600 prose-a:no-underline hover:prose-a:underline prose-code:text-coral prose-code:font-semibold prose-code:before:content-none prose-code:after:content-none prose-pre:bg-warm-bg prose-pre:border prose-pre:border-aqua-100 prose-blockquote:border-l-4 prose-blockquote:border-aqua-600 prose-blockquote:text-ink-700 prose-blockquote:not-italic prose-img:rounded-brand">
          {children}
          {post.faq && post.faq.length > 0 && (
            <section aria-labelledby="common-questions-heading" className="mt-12">
              <h2 id="common-questions-heading">Common questions</h2>
              {post.faq.map((item, i) => (
                <div key={i}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </div>
              ))}
            </section>
          )}
        </div>
        <TableOfContents />
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
