import Link from 'next/link';
import { getCategoryCounts, getPopularTags } from '@/lib/blog';
import { CATEGORIES } from '@/lib/blog/categories';
import { BlogEmailCTA } from './BlogEmailCTA';

export function BlogSidebar() {
  const categories = getCategoryCounts();
  const tags = getPopularTags(8);

  return (
    <aside className="md:sticky md:top-28 self-start space-y-10 mt-8 md:mt-0">
      <section aria-labelledby="sidebar-categories">
        <h3
          id="sidebar-categories"
          className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3"
        >
          Categories
        </h3>
        <ul className="space-y-2">
          {categories.map(({ category, count }) => (
            <li key={category}>
              <Link
                href={`/blog/category/${CATEGORIES[category].path}`}
                className="flex items-center justify-between text-sm text-ink-900 hover:text-aqua-700 transition-colors"
              >
                <span>{CATEGORIES[category].label}</span>
                <span className="text-ink-500 text-xs tabular-nums">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {tags.length > 0 && (
        <section aria-labelledby="sidebar-tags">
          <h3
            id="sidebar-tags"
            className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-3"
          >
            Popular tags
          </h3>
          <ul className="flex flex-wrap gap-2">
            {tags.map(({ tag }) => (
              <li key={tag}>
                <Link
                  href={`/blog/tag/${tag}`}
                  className="inline-block text-xs px-3 py-1 rounded-full bg-warm-bg text-ink-700 hover:bg-aqua-50 hover:text-aqua-700 transition-colors"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BlogEmailCTA />
    </aside>
  );
}
