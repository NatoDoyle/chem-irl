'use client';

import { useState } from 'react';
import { usePagefindSearch } from '@/lib/pagefind';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const { results, loading } = usePagefindSearch(query, 8);
  const trimmed = query.trim();

  return (
    <div className="mb-10" data-pagefind-ignore="all">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search posts…"
          aria-label="Search posts"
          className="w-full pl-4 pr-20 py-3 rounded-brand border border-ink-100 bg-surface text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-aqua-500 focus:ring-2 focus:ring-aqua-100 transition"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded bg-warm-bg text-ink-500 hidden sm:inline">
          ⌘K
        </kbd>
      </div>
      {trimmed && (
        <div className="mt-4 rounded-brand bg-surface border border-ink-100 divide-y divide-ink-100 overflow-hidden">
          {loading && (
            <p className="px-4 py-3 text-sm text-ink-500">Searching…</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-500">
              No posts match &ldquo;{query}&rdquo;.
            </p>
          )}
          {!loading &&
            results.map((r) => (
              <a
                key={r.url}
                href={r.url}
                className="block px-4 py-3 hover:bg-warm-bg transition-colors"
              >
                <div
                  className="font-medium text-ink-900 mb-1"
                  dangerouslySetInnerHTML={{ __html: r.meta.title }}
                />
                <div
                  className="text-sm text-ink-700 line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: r.excerpt }}
                />
              </a>
            ))}
        </div>
      )}
    </div>
  );
}
