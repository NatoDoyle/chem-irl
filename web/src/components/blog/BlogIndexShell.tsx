import type { ReactNode } from 'react';
import type { Post } from '@/lib/blog/schema';
import { Pagination } from './Pagination';
import { PostListItem } from './PostListItem';
import { BlogSidebar } from './BlogSidebar';
import { SearchBar } from './SearchBar';

type Props = {
  posts: Post[];
  title: string;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  page?: number;
  totalPages?: number;
  emptyState?: ReactNode;
  beforeList?: ReactNode;
};

export function BlogIndexShell({
  posts,
  title,
  eyebrow,
  subtitle,
  page,
  totalPages,
  emptyState,
  beforeList,
}: Props) {
  const showPagination =
    page !== undefined && totalPages !== undefined && totalPages > 1;

  return (
    <div
      className="pt-24 pb-16 max-w-7xl mx-auto px-4"
      data-pagefind-ignore="all"
    >
      <header className="max-w-3xl mb-10">
        {eyebrow && <div className="mb-3">{eyebrow}</div>}
        <h1 className="text-4xl md:text-5xl font-bold text-ink-900 mb-4">
          {title}
        </h1>
        {subtitle && (
          <div className="text-lg text-ink-700 leading-relaxed">{subtitle}</div>
        )}
      </header>

      <div className="grid md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-12">
        <main>
          <SearchBar />
          {beforeList}
          {posts.length === 0 ? (
            emptyState ?? (
              <p className="text-ink-500">No posts yet. Check back soon.</p>
            )
          ) : (
            <>
              <ol className="list-none">
                {posts.map((post) => (
                  <li key={post.slug}>
                    <PostListItem post={post} />
                  </li>
                ))}
              </ol>
              {showPagination && (
                <div className="mt-10">
                  <Pagination page={page!} totalPages={totalPages!} />
                </div>
              )}
            </>
          )}
        </main>
        <BlogSidebar />
      </div>
    </div>
  );
}
